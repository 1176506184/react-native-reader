import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PageFrameProps } from '../types';
import { px, sp } from '../utils/responsive';

export const PageFrame: React.FC<PageFrameProps> = ({
  page,
  width,
  height,
  themeColor,
  textColor,
  fontSize,
  lineHeight,
  headerTitle = '',
  chapterInfoText = '',
  moveChromeWithPage = false,
  topChromeHeight = 0,
  bottomChromeHeight = 0,
  topSafeInset = 0,
  contentHorizontalPadding = px(24),
  contentTopPadding = px(6),
  renderBackIcon,
  onBack,
}) => {
  const topInset = moveChromeWithPage ? topChromeHeight : 0;
  const textTopPadding = topInset + contentTopPadding;
  const pageHeaderTitle = page?.chapterTitle || headerTitle;
  const pageChapterInfoText = page?.chapterInfoText || chapterInfoText;
  const backIcon = renderBackIcon?.() ?? <Text style={styles.backIcon}>‹</Text>;

  return (
    <View style={[styles.page, { width, height, backgroundColor: themeColor }]}>
      {moveChromeWithPage ? (
        <View style={[styles.header, { height: topChromeHeight, paddingTop: topSafeInset, backgroundColor: themeColor }]}>
          <Pressable disabled={!onBack} style={styles.backBtn} onPress={onBack}>
            {backIcon}
            <Text style={styles.headerText} numberOfLines={1}>
              {pageHeaderTitle}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.content}>
        {page?.lines.map((line, index) => (
          <Text
            key={`${index}-${line.y}-${line.text.length}`}
            style={[
              styles.line,
              {
                left: contentHorizontalPadding,
                right: contentHorizontalPadding,
                top: line.y + textTopPadding,
                color: textColor,
                fontSize,
                lineHeight,
              },
            ]}
          >
            {line.text || ' '}
          </Text>
        ))}
      </View>

      {moveChromeWithPage ? (
        <View
          style={[
            styles.footer,
            {
              height: bottomChromeHeight,
              paddingHorizontal: contentHorizontalPadding,
              backgroundColor: themeColor,
            },
          ]}
        >
          <Text style={styles.footerText}>{pageChapterInfoText}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: px(16),
    zIndex: 3,
  },
  headerText: {
    flex: 1,
    color: '#999999',
    fontSize: sp(14),
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
  line: {
    position: 'absolute',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    paddingTop: px(6),
    zIndex: 3,
  },
  footerText: {
    color: '#999999',
    fontSize: sp(12),
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: px(44),
  },
  backIcon: {
    width: px(24),
    color: '#999999',
    fontSize: sp(30),
    lineHeight: px(32),
  },
});
