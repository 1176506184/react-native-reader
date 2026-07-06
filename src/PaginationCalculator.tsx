import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PageData, PaginationCalculatorProps, TextLine } from './types';
import { htmlToPlainText } from './utils/htmlToText';

export const PaginationCalculator: React.FC<PaginationCalculatorProps> = ({
  html,
  width,
  height,
  fontSize,
  lineHeight,
  onPaginationComplete,
  textStyle,
}) => {
  const processedText = useMemo(() => htmlToPlainText(html), [html]);

  useEffect(() => {
    if (!processedText) {
      onPaginationComplete([]);
    }
  }, [onPaginationComplete, processedText]);

  const handleTextLayout = useCallback(
    (event: any) => {
      const measuredLines = event.nativeEvent.lines || [];
      const pages: PageData[] = [];
      let currentLines: TextLine[] = [];
      let currentHeight = 0;
      let pageIndex = 0;
      const safeHeight = Math.max(height, lineHeight);

      measuredLines.forEach((line: any) => {
        const measuredHeight = line.height || lineHeight;

        if (currentHeight + measuredHeight > safeHeight && currentLines.length > 0) {
          pages.push({
            index: pageIndex,
            lines: [...currentLines],
            content: currentLines.map((item) => item.text).join(''),
            startOffset: 0,
            endOffset: 0,
          });

          pageIndex += 1;
          currentLines = [];
          currentHeight = 0;
        }

        currentLines.push({
          text: line.text,
          width: line.width,
          height: measuredHeight,
          x: line.x,
          y: currentHeight,
        });

        currentHeight += measuredHeight;
      });

      if (currentLines.length > 0) {
        pages.push({
          index: pageIndex,
          lines: [...currentLines],
          content: currentLines.map((item) => item.text).join(''),
          startOffset: 0,
          endOffset: 0,
        });
      }

      onPaginationComplete(pages);
    },
    [height, lineHeight, onPaginationComplete]
  );

  if (!processedText) return null;

  return (
    <View pointerEvents="none" style={[styles.measureBox, { width }]}>
      <Text
        style={[
          styles.measureText,
          {
            width,
            fontSize,
            lineHeight,
          },
          textStyle,
        ]}
        onTextLayout={handleTextLayout}
      >
        {processedText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  measureBox: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
  measureText: {
    color: '#000000',
  },
});
