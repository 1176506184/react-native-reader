import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { CoverFlip } from './reader-flip/CoverFlip';
import { NoAnimationFlip } from './reader-flip/NoAnimationFlip';
import { SimulationFlip } from './reader-flip/SimulationFlip';
import { SlideFlip } from './reader-flip/SlideFlip';
import { VerticalFlip } from './reader-flip/VerticalFlip';
import type { PageData, ReaderFlipProps } from './types';
import { normalizeFlipMode } from './utils/flipMode';

export const ReaderFlip: React.FC<ReaderFlipProps> = (props) => {
  const mode = normalizeFlipMode(props.flipMode);

  const handlePageChange = useCallback(
    (nextPage: number, pageData?: PageData) => {
      if (nextPage < 0) {
        if (props.onRequestPrevChapter) {
          props.onRequestPrevChapter();
          return;
        }
        props.onPageChange(nextPage, pageData);
        return;
      }

      if (nextPage >= props.pages.length) {
        if (props.onRequestNextChapter) {
          props.onRequestNextChapter();
          return;
        }
        props.onPageChange(nextPage, pageData);
        return;
      }

      props.onPageChange(nextPage, pageData || props.pages[nextPage]);
    },
    [props]
  );

  if (!props.pages.length) {
    return <View style={styles.empty} />;
  }

  const nextProps = {
    ...props,
    onPageChange: handlePageChange,
  };

  if (mode === 'vertical') {
    return <VerticalFlip {...nextProps} />;
  }

  if (mode === 'none') {
    return <NoAnimationFlip {...nextProps} />;
  }

  if (mode === 'slide') {
    return <SlideFlip {...nextProps} />;
  }

  if (mode === 'cover') {
    return <CoverFlip {...nextProps} />;
  }

  return <SimulationFlip {...nextProps} />;
};

const styles = StyleSheet.create({
  empty: {
    flex: 1,
  },
});
