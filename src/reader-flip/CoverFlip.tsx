import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import type { ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';

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
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const progressRef = useRef(0);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);

  const targetPage = useMemo(() => {
    if (direction === -1) return pages[currentPage + 1];
    if (direction === 1) return pages[currentPage - 1];
    return undefined;
  }, [currentPage, direction, pages]);

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

  const animateTo = (toValue: number, onDone?: () => void) => {
    progressRef.current = toValue;
    Animated.timing(progress, {
      toValue,
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      onDone?.();
    });
  };

  const reset = () => {
    animateTo(0, () => {
      setDirection(0);
    });
  };

  const commit = (nextDirection: 1 | -1) => {
    const nextPage = currentPage + (nextDirection === -1 ? 1 : -1);

    if (nextPage < 0 || nextPage >= pages.length) {
      progressRef.current = 0;
      progress.setValue(0);
      setDirection(0);
      onPageChange(nextPage);
      return;
    }

    animateTo(1, () => {
      onPageChange(nextPage, pages[nextPage]);
      requestAnimationFrame(() => {
        progressRef.current = 0;
        progress.setValue(0);
        setDirection(0);
      });
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          if (moveChromeWithPage && topChromeHeight > 0 && event.nativeEvent.locationY <= topChromeHeight) {
            return false;
          }
          return true;
        },
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 6 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 6) {
            onFlipStart?.();
          }

          const dx = gestureState.dx;
          if (dx < 0) {
            setDirection(-1);
            const nextProgress = Math.min(Math.max(-dx / width, 0), 1);
            progressRef.current = nextProgress;
            progress.setValue(nextProgress);
            return;
          }

          if (dx > 0) {
            setDirection(1);
            const nextProgress = Math.min(Math.max(dx / width, 0), 1);
            progressRef.current = nextProgress;
            progress.setValue(nextProgress);
            return;
          }

          setDirection(0);
          progressRef.current = 0;
          progress.setValue(0);
        },
        onPanResponderRelease: (event, gestureState) => {
          const isTap = Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5;

          if (isTap) {
            const x = event.nativeEvent.locationX;
            if (x < width / 3) {
              onFlipStart?.();
              setDirection(1);
              progressRef.current = 0;
              progress.setValue(0);
              requestAnimationFrame(() => commit(1));
              return;
            }

            if (x > (width * 2) / 3) {
              onFlipStart?.();
              setDirection(-1);
              progressRef.current = 0;
              progress.setValue(0);
              requestAnimationFrame(() => commit(-1));
              return;
            }

            onTapCenter?.();
            progressRef.current = 0;
            progress.setValue(0);
            setDirection(0);
            return;
          }

          if (progressRef.current > 0.22 && direction !== 0) {
            commit(direction);
            return;
          }

          reset();
        },
      }),
    [currentPage, direction, moveChromeWithPage, onFlipStart, onTapCenter, pages, progress, topChromeHeight, width]
  );

  const enterFromRight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  const enterFromLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, 0],
  });

  const shadowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.18],
  });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.pageLayer}>{renderPageFrame(pages[currentPage])}</View>
      {direction !== 0 && targetPage ? (
        <Animated.View
          style={[
            styles.pageLayer,
            {
              transform: [{ translateX: direction === -1 ? enterFromRight : enterFromLeft }],
            },
          ]}
        >
          {renderPageFrame(targetPage)}
          <Animated.View style={[styles.shadow, { opacity: shadowOpacity }]} />
        </Animated.View>
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
  shadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
});
