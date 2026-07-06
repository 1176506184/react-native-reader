import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import type { ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';

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
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onDone?.();
    });
  };

  const commitFlip = (nextDirection: 1 | -1) => {
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
        progress.setValue(0);
        progressRef.current = 0;
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
              requestAnimationFrame(() => commitFlip(1));
              return;
            }

            if (x > (width * 2) / 3) {
              onFlipStart?.();
              setDirection(-1);
              progressRef.current = 0;
              progress.setValue(0);
              requestAnimationFrame(() => commitFlip(-1));
              return;
            }

            onTapCenter?.();
            progressRef.current = 0;
            progress.setValue(0);
            setDirection(0);
            return;
          }

          if (progressRef.current > 0.2 && direction !== 0) {
            commitFlip(direction);
            return;
          }

          animateTo(0, () => {
            setDirection(0);
          });
        },
      }),
    [currentPage, direction, moveChromeWithPage, onFlipStart, onTapCenter, pages, progress, topChromeHeight, width]
  );

  const shadowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.2],
  });

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === -1 ? ['0deg', '-96deg'] : ['0deg', '96deg'],
  });

  const bendShadeOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.16],
  });

  const bendHighlightOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.18],
  });

  const bendPanelOpacity = progress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 0.16, 0.28],
  });

  const bendPanelRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === -1 ? ['0deg', '-34deg'] : ['0deg', '34deg'],
  });

  const underOpacity = progress.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {direction !== 0 && targetPage ? (
        <Animated.View style={[styles.pageLayer, { opacity: underOpacity }]}>{renderPageFrame(targetPage)}</Animated.View>
      ) : null}
      <Animated.View
        style={[
          styles.pageLayer,
          styles.movingPage,
          {
            transformOrigin: direction === -1 ? 'left center' : 'right center',
            transform: [{ perspective: 1400 }, { rotateY: rotate }],
          },
        ]}
      >
        {renderPageFrame(pages[currentPage])}
        {direction !== 0 ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bendPanel,
                direction === -1 ? { right: 0 } : { left: 0 },
                {
                  width: width * 0.36,
                  backgroundColor: themeColor,
                  opacity: bendPanelOpacity,
                  transformOrigin: direction === -1 ? 'left center' : 'right center',
                  transform: [{ perspective: 1000 }, { rotateY: bendPanelRotate }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bendShade,
                direction === -1 ? { right: width * 0.18 } : { left: width * 0.18 },
                { opacity: bendShadeOpacity },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bendHighlight,
                direction === -1 ? { right: width * 0.34 } : { left: width * 0.34 },
                { opacity: bendHighlightOpacity },
              ]}
            />
          </>
        ) : null}
        <Animated.View style={[styles.shadow, { opacity: shadowOpacity }]} />
      </Animated.View>
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
  movingPage: {
    backfaceVisibility: 'hidden',
  },
  shadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  bendShade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 38,
    backgroundColor: '#000000',
  },
  bendHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 18,
    backgroundColor: '#FFFFFF',
  },
  bendPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
});
