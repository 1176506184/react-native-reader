import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Canvas,
  Fill,
  ImageShader,
  makeImageFromView,
  Shader,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { AppState, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { PageData, ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';
import { PAGE_CURL_SHADER } from './pageCurlShader';

const FLIP_DURATION = 360;
const RESET_DURATION = 220;
const CAPTURE_TIMEOUT = 1200;
const ANIMATION_WATCHDOG_TIMEOUT = 3500;
const TAP_MOVE_TOLERANCE = 8;
const DIRECTION_ACTIVATION_DISTANCE = 3;
const SWIPE_THRESHOLD_RATIO = 0.14;
const SWIPE_VELOCITY_THRESHOLD = 450;
const DRAG_SENSITIVITY = 1.4;

type CurlDirection = -1 | 0 | 1;

type PageImageCache = {
  key: string;
  image: SkImage;
};

type PendingAnimation = {
  direction: Exclude<CurlDirection, 0>;
  commit: boolean;
};

type PendingPageRequest = {
  direction: Exclude<CurlDirection, 0>;
  sourceKey: string;
};

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onLateResolve?: (value: T) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error('Page capture timed out'));
    }, timeoutMs);
    promise.then(
      (value) => {
        if (settled) {
          onLateResolve?.(value);
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

const getTapDirection = (x: number, width: number): CurlDirection => {
  if (x < width / 3) return -1;
  if (x > (width * 2) / 3) return 1;
  return 0;
};

const getPageIdentity = (page?: PageData) => [
  page?.chapterId ?? '',
  page?.chapterPageIndex ?? page?.index ?? '',
  page?.locked ? 1 : 0,
].join(':');

const logSimulation = (event: string, details: Record<string, unknown> = {}) => {
  console.log(`[Reader][Simulation] ${event}`, details);
};

const isSamePage = (left?: PageData | null, right?: PageData | null) => (
  Boolean(left && right) && getPageIdentity(left ?? undefined) === getPageIdentity(right ?? undefined)
);

const getThemeColor = (color: string, lightenAmount = 0): [number, number, number, number] => {
  const normalized = color.replace('#', '');
  const isShortHex = normalized.length === 3;
  const readChannel = (offset: number) => {
    const value = isShortHex
      ? normalized[offset].repeat(2)
      : normalized.slice(offset * 2, offset * 2 + 2);
    const parsed = Number.parseInt(value, 16);
    return Number.isFinite(parsed) ? parsed : 232;
  };
  const lighten = (channel: number) => (channel + (255 - channel) * lightenAmount) / 255;
  return [lighten(readChannel(0)), lighten(readChannel(1)), lighten(readChannel(2)), 1];
};

export const SimulationFlip: React.FC<ReaderFlipBaseProps> = ({
  pages,
  currentPage,
  onPageChange,
  onTapCenter,
  onFlipStart,
  themeColor,
  textColor,
  fontSize,
  lineHeight,
  width,
  height,
  headerTitle,
  chapterInfoText,
  moveChromeWithPage,
  topChromeHeight = 0,
  bottomChromeHeight = 0,
  topSafeInset = 0,
  contentHorizontalPadding,
  contentTopPadding,
  contentKey,
  renderBackIcon,
  onBack,
  lockedOverlay,
}) => {
  const sourcePageRef = useRef<View>(null);
  const targetPageRef = useRef<View>(null);
  const currentCaptureTokenRef = useRef(0);
  const targetCaptureTokenRef = useRef(0);
  const currentImageRef = useRef<PageImageCache | null>(null);
  const targetImageRef = useRef<PageImageCache | null>(null);
  const pendingAnimationRef = useRef<PendingAnimation | null>(null);
  const pendingPageRequestRef = useRef<PendingPageRequest | null>(null);
  const commitFrameRef = useRef<number | null>(null);
  const secondCommitFrameRef = useRef<number | null>(null);
  const canvasWarmupFrameRef = useRef<number | null>(null);
  const secondCanvasWarmupFrameRef = useRef<number | null>(null);
  const animationWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureFailureRef = useRef<() => void>(() => undefined);

  const progress = useSharedValue(0);
  const activeDirection = useSharedValue<CurlDirection>(0);
  const flipStarted = useSharedValue(false);
  const gestureEndedNormally = useSharedValue(false);
  const isAnimating = useSharedValue(false);

  const [direction, setDirection] = useState<CurlDirection>(0);
  const [gestureSourcePage, setGestureSourcePage] = useState<PageData | null>(null);
  const [gestureTargetPage, setGestureTargetPage] = useState<PageData | null>(null);
  const [settlingPage, setSettlingPage] = useState<PageData | null>(null);
  const [currentImage, setCurrentImage] = useState<PageImageCache | null>(null);
  const [targetImage, setTargetImage] = useState<PageImageCache | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [canvasPresented, setCanvasPresented] = useState(false);

  const currentPageData = pages[currentPage];
  const displayPage = direction === 0 ? currentPageData : gestureSourcePage || currentPageData;
  const currentPageIdentity = `${contentKey ?? ''}|${getPageIdentity(currentPageData)}`;
  const currentImageKey = useMemo(() => [
    currentPageIdentity,
    width,
    height,
    themeColor,
    textColor,
    fontSize,
    lineHeight,
    headerTitle ?? '',
    chapterInfoText ?? '',
    moveChromeWithPage ? 1 : 0,
    topChromeHeight,
    bottomChromeHeight,
    topSafeInset,
    contentHorizontalPadding,
    contentTopPadding,
  ].join('|'), [
    bottomChromeHeight,
    chapterInfoText,
    contentHorizontalPadding,
    contentTopPadding,
    currentPageIdentity,
    fontSize,
    headerTitle,
    height,
    lineHeight,
    moveChromeWithPage,
    textColor,
    themeColor,
    topChromeHeight,
    topSafeInset,
    width,
  ]);
  const targetImageKey = useMemo(() => [
    contentKey ?? '',
    getPageIdentity(gestureTargetPage ?? undefined),
    width,
    height,
    themeColor,
    textColor,
    fontSize,
    lineHeight,
    headerTitle ?? '',
    chapterInfoText ?? '',
    moveChromeWithPage ? 1 : 0,
    topChromeHeight,
    bottomChromeHeight,
    topSafeInset,
    contentHorizontalPadding,
    contentTopPadding,
  ].join('|'), [
    bottomChromeHeight,
    chapterInfoText,
    contentHorizontalPadding,
    contentTopPadding,
    contentKey,
    fontSize,
    gestureTargetPage,
    headerTitle,
    height,
    lineHeight,
    moveChromeWithPage,
    textColor,
    themeColor,
    topChromeHeight,
    topSafeInset,
    width,
  ]);

  const effect = useMemo(() => {
    const nextEffect = Skia.RuntimeEffect.Make(PAGE_CURL_SHADER);
    if (!nextEffect) {
      throw new Error('Unable to compile the page curl shader');
    }
    return nextEffect;
  }, []);
  const backsideColor = useMemo(() => getThemeColor(themeColor, 0.12), [themeColor]);
  const uniforms = useDerivedValue(() => ({
    resolution: [width, height] as [number, number],
    progress: progress.value,
    backsideColor,
  }), [backsideColor, height, width]);

  const currentImageReady = currentImage?.key === currentImageKey;
  const targetImageReady = targetImage?.key === targetImageKey;
  const shaderReady = Boolean(direction !== 0 && currentImageReady && targetImageReady);
  const fromImage = direction === 1 ? currentImage?.image : targetImage?.image;
  const toImage = direction === 1 ? targetImage?.image : currentImage?.image;

  const replaceCurrentImage = useCallback((nextImage: PageImageCache) => {
    const previous = currentImageRef.current;
    currentImageRef.current = nextImage;
    setCurrentImage(nextImage);
    if (previous && previous.image !== nextImage.image) {
      previous.image.dispose();
    }
  }, []);

  const replaceTargetImage = useCallback((nextImage: PageImageCache) => {
    const previous = targetImageRef.current;
    targetImageRef.current = nextImage;
    setTargetImage(nextImage);
    if (previous && previous.image !== nextImage.image) {
      previous.image.dispose();
    }
  }, []);

  const releaseTargetImage = useCallback(() => {
    const previous = targetImageRef.current;
    targetImageRef.current = null;
    setTargetImage(null);
    if (previous) {
      requestAnimationFrame(() => previous.image.dispose());
    }
  }, []);

  const promoteTargetImageToCurrent = useCallback(() => {
    const promoted = targetImageRef.current;
    if (!promoted) {
      logSimulation('promote skipped', { reason: 'missing target image', currentImageKey });
      return;
    }
    const previous = currentImageRef.current;
    logSimulation('promote target to current', {
      fromKey: promoted.key,
      toKey: currentImageKey,
      previousKey: previous?.key,
    });
    currentCaptureTokenRef.current += 1;
    targetImageRef.current = null;
    currentImageRef.current = { key: currentImageKey, image: promoted.image };
    setTargetImage(null);
    setCurrentImage(currentImageRef.current);
    if (previous && previous.image !== promoted.image) {
      requestAnimationFrame(() => previous.image.dispose());
    }
  }, [currentImageKey]);

  const renderPageFrame = useCallback((page?: PageData) => (
    <PageFrame
      page={page}
      width={width}
      height={height}
      themeColor={themeColor}
      textColor={textColor}
      fontSize={fontSize}
      lineHeight={lineHeight}
      headerTitle={headerTitle}
      chapterInfoText={chapterInfoText}
      moveChromeWithPage={moveChromeWithPage}
      topChromeHeight={topChromeHeight}
      bottomChromeHeight={bottomChromeHeight}
      topSafeInset={topSafeInset}
      contentHorizontalPadding={contentHorizontalPadding}
      contentTopPadding={contentTopPadding}
      renderBackIcon={renderBackIcon}
      onBack={onBack}
    />
  ), [
    bottomChromeHeight,
    chapterInfoText,
    contentHorizontalPadding,
    contentTopPadding,
    fontSize,
    headerTitle,
    height,
    lineHeight,
    moveChromeWithPage,
    onBack,
    renderBackIcon,
    textColor,
    themeColor,
    topChromeHeight,
    topSafeInset,
    width,
  ]);

  const captureCurrentPage = useCallback(() => {
    const token = currentCaptureTokenRef.current + 1;
    currentCaptureTokenRef.current = token;
    logSimulation('current capture scheduled', { token, currentImageKey });
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        makeImageFromView(sourcePageRef)
          .then((image) => {
            if (currentCaptureTokenRef.current !== token || !image) {
              logSimulation('current capture discarded', {
                token,
                activeToken: currentCaptureTokenRef.current,
                hasImage: Boolean(image),
                currentImageKey,
              });
              image?.dispose();
              return;
            }
            logSimulation('current capture ready', { token, currentImageKey });
            replaceCurrentImage({ key: currentImageKey, image });
          })
          .catch((error) => {
            logSimulation('current capture failed', {
              token,
              currentImageKey,
              error: String(error),
            });
          });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [currentImageKey, replaceCurrentImage]);

  useEffect(() => {
    if (direction !== 0 || !currentPageData) return;
    if (currentImageRef.current?.key === currentImageKey) {
      logSimulation('current capture reused', { currentImageKey });
      return;
    }
    return captureCurrentPage();
  }, [captureCurrentPage, currentImageKey, currentPageData, direction]);

  useEffect(() => {
    if (direction === 0 || !gestureTargetPage) return;
    const token = targetCaptureTokenRef.current + 1;
    targetCaptureTokenRef.current = token;
    logSimulation('curl capture scheduled', {
      token,
      direction,
      currentImageKey,
      targetImageKey,
      hasReusableCurrent: currentImageRef.current?.key === currentImageKey,
    });
    const firstFrame = requestAnimationFrame(() => {
      const existingCurrent = currentImageRef.current;
      const currentCapture = existingCurrent?.key === currentImageKey
        ? Promise.resolve<SkImage | null>(null)
        : makeImageFromView(sourcePageRef);
      withTimeout(
        Promise.all([currentCapture, makeImageFromView(targetPageRef)]),
        CAPTURE_TIMEOUT,
        ([lateCurrentImage, lateTargetImage]) => {
          lateCurrentImage?.dispose();
          lateTargetImage?.dispose();
        }
      )
        .then(([nextCurrentImage, nextTargetImage]) => {
          if (targetCaptureTokenRef.current !== token) {
            logSimulation('curl capture discarded', {
              token,
              activeToken: targetCaptureTokenRef.current,
              currentImageKey,
              targetImageKey,
            });
            nextCurrentImage?.dispose();
            nextTargetImage?.dispose();
            return;
          }
          if (!nextTargetImage || (!nextCurrentImage && currentImageRef.current?.key !== currentImageKey)) {
            logSimulation('curl capture incomplete', {
              token,
              hasCurrentImage: Boolean(nextCurrentImage),
              hasTargetImage: Boolean(nextTargetImage),
              cachedCurrentKey: currentImageRef.current?.key,
              currentImageKey,
              targetImageKey,
            });
            nextCurrentImage?.dispose();
            nextTargetImage?.dispose();
            captureFailureRef.current();
            return;
          }
          if (nextCurrentImage) {
            currentCaptureTokenRef.current += 1;
            replaceCurrentImage({ key: currentImageKey, image: nextCurrentImage });
          }
          replaceTargetImage({ key: targetImageKey, image: nextTargetImage });
          logSimulation('curl capture ready', {
            token,
            currentImageKey,
            targetImageKey,
            recapturedCurrent: Boolean(nextCurrentImage),
          });
        })
        .catch((error) => {
          logSimulation('curl capture failed', {
            token,
            currentImageKey,
            targetImageKey,
            error: String(error),
          });
          if (targetCaptureTokenRef.current === token) {
            captureFailureRef.current();
          }
        });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
    };
  }, [
    currentImageKey,
    direction,
    gestureTargetPage,
    replaceCurrentImage,
    replaceTargetImage,
    targetImageKey,
  ]);

  useEffect(() => () => {
    currentCaptureTokenRef.current += 1;
    targetCaptureTokenRef.current += 1;
    if (commitFrameRef.current !== null) cancelAnimationFrame(commitFrameRef.current);
    if (secondCommitFrameRef.current !== null) cancelAnimationFrame(secondCommitFrameRef.current);
    if (canvasWarmupFrameRef.current !== null) cancelAnimationFrame(canvasWarmupFrameRef.current);
    if (secondCanvasWarmupFrameRef.current !== null) cancelAnimationFrame(secondCanvasWarmupFrameRef.current);
    if (animationWatchdogRef.current !== null) clearTimeout(animationWatchdogRef.current);
    currentImageRef.current?.image.dispose();
    targetImageRef.current?.image.dispose();
  }, []);

  const clearGestureState = useCallback(() => {
    logSimulation('clear state', {
      activeDirection: activeDirection.value,
      isAnimating: isAnimating.value,
      pendingAnimation: pendingAnimationRef.current,
      pendingPageRequest: pendingPageRequestRef.current,
      cachedCurrentKey: currentImageRef.current?.key,
      cachedTargetKey: targetImageRef.current?.key,
    });
    progress.value = 0;
    currentCaptureTokenRef.current += 1;
    targetCaptureTokenRef.current += 1;
    activeDirection.value = 0;
    flipStarted.value = false;
    gestureEndedNormally.value = false;
    isAnimating.value = false;
    pendingAnimationRef.current = null;
    pendingPageRequestRef.current = null;
    if (commitFrameRef.current !== null) cancelAnimationFrame(commitFrameRef.current);
    if (secondCommitFrameRef.current !== null) cancelAnimationFrame(secondCommitFrameRef.current);
    if (canvasWarmupFrameRef.current !== null) cancelAnimationFrame(canvasWarmupFrameRef.current);
    if (secondCanvasWarmupFrameRef.current !== null) cancelAnimationFrame(secondCanvasWarmupFrameRef.current);
    commitFrameRef.current = null;
    secondCommitFrameRef.current = null;
    canvasWarmupFrameRef.current = null;
    secondCanvasWarmupFrameRef.current = null;
    if (animationWatchdogRef.current !== null) {
      clearTimeout(animationWatchdogRef.current);
      animationWatchdogRef.current = null;
    }
    setCanvasMounted(false);
    setCanvasPresented(false);
    setDirection(0);
    setGestureSourcePage(null);
    setGestureTargetPage(null);
    setSettlingPage(null);
    releaseTargetImage();
  }, [activeDirection, flipStarted, gestureEndedNormally, isAnimating, progress, releaseTargetImage]);

  const armAnimationWatchdog = useCallback((stage: string) => {
    if (animationWatchdogRef.current !== null) {
      clearTimeout(animationWatchdogRef.current);
    }
    animationWatchdogRef.current = setTimeout(() => {
      animationWatchdogRef.current = null;
      logSimulation('watchdog forced unlock', {
        stage,
        activeDirection: activeDirection.value,
        isAnimating: isAnimating.value,
        pendingAnimation: pendingAnimationRef.current,
        cachedCurrentKey: currentImageRef.current?.key,
        cachedTargetKey: targetImageRef.current?.key,
      });
      clearGestureState();
    }, ANIMATION_WATCHDOG_TIMEOUT);
    logSimulation('watchdog armed', { stage, timeout: ANIMATION_WATCHDOG_TIMEOUT });
  }, [activeDirection, clearGestureState, isAnimating]);

  const handleCaptureFailure = useCallback(() => {
    const shouldCommit = pendingAnimationRef.current?.commit === true;
    const targetPage = gestureTargetPage;
    logSimulation('capture fallback', {
      shouldCommit,
      currentPage,
      direction,
      sourceKey: getPageIdentity(currentPageData),
      targetKey: getPageIdentity(targetPage ?? undefined),
      recovery: 'stay on current page',
    });
    clearGestureState();
  }, [clearGestureState, currentPage, currentPageData, direction, gestureTargetPage]);

  captureFailureRef.current = handleCaptureFailure;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        clearGestureState();
      }
    });
    return () => subscription.remove();
  }, [clearGestureState]);

  useEffect(() => {
    if (!settlingPage || !isSamePage(settlingPage, currentPageData)) return;
    logSimulation('settling page matched', {
      currentPage,
      currentPageKey: getPageIdentity(currentPageData),
      settlingPageKey: getPageIdentity(settlingPage),
    });
    promoteTargetImageToCurrent();
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(clearGestureState);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [clearGestureState, currentPage, currentPageData, promoteTargetImageToCurrent, settlingPage]);

  const prepareCurl = useCallback((nextDirection: Exclude<CurlDirection, 0>) => {
    const nextPageIndex = currentPage + nextDirection;
    const nextPage = pages[nextPageIndex];
    if (!currentPageData || !nextPage) {
      logSimulation('prepare rejected', {
        currentPage,
        nextPageIndex,
        direction: nextDirection,
        pagesLength: pages.length,
        hasCurrentPage: Boolean(currentPageData),
        hasNextPage: Boolean(nextPage),
      });
      return false;
    }
    logSimulation('prepare curl', {
      currentPage,
      nextPageIndex,
      direction: nextDirection,
      sourceKey: getPageIdentity(currentPageData),
      targetKey: getPageIdentity(nextPage),
      cachedCurrentKey: currentImageRef.current?.key,
    });
    pendingAnimationRef.current = null;
    activeDirection.value = nextDirection;
    progress.value = nextDirection === 1 ? 0 : 1;
    setCanvasMounted(false);
    setCanvasPresented(false);
    setGestureSourcePage(currentPageData);
    setGestureTargetPage(nextPage);
    setDirection(nextDirection);
    return true;
  }, [
    activeDirection,
    currentPage,
    currentPageData,
    pages,
    progress,
  ]);

  const queuePageRequest = useCallback((nextDirection: Exclude<CurlDirection, 0>) => {
    if (!currentPageData) {
      logSimulation('page request skipped', { direction: nextDirection, reason: 'missing current page' });
      return;
    }
    const pendingRequest = pendingPageRequestRef.current;
    if (pendingRequest?.direction === nextDirection && pendingRequest.sourceKey === currentPageIdentity) {
      logSimulation('page request already queued', {
        direction: nextDirection,
        currentPage,
        sourceKey: currentPageIdentity,
      });
      return;
    }
    pendingPageRequestRef.current = {
      direction: nextDirection,
      sourceKey: currentPageIdentity,
    };
    logSimulation('page request queued', {
      direction: nextDirection,
      currentPage,
      sourceKey: currentPageIdentity,
      pagesLength: pages.length,
    });
    onPageChange(currentPage + nextDirection);
  }, [currentPage, currentPageData, currentPageIdentity, onPageChange, pages.length]);

  const handleCommitDone = useCallback(() => {
    if (!gestureTargetPage || direction === 0) {
      logSimulation('commit aborted', {
        reason: 'missing target or direction',
        direction,
        hasTargetPage: Boolean(gestureTargetPage),
      });
      clearGestureState();
      return;
    }
    logSimulation('commit animation complete', {
      currentPage,
      nextPage: currentPage + direction,
      direction,
      targetKey: getPageIdentity(gestureTargetPage),
    });
    commitFrameRef.current = requestAnimationFrame(() => {
      secondCommitFrameRef.current = requestAnimationFrame(() => {
        commitFrameRef.current = null;
        secondCommitFrameRef.current = null;
        setSettlingPage(gestureTargetPage);
        onPageChange(currentPage + direction);
      });
    });
  }, [clearGestureState, currentPage, direction, gestureTargetPage, onPageChange]);

  const animateCurl = useCallback((nextDirection: Exclude<CurlDirection, 0>, commit: boolean) => {
    logSimulation('animation start', {
      direction: nextDirection,
      commit,
      cachedCurrentKey: currentImageRef.current?.key,
      cachedTargetKey: targetImageRef.current?.key,
    });
    armAnimationWatchdog('animation running');
    isAnimating.value = true;
    const targetProgress = commit
      ? (nextDirection === 1 ? 1 : 0)
      : (nextDirection === 1 ? 0 : 1);
    progress.value = withTiming(
      targetProgress,
      { duration: commit ? FLIP_DURATION : RESET_DURATION },
      (finished) => {
        runOnJS(logSimulation)('animation end', {
          direction: nextDirection,
          commit,
          finished,
        });
        if (!finished) {
          runOnJS(clearGestureState)();
          return;
        }
        if (commit) {
          runOnJS(handleCommitDone)();
        } else {
          runOnJS(clearGestureState)();
        }
      }
    );
  }, [armAnimationWatchdog, clearGestureState, handleCommitDone, isAnimating, progress]);

  const finishCurl = useCallback((nextDirection: Exclude<CurlDirection, 0>, commit: boolean) => {
    const hasCurrentImage = currentImageRef.current?.key === currentImageKey;
    const hasTargetImage = targetImageRef.current?.key === targetImageKey;
    logSimulation('finish requested', {
      direction: nextDirection,
      commit,
      hasCurrentImage,
      hasTargetImage,
      canvasMounted,
      currentImageKey,
      cachedCurrentKey: currentImageRef.current?.key,
      targetImageKey,
      cachedTargetKey: targetImageRef.current?.key,
    });
    armAnimationWatchdog('finish requested');
    if (!hasCurrentImage || !hasTargetImage || !canvasMounted) {
      if (!commit) {
        logSimulation('finish reset without canvas', { direction: nextDirection });
        clearGestureState();
        return;
      }
      progress.value = nextDirection === 1 ? 0 : 1;
      pendingAnimationRef.current = { direction: nextDirection, commit };
      logSimulation('animation waiting for canvas', {
        direction: nextDirection,
        hasCurrentImage,
        hasTargetImage,
        canvasMounted,
      });
      return;
    }
    pendingAnimationRef.current = null;
    animateCurl(nextDirection, commit);
  }, [
    animateCurl,
    armAnimationWatchdog,
    canvasMounted,
    clearGestureState,
    currentImageKey,
    progress,
    targetImageKey,
  ]);

  useEffect(() => {
    if (!shaderReady) return;
    if (!canvasMounted) {
      const pendingAnimation = pendingAnimationRef.current;
      logSimulation('canvas mount requested', {
        direction,
        pendingAnimation,
        currentImageKey,
        targetImageKey,
      });
      if (pendingAnimation) {
        progress.value = pendingAnimation.direction === 1 ? 0 : 1;
      }
      setCanvasMounted(true);
      return;
    }
    if (!pendingAnimationRef.current) {
      logSimulation('canvas presented for drag', { direction, currentImageKey, targetImageKey });
      setCanvasPresented(true);
      return;
    }
    const pendingAnimation = pendingAnimationRef.current;
    pendingAnimationRef.current = null;
    logSimulation('canvas warmup start', {
      direction: pendingAnimation.direction,
      commit: pendingAnimation.commit,
      currentImageKey,
      targetImageKey,
    });
    progress.value = pendingAnimation.direction === 1 ? 0 : 1;
    canvasWarmupFrameRef.current = requestAnimationFrame(() => {
      setCanvasPresented(true);
      secondCanvasWarmupFrameRef.current = requestAnimationFrame(() => {
        canvasWarmupFrameRef.current = null;
        secondCanvasWarmupFrameRef.current = null;
        logSimulation('canvas warmup complete', {
          direction: pendingAnimation.direction,
          commit: pendingAnimation.commit,
        });
        animateCurl(pendingAnimation.direction, pendingAnimation.commit);
      });
    });
  }, [animateCurl, canvasMounted, progress, shaderReady]);

  useEffect(() => {
    const pendingRequest = pendingPageRequestRef.current;
    if (!pendingRequest || isAnimating.value || !currentPageData) return;
    if (pendingRequest.sourceKey !== currentPageIdentity) {
      logSimulation('page request discarded', {
        reason: 'source changed',
        pendingRequest,
        currentPageKey: currentPageIdentity,
      });
      pendingPageRequestRef.current = null;
      return;
    }
    if (!pages[currentPage + pendingRequest.direction]) {
      logSimulation('page request still waiting', {
        pendingRequest,
        currentPage,
        pagesLength: pages.length,
      });
      return;
    }
    pendingPageRequestRef.current = null;
    if (!prepareCurl(pendingRequest.direction)) {
      logSimulation('page request prepare failed', { pendingRequest, currentPage });
      return;
    }
    logSimulation('page request resumed', { pendingRequest, currentPage });
    onFlipStart?.();
    isAnimating.value = true;
    pendingAnimationRef.current = { direction: pendingRequest.direction, commit: true };
    armAnimationWatchdog('queued page request resumed');
  }, [
    armAnimationWatchdog,
    currentPage,
    currentPageData,
    currentPageIdentity,
    isAnimating,
    onFlipStart,
    pages,
    prepareCurl,
  ]);

  const handleDirectionalFlip = useCallback((nextDirection: Exclude<CurlDirection, 0>) => {
    logSimulation('directional flip requested', {
      direction: nextDirection,
      currentPage,
      currentPageKey: currentPageIdentity,
      isAnimating: isAnimating.value,
    });
    if (!prepareCurl(nextDirection)) {
      queuePageRequest(nextDirection);
      return;
    }
    onFlipStart?.();
    isAnimating.value = true;
    pendingAnimationRef.current = { direction: nextDirection, commit: true };
    armAnimationWatchdog('directional flip requested');
  }, [
    armAnimationWatchdog,
    currentPage,
    currentPageData,
    currentPageIdentity,
    isAnimating,
    onFlipStart,
    prepareCurl,
    queuePageRequest,
  ]);

  const handleTap = useCallback((x: number) => {
    const nextDirection = getTapDirection(x, width);
    logSimulation('tap', { x, width, direction: nextDirection, currentPage });
    if (nextDirection === 0) {
      onTapCenter?.();
      return;
    }
    handleDirectionalFlip(nextDirection);
  }, [currentPage, handleDirectionalFlip, onTapCenter, width]);

  const gesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .minDistance(2)
      .onStart(() => {
        if (isAnimating.value) {
          runOnJS(logSimulation)('gesture start blocked', {
            reason: 'animation locked',
            currentPage,
            activeDirection: activeDirection.value,
          });
          return;
        }
        gestureEndedNormally.value = false;
        activeDirection.value = 0;
        flipStarted.value = false;
        progress.value = 0;
        runOnJS(logSimulation)('gesture start', {
          currentPage,
          pagesLength: pages.length,
        });
      })
      .onUpdate((event) => {
        if (isAnimating.value) return;
        let nextDirection = activeDirection.value;
        if (nextDirection === 0) {
          const horizontalTravel = Math.abs(event.translationX);
          const verticalTravel = Math.abs(event.translationY);
          if (
            horizontalTravel < DIRECTION_ACTIVATION_DISTANCE ||
            horizontalTravel < verticalTravel
          ) {
            return;
          }
          const inferredDirection: Exclude<CurlDirection, 0> = event.translationX < 0 ? 1 : -1;
          nextDirection = inferredDirection;
          const nextPageIndex = currentPage + nextDirection;
          if (nextPageIndex < 0 || nextPageIndex >= pages.length) return;
          activeDirection.value = nextDirection;
          flipStarted.value = false;
          progress.value = nextDirection === 1 ? 0 : 1;
          runOnJS(logSimulation)('gesture direction activated', {
            currentPage,
            nextPageIndex,
            direction: nextDirection,
            translationX: event.translationX,
            translationY: event.translationY,
          });
          runOnJS(prepareCurl)(inferredDirection);
        }
        const travel = nextDirection === 1 ? -event.translationX : event.translationX;
        const normalizedTravel = clamp((travel / width) * DRAG_SENSITIVITY, 0, 1);
        progress.value = nextDirection === 1 ? normalizedTravel : 1 - normalizedTravel;
        if (!flipStarted.value && travel > TAP_MOVE_TOLERANCE) {
          flipStarted.value = true;
          if (onFlipStart) runOnJS(onFlipStart)();
        }
      })
      .onEnd((event) => {
        let nextDirection = activeDirection.value;
        if (isAnimating.value) {
          runOnJS(logSimulation)('gesture end blocked', {
            reason: 'animation locked',
            currentPage,
            activeDirection: nextDirection,
            translationX: event.translationX,
            velocityX: event.velocityX,
          });
          return;
        }
        if (nextDirection === 0) {
          const horizontalTravel = Math.abs(event.translationX);
          const horizontalVelocity = Math.abs(event.velocityX);
          const verticalTravel = Math.abs(event.translationY);
          const verticalVelocity = Math.abs(event.velocityY);
          const hasHorizontalTravel =
            horizontalTravel >= DIRECTION_ACTIVATION_DISTANCE &&
            horizontalTravel >= verticalTravel;
          const hasHorizontalFlick =
            horizontalVelocity >= SWIPE_VELOCITY_THRESHOLD &&
            horizontalVelocity >= verticalVelocity;
          if (!hasHorizontalTravel && !hasHorizontalFlick) {
            runOnJS(logSimulation)('gesture end ignored', {
              reason: 'insufficient horizontal intent',
              currentPage,
              translationX: event.translationX,
              translationY: event.translationY,
              velocityX: event.velocityX,
              velocityY: event.velocityY,
            });
            return;
          }
          const directionSignal = hasHorizontalFlick ? event.velocityX : event.translationX;
          const inferredDirection: Exclude<CurlDirection, 0> = directionSignal < 0 ? 1 : -1;
          nextDirection = inferredDirection;
          gestureEndedNormally.value = true;
          runOnJS(logSimulation)('gesture end fast fallback', {
            currentPage,
            direction: inferredDirection,
            translationX: event.translationX,
            translationY: event.translationY,
            velocityX: event.velocityX,
            velocityY: event.velocityY,
          });
          runOnJS(handleDirectionalFlip)(inferredDirection);
          return;
        }
        const travel = nextDirection === 1 ? -event.translationX : event.translationX;
        const velocity = nextDirection === 1 ? -event.velocityX : event.velocityX;
        const shouldCommit =
          travel >= width * SWIPE_THRESHOLD_RATIO || velocity >= SWIPE_VELOCITY_THRESHOLD;
        gestureEndedNormally.value = true;
        isAnimating.value = true;
        runOnJS(logSimulation)('gesture end decision', {
          currentPage,
          direction: nextDirection,
          travel,
          velocity,
          threshold: width * SWIPE_THRESHOLD_RATIO,
          shouldCommit,
        });
        if (shouldCommit && !flipStarted.value && onFlipStart) {
          runOnJS(onFlipStart)();
        }
        runOnJS(finishCurl)(nextDirection, shouldCommit);
      })
      .onFinalize((_event, success) => {
        runOnJS(logSimulation)('gesture finalized', {
          currentPage,
          success,
          activeDirection: activeDirection.value,
          endedNormally: gestureEndedNormally.value,
          isAnimating: isAnimating.value,
        });
        flipStarted.value = false;
        if (!gestureEndedNormally.value && activeDirection.value !== 0 && !isAnimating.value) {
          runOnJS(clearGestureState)();
        }
      });

    const tapGesture = Gesture.Tap()
      .maxDistance(TAP_MOVE_TOLERANCE)
      .onEnd((event, success) => {
        if (!success || isAnimating.value) {
          runOnJS(logSimulation)('tap ignored', {
            success,
            isAnimating: isAnimating.value,
            currentPage,
          });
          return;
        }
        runOnJS(handleTap)(event.x);
      });

    return Gesture.Exclusive(panGesture, tapGesture);
  }, [
    activeDirection,
    currentPage,
    finishCurl,
    flipStarted,
    gestureEndedNormally,
    handleDirectionalFlip,
    handleTap,
    isAnimating,
    onFlipStart,
    pages.length,
    prepareCurl,
    progress,
    width,
  ]);

  const gestureLayerStyle = [
    styles.gestureLayer,
    moveChromeWithPage && {
      top: topChromeHeight,
      bottom: bottomChromeHeight,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: themeColor }]}>
      {direction !== 0 && gestureTargetPage ? (
        <View
          pointerEvents="none"
          style={[styles.pageLayer, styles.captureLayer]}
        >
          <Animated.View
            ref={targetPageRef}
            collapsable={false}
            renderToHardwareTextureAndroid
            style={styles.pageLayer}
          >
            {renderPageFrame(gestureTargetPage)}
          </Animated.View>
        </View>
      ) : null}

      {direction !== 0 ? (
        <View
          pointerEvents="none"
          style={[styles.pageLayer, styles.captureShield, { backgroundColor: themeColor }]}
        />
      ) : null}

      <Animated.View
        ref={sourcePageRef}
        collapsable={false}
        style={[styles.pageLayer, styles.sourceLayer]}
      >
        {renderPageFrame(displayPage)}
      </Animated.View>

      {shaderReady && canvasMounted && fromImage && toImage ? (
        <Canvas
          pointerEvents="none"
          style={[
            styles.pageLayer,
            styles.curlCanvas,
            !canvasPresented && styles.hiddenCanvas,
          ]}
        >
          <Fill>
            <Shader source={effect} uniforms={uniforms}>
              <ImageShader image={fromImage} fit="cover" width={width} height={height} />
              <ImageShader image={toImage} fit="cover" width={width} height={height} />
            </Shader>
          </Fill>
        </Canvas>
      ) : null}

      {settlingPage ? (
        <View pointerEvents="none" style={[styles.pageLayer, styles.settleLayer]}>
          {renderPageFrame(settlingPage)}
        </View>
      ) : null}

      <GestureDetector gesture={gesture}>
        <Animated.View style={gestureLayerStyle} />
      </GestureDetector>

      {direction === 0 && !settlingPage && currentPageData?.locked && lockedOverlay ? (
        <View pointerEvents="box-none" style={styles.lockedOverlay}>
          {lockedOverlay}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  pageLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  captureLayer: {
    zIndex: 0,
  },
  captureShield: {
    zIndex: 1,
  },
  sourceLayer: {
    zIndex: 2,
  },
  curlCanvas: {
    zIndex: 5,
  },
  hiddenCanvas: {
    opacity: 0,
  },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  settleLayer: {
    zIndex: 10,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
});
