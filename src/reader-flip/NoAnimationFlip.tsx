import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';

export const NoAnimationFlip: React.FC<ReaderFlipBaseProps> = ({
  pages,
  currentPage,
  onPageChange,
  onTapCenter,
  onFlipStart,
  isMenuVisible,
  themeColor,
  textColor,
  fontSize,
  lineHeight,
  width,
  height,
  headerTitle,
  chapterInfoText,
  moveChromeWithPage,
  topChromeHeight,
  bottomChromeHeight,
  topSafeInset,
  contentHorizontalPadding,
  contentTopPadding,
  renderBackIcon,
  onBack,
  lockedOverlay,
}) => {
  const touchLayerStyle = [
    styles.touchLayer,
    moveChromeWithPage && {
      top: topChromeHeight || 0,
      bottom: bottomChromeHeight || 0,
    },
  ];

  const handleTap = (x: number) => {
    if (isMenuVisible) {
      onTapCenter?.();
      return;
    }

    if (x < width / 3) {
      onFlipStart?.();
      onPageChange(currentPage - 1, pages[currentPage - 1]);
      return;
    }

    if (x > (width * 2) / 3) {
      onFlipStart?.();
      onPageChange(currentPage + 1, pages[currentPage + 1]);
      return;
    }

    onTapCenter?.();
  };

  return (
    <View style={styles.container}>
      <PageFrame
        page={pages[currentPage]}
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
      <Pressable style={touchLayerStyle} onPress={(event) => handleTap(event.nativeEvent.locationX)} />
      {pages[currentPage]?.locked && lockedOverlay ? (
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
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
});
