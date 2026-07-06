import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PaginationCalculator } from './PaginationCalculator';
import { ReaderFlip } from './ReaderFlip';
import type { PageData, ReaderProps } from './types';
import { normalizeFlipMode } from './utils/flipMode';
import { htmlToPlainText } from './utils/htmlToText';
import { px } from './utils/responsive';

export const Reader: React.FC<ReaderProps> = ({
  html,
  width,
  height,
  flipMode = '上下',
  fontSize = 24,
  lineHeight,
  lineHeightMultiplier = 1.8,
  themeColor = '#E8E3CE',
  textColor = '#333333',
  headerTitle,
  chapterInfoText,
  initialPage = 0,
  currentPage,
  contentKey,
  moveChromeWithPage = false,
  topChromeHeight = 0,
  bottomChromeHeight = 0,
  topSafeInset = 0,
  contentHorizontalPadding = px(24),
  contentTopPadding = px(6),
  style,
  contentStyle,
  loadingComponent,
  renderBackIcon,
  onBack,
  onPageChange,
  onBoundaryPrev,
  onBoundaryNext,
  onTapCenter,
  onFlipStart,
}) => {
  const mode = normalizeFlipMode(flipMode);
  const resolvedLineHeight = lineHeight || fontSize * lineHeightMultiplier;
  const isControlled = typeof currentPage === 'number';
  const [pages, setPages] = useState<PageData[]>([]);
  const [internalPage, setInternalPage] = useState(initialPage);
  const activePage = isControlled ? currentPage || 0 : internalPage;
  const plainText = useMemo(() => htmlToPlainText(html), [html]);
  const measureWidth = Math.max(1, width - contentHorizontalPadding * 2);
  const chromeHeight = moveChromeWithPage ? topChromeHeight + bottomChromeHeight + contentTopPadding : 0;
  const measureHeight = Math.max(resolvedLineHeight, height - chromeHeight);
  const paginationKey = contentKey || `${html.length}-${width}-${height}-${fontSize}-${resolvedLineHeight}`;

  useEffect(() => {
    if (!isControlled) {
      setInternalPage(initialPage);
    }
  }, [initialPage, isControlled, paginationKey]);

  const handlePaginationComplete = useCallback(
    (nextPages: PageData[]) => {
      setPages(nextPages);

      if (!nextPages.length) return;

      const safePage = Math.min(Math.max(activePage, 0), nextPages.length - 1);
      if (safePage !== activePage && !isControlled) {
        setInternalPage(safePage);
      }
    },
    [activePage, isControlled]
  );

  const handlePageChange = useCallback(
    (nextPage: number, pageData?: PageData) => {
      if (nextPage < 0) {
        onBoundaryPrev?.();
        return;
      }

      if (nextPage >= pages.length) {
        onBoundaryNext?.();
        return;
      }

      if (!isControlled) {
        setInternalPage(nextPage);
      }

      onPageChange?.(nextPage, pageData || pages[nextPage]);
    },
    [isControlled, onBoundaryNext, onBoundaryPrev, onPageChange, pages]
  );

  if (mode === 'vertical') {
    return (
      <View style={[styles.reader, { width, height, backgroundColor: themeColor }, style]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.verticalContent,
            {
              minHeight: height,
              paddingTop: moveChromeWithPage ? topChromeHeight + contentTopPadding : contentTopPadding,
              paddingBottom: moveChromeWithPage ? bottomChromeHeight + contentTopPadding : contentTopPadding,
              paddingHorizontal: contentHorizontalPadding,
            },
          ]}
        >
          <Text
            selectable={false}
            style={[
              styles.verticalText,
              {
                color: textColor,
                fontSize,
                lineHeight: resolvedLineHeight,
              },
              contentStyle,
            ]}
            onPress={onTapCenter}
          >
            {plainText}
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.reader, { width, height, backgroundColor: themeColor }, style]}>
      <PaginationCalculator
        key={paginationKey}
        html={html}
        width={measureWidth}
        height={measureHeight}
        fontSize={fontSize}
        lineHeight={resolvedLineHeight}
        textStyle={contentStyle}
        onPaginationComplete={handlePaginationComplete}
      />

      {pages.length ? (
        <ReaderFlip
          pages={pages}
          currentPage={Math.min(Math.max(activePage, 0), pages.length - 1)}
          onPageChange={handlePageChange}
          onRequestPrevChapter={onBoundaryPrev}
          onRequestNextChapter={onBoundaryNext}
          onTapCenter={onTapCenter}
          onFlipStart={onFlipStart}
          flipMode={flipMode}
          themeColor={themeColor}
          textColor={textColor}
          fontSize={fontSize}
          lineHeight={resolvedLineHeight}
          width={width}
          height={height}
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
          contentKey={contentKey}
        />
      ) : (
        loadingComponent || (
          <View style={styles.loading}>
            <Text style={[styles.loadingText, { color: textColor }]}>正在加載內容...</Text>
          </View>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  reader: {
    overflow: 'hidden',
  },
  verticalContent: {
    flexGrow: 1,
  },
  verticalText: {
    includeFontPadding: false,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
});
