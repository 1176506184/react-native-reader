import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import type { ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';

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
}) => {
  const dragX = useRef(new Animated.Value(0)).current;
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

  const commitFlip = (nextDirection: 1 | -1) => {
    const nextPage = currentPage + (nextDirection === -1 ? 1 : -1);

    if (nextPage < 0 || nextPage >= pages.length) {
      dragX.setValue(0);
      setDirection(0);
      onPageChange(nextPage);
      return;
    }

    const toValue = nextDirection === -1 ? -width : width;
    Animated.timing(dragX, {
      toValue,
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      onPageChange(nextPage, pages[nextPage]);
      requestAnimationFrame(() => {
        dragX.setValue(0);
        setDirection(0);
      });
    });
  };

  const resetFlip = () => {
    Animated.timing(dragX, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setDirection(0);
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

          if (gestureState.dx < 0) {
            setDirection(-1);
          } else if (gestureState.dx > 0) {
            setDirection(1);
          } else {
            setDirection(0);
          }

          dragX.setValue(gestureState.dx);
        },
        onPanResponderRelease: (event, gestureState) => {
          const isTap = Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5;

          if (isTap) {
            const x = event.nativeEvent.locationX;
            if (x < width / 3) {
              onFlipStart?.();
              setDirection(1);
              dragX.setValue(0);
              requestAnimationFrame(() => commitFlip(1));
              return;
            }

            if (x > (width * 2) / 3) {
              onFlipStart?.();
              setDirection(-1);
              dragX.setValue(0);
              requestAnimationFrame(() => commitFlip(-1));
              return;
            }

            onTapCenter?.();
            dragX.setValue(0);
            setDirection(0);
            return;
          }

          const threshold = width * 0.2;
          if (gestureState.dx <= -threshold && direction === -1) {
            commitFlip(-1);
            return;
          }

          if (gestureState.dx >= threshold && direction === 1) {
            commitFlip(1);
            return;
          }

          resetFlip();
        },
      }),
    [currentPage, direction, dragX, moveChromeWithPage, onFlipStart, onTapCenter, pages, topChromeHeight, width]
  );

  const targetTranslateX = Animated.add(dragX, new Animated.Value(direction === -1 ? width : -width));

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View style={[styles.pageLayer, { transform: [{ translateX: dragX }] }]}>
        {renderPageFrame(pages[currentPage])}
      </Animated.View>
      {direction !== 0 && targetPage ? (
        <Animated.View style={[styles.pageLayer, { transform: [{ translateX: targetTranslateX }] }]}>
          {renderPageFrame(targetPage)}
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
});
