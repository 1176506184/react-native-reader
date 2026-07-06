import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { ReaderFlipBaseProps } from '../types';
import { PageFrame } from './PageFrame';

export const VerticalFlip: React.FC<ReaderFlipBaseProps> = ({
  pages,
  currentPage,
  onPageChange,
  onTapCenter,
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
  const scrollRef = useRef<ScrollView>(null);
  const lastPageRef = useRef(currentPage);

  useEffect(() => {
    if (lastPageRef.current === currentPage) return;
    lastPageRef.current = currentPage;
    scrollRef.current?.scrollTo({ y: Math.max(currentPage, 0) * height, animated: false });
  }, [currentPage, height]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.round(event.nativeEvent.contentOffset.y / height);
    if (nextPage !== lastPageRef.current) {
      lastPageRef.current = nextPage;
      onPageChange(nextPage, pages[nextPage]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColor }]}>
      <ScrollView
        ref={scrollRef}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        onTouchEnd={onTapCenter}
      >
        {pages.map((page) => (
          <PageFrame
            key={`${page.chapterId ?? 'chapter'}-${page.index}`}
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
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
