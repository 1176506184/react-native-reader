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
  const lockedTopPadding = topInset + px(28);
  const lockedBottomPadding = (moveChromeWithPage ? bottomChromeHeight : 0) + px(40);

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
        {page?.locked ? (
          <View
            style={[
              styles.lockedContent,
              {
                paddingTop: lockedTopPadding,
                paddingBottom: lockedBottomPadding,
                paddingHorizontal: Math.max(contentHorizontalPadding, px(36)),
              },
            ]}
          >
            {page.lockedBadgeText ? <Text style={styles.lockedBadge}>{page.lockedBadgeText}</Text> : null}
            {page.lockedTitle ? <Text style={[styles.lockedTitle, { color: textColor }]}>{page.lockedTitle}</Text> : null}
            {page.lockedDescription ? <Text style={styles.lockedDescription}>{page.lockedDescription}</Text> : null}
          </View>
        ) : (
          page?.lines.map((line, index) => (
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
          ))
        )}
      </View>

      {moveChromeWithPage && !page?.locked ? (
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
  lockedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBadge: {
    marginBottom: px(12),
    color: '#999999',
    fontSize: sp(12),
    fontWeight: '700',
  },
  lockedTitle: {
    fontSize: sp(20),
    fontWeight: '700',
    lineHeight: sp(27),
    textAlign: 'center',
  },
  lockedDescription: {
    marginTop: px(10),
    color: '#999999',
    fontSize: sp(14),
    lineHeight: sp(22),
    textAlign: 'center',
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
