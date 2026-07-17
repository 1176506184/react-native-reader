import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { PageData, ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';

const FLIP_DURATION = 170;

export const SlideFlip: React.FC<ReaderFlipBaseProps> = ({
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
  const dragX = useSharedValue(0);
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
    dragX.value = 0;
    activeDirection.value = 0;
    flipStarted.value = false;
    gestureEndedNormally.value = false;
    isAnimating.value = false;
    pendingCommitPageRef.current = null;
    setDirection(0);
    setSourcePage(pageIndex);
  }, [activeDirection, currentPage, dragX, flipStarted, gestureEndedNormally, isAnimating]);

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

  const commitFlip = useCallback(
    (nextDirection: 1 | -1) => {
      const nextPage = currentPage + (nextDirection === -1 ? 1 : -1);

      if (nextPage < 0 || nextPage >= pages.length) {
        clearGestureState(currentPage);
        onPageChange(nextPage);
        return;
      }

      isAnimating.value = true;
      const toValue = nextDirection === -1 ? -width : width;
      pendingCommitPageRef.current = pages[nextPage] || null;
      dragX.value = withTiming(toValue, { duration: FLIP_DURATION }, (finished) => {
        if (finished) {
          runOnJS(handleCommitDone)(nextPage);
        }
      });
    },
    [clearGestureState, currentPage, dragX, handleCommitDone, isAnimating, onPageChange, pages.length, width]
  );

  const resetFlip = useCallback(() => {
    dragX.value = withTiming(0, { duration: 160 }, () => {
      activeDirection.value = 0;
      flipStarted.value = false;
      isAnimating.value = false;
      runOnJS(setDirection)(0);
    });
  }, [activeDirection, dragX, flipStarted, isAnimating]);

  const beginDirection = useCallback(
    (nextDirection: 1 | -1) => {
      activeDirection.value = nextDirection;
      dragX.value = 0;
      setSourcePage(currentPage);
      setDirection(nextDirection);
    },
    [activeDirection, currentPage, dragX]
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
        requestAnimationFrame(() => commitFlip(1));
        return;
      }

      if (x > (width * 2) / 3) {
        onFlipStart?.();
        beginDirection(-1);
        requestAnimationFrame(() => commitFlip(-1));
        return;
      }

      onTapCenter?.();
      clearGestureState();
    },
    [beginDirection, clearGestureState, commitFlip, onFlipStart, onTapCenter, width]
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
        } else if (dx > 0) {
          updateDirection(1);
        } else {
          updateDirection(0);
        }

        dragX.value = dx;
      })
      .onEnd((event) => {
        if (isAnimating.value) {
          return;
        }
        gestureEndedNormally.value = true;
        const threshold = width * 0.2;
        if (event.translationX <= -threshold && activeDirection.value === -1) {
          runOnJS(commitFlip)(-1);
          return;
        }
        if (event.translationX >= threshold && activeDirection.value === 1) {
          runOnJS(commitFlip)(1);
          return;
        }
        runOnJS(resetFlip)();
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
  }, [activeDirection, clearGestureState, commitFlip, dragX, flipStarted, gestureEndedNormally, handleTap, isAnimating, onFlipStart, resetFlip, setTransitionDirection, width]);

  const currentPageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  const targetPageStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: dragX.value + (activeDirection.value === -1 ? width : -width),
        },
      ],
    }),
    [width]
  );

  const gestureLayerStyle = [
    styles.gestureLayer,
    moveChromeWithPage && {
      top: topChromeHeight,
      bottom: bottomChromeHeight,
    },
  ];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pageLayer, currentPageStyle]}>{renderPageFrame(displayPage)}</Animated.View>
      {direction !== 0 && targetPage ? (
        <Animated.View style={[styles.pageLayer, targetPageStyle]}>{renderPageFrame(targetPage)}</Animated.View>
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
});
