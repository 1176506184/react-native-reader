import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { PageData, ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';

const FLIP_DURATION = 170;
const EDGE_SHADOW_MIN_WIDTH = 56;
const EDGE_SHADOW_MAX_WIDTH = 96;
const EDGE_SHADOW_COLORS = [
  'rgba(0, 0, 0, 0.26)',
  'rgba(0, 0, 0, 0.15)',
  'rgba(0, 0, 0, 0.06)',
  'rgba(0, 0, 0, 0)',
] as const;
const EDGE_SHADOW_LOCATIONS = [0, 0.22, 0.58, 1] as const;
const LEFT_EDGE_GRADIENT_START = { x: 0, y: 0 };
const LEFT_EDGE_GRADIENT_END = { x: 1, y: 0 };
const RIGHT_EDGE_GRADIENT_START = { x: 1, y: 0 };
const RIGHT_EDGE_GRADIENT_END = { x: 0, y: 0 };

export const CoverFlip: React.FC<ReaderFlipBaseProps> = ({
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
  renderBackIcon,
  onBack,
  lockedOverlay,
}) => {
  const progress = useSharedValue(0);
  const activeDirection = useSharedValue<1 | -1 | 0>(0);
  const flipStarted = useSharedValue(false);
  const gestureEndedNormally = useSharedValue(false);
  const isAnimating = useSharedValue(false);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [sourcePage, setSourcePage] = useState(currentPage);
  const [settlingPageData, setSettlingPageData] = useState<PageData | null>(null);
  const pendingCommitPageRef = useRef<PageData | null>(null);

  const targetPage = useMemo(() => {
    if (direction === -1) return pages[sourcePage + 1];
    if (direction === 1) return pages[sourcePage - 1];
    return undefined;
  }, [direction, pages, sourcePage]);
  const displayPage = direction === 0 ? pages[currentPage] : pages[sourcePage];

  const renderPageFrame = (page?: (typeof pages)[number]) => (
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
  );

  const clearGestureState = useCallback((pageIndex = currentPage) => {
    progress.value = 0;
    activeDirection.value = 0;
    flipStarted.value = false;
    gestureEndedNormally.value = false;
    isAnimating.value = false;
    pendingCommitPageRef.current = null;
    setDirection(0);
    setSourcePage(pageIndex);
  }, [activeDirection, currentPage, flipStarted, gestureEndedNormally, isAnimating, progress]);

  useEffect(() => {
    const currentPageData = pages[currentPage];
    const isSettledOnCurrentPage =
      settlingPageData &&
      currentPageData &&
      settlingPageData.chapterId === currentPageData.chapterId &&
      (settlingPageData.chapterPageIndex ?? settlingPageData.index) ===
        (currentPageData.chapterPageIndex ?? currentPageData.index);

    if (isSettledOnCurrentPage) {
      let hideFrame: number | null = null;
      const clearFrame = requestAnimationFrame(() => {
        clearGestureState(currentPage);
        hideFrame = requestAnimationFrame(() => {
          setSettlingPageData(null);
        });
      });
      return () => {
        cancelAnimationFrame(clearFrame);
        if (hideFrame !== null) {
          cancelAnimationFrame(hideFrame);
        }
      };
    }

    if (direction === 0) {
      setSourcePage(currentPage);
    }
  }, [clearGestureState, currentPage, direction, pages, settlingPageData]);

  const handleCommitDone = useCallback(
    (nextPage: number) => {
      const committedPage = pendingCommitPageRef.current || pages[nextPage];
      setSettlingPageData(committedPage || null);
      pendingCommitPageRef.current = null;
      onPageChange(nextPage, committedPage);
    },
    [onPageChange, pages]
  );

  const commit = useCallback(
    (nextDirection: 1 | -1) => {
      const nextPage = currentPage + (nextDirection === -1 ? 1 : -1);

      if (nextPage < 0 || nextPage >= pages.length) {
        clearGestureState(currentPage);
        onPageChange(nextPage);
        return;
      }

      isAnimating.value = true;
      pendingCommitPageRef.current = pages[nextPage] || null;
      progress.value = withTiming(1, { duration: FLIP_DURATION }, (finished) => {
        if (finished) {
          runOnJS(handleCommitDone)(nextPage);
        }
      });
    },
    [clearGestureState, currentPage, handleCommitDone, isAnimating, onPageChange, pages.length, progress]
  );

  const reset = useCallback(() => {
    progress.value = withTiming(0, { duration: 160 }, () => {
      activeDirection.value = 0;
      flipStarted.value = false;
      isAnimating.value = false;
      runOnJS(setDirection)(0);
    });
  }, [activeDirection, flipStarted, isAnimating, progress]);

  const beginDirection = useCallback(
    (nextDirection: 1 | -1) => {
      activeDirection.value = nextDirection;
      progress.value = 0;
      setSourcePage(currentPage);
      setDirection(nextDirection);
    },
    [activeDirection, currentPage, progress]
  );

  const setTransitionDirection = useCallback(
    (nextDirection: 1 | -1 | 0) => {
      if (nextDirection !== 0) {
        setSourcePage(currentPage);
      }
      setDirection(nextDirection);
    },
    [currentPage]
  );

  const handleTap = useCallback(
    (x: number) => {
      if (x < width / 3) {
        onFlipStart?.();
        beginDirection(1);
        requestAnimationFrame(() => commit(1));
        return;
      }

      if (x > (width * 2) / 3) {
        onFlipStart?.();
        beginDirection(-1);
        requestAnimationFrame(() => commit(-1));
        return;
      }

      onTapCenter?.();
      clearGestureState();
    },
    [beginDirection, clearGestureState, commit, onFlipStart, onTapCenter, width]
  );

  const gesture = useMemo(() => {
    const updateDirection = (nextDirection: 1 | -1 | 0) => {
      'worklet';
      if (activeDirection.value !== nextDirection) {
        activeDirection.value = nextDirection;
        runOnJS(setTransitionDirection)(nextDirection);
      }
    };

    const panGesture = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-24, 24])
      .onBegin(() => {
        gestureEndedNormally.value = false;
      })
      .onUpdate((event) => {
        if (isAnimating.value) {
          return;
        }
        const dx = event.translationX;
        if (!flipStarted.value && Math.abs(dx) > 6) {
          flipStarted.value = true;
          if (onFlipStart) {
            runOnJS(onFlipStart)();
          }
        }

        if (dx < 0) {
          updateDirection(-1);
          progress.value = Math.min(Math.max(-dx / width, 0), 1);
          return;
        }

        if (dx > 0) {
          updateDirection(1);
          progress.value = Math.min(Math.max(dx / width, 0), 1);
          return;
        }

        updateDirection(0);
        progress.value = 0;
      })
      .onEnd(() => {
        if (isAnimating.value) {
          return;
        }
        gestureEndedNormally.value = true;
        const nextDirection = activeDirection.value;
        if (progress.value > 0.22 && nextDirection !== 0) {
          runOnJS(commit)(nextDirection);
          return;
        }
        runOnJS(reset)();
      })
      .onFinalize(() => {
        flipStarted.value = false;
        if (!gestureEndedNormally.value && activeDirection.value !== 0 && !isAnimating.value) {
          runOnJS(clearGestureState)();
        }
      });

    const tapGesture = Gesture.Tap()
      .maxDistance(12)
      .onEnd((event, success) => {
        if (isAnimating.value) {
          return;
        }
        if (success) {
          runOnJS(handleTap)(event.x);
        }
      });

    return Gesture.Exclusive(panGesture, tapGesture);
  }, [activeDirection, clearGestureState, commit, flipStarted, gestureEndedNormally, handleTap, isAnimating, onFlipStart, progress, reset, setTransitionDirection, width]);

  const targetPageStyle = useAnimatedStyle(() => {
    const translateX =
      activeDirection.value === -1
        ? width * (1 - progress.value)
        : -width * (1 - progress.value);
    return {
      transform: [{ translateX }],
    };
  }, [width]);

  const edgeShadowWidth = Math.max(EDGE_SHADOW_MIN_WIDTH, Math.min(EDGE_SHADOW_MAX_WIDTH, width * 0.18));
  const edgeShadowSideStyle = direction === -1 ? { left: -edgeShadowWidth } : { right: -edgeShadowWidth };
  const edgeShadowStart = direction === -1 ? RIGHT_EDGE_GRADIENT_START : LEFT_EDGE_GRADIENT_START;
  const edgeShadowEnd = direction === -1 ? RIGHT_EDGE_GRADIENT_END : LEFT_EDGE_GRADIENT_END;
  const edgeShadowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(0.98, 0.42 + progress.value * 0.56),
  }));

  const gestureLayerStyle = [
    styles.gestureLayer,
    moveChromeWithPage && {
      top: topChromeHeight,
      bottom: bottomChromeHeight,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.pageLayer}>{renderPageFrame(displayPage)}</View>
      {direction !== 0 && targetPage ? (
        <Animated.View style={[styles.pageLayer, targetPageStyle]}>
          {renderPageFrame(targetPage)}
          <Animated.View pointerEvents="none" style={[styles.edgeShadow, edgeShadowSideStyle, { width: edgeShadowWidth }, edgeShadowStyle]}>
            <LinearGradient
              colors={EDGE_SHADOW_COLORS}
              locations={EDGE_SHADOW_LOCATIONS}
              start={edgeShadowStart}
              end={edgeShadowEnd}
              style={styles.edgeShadowGradient}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
      {settlingPageData ? (
        <View pointerEvents="none" style={[styles.pageLayer, styles.settleLayer]}>
          {renderPageFrame(settlingPageData)}
        </View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View style={gestureLayerStyle} />
      </GestureDetector>
      {direction === 0 && !settlingPageData && displayPage?.locked && lockedOverlay ? (
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
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  settleLayer: {
    zIndex: 30,
  },
  edgeShadow: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  edgeShadowGradient: {
    flex: 1,
  },
});
