import type React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type ChineseFlipMode = '上下' | '覆蓋' | '平移' | '仿真' | '無動畫';
export type EnglishFlipMode = 'vertical' | 'cover' | 'slide' | 'simulation' | 'none';
export type FlipMode = ChineseFlipMode | EnglishFlipMode;
export type NormalizedFlipMode = EnglishFlipMode;

export interface TextLine {
  text: string;
  width: number;
  height: number;
  y: number;
  x: number;
  isNewParagraph?: boolean;
}

export interface PageData {
  index: number;
  lines: TextLine[];
  content: string;
  startOffset: number;
  endOffset: number;
  chapterId?: string | number;
  chapterPageIndex?: number;
  chapterTitle?: string;
  chapterInfoText?: string;
}

export interface PaginationCalculatorProps {
  html: string;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  onPaginationComplete: (pages: PageData[]) => void;
  textStyle?: StyleProp<TextStyle>;
}

export interface PageFrameProps {
  page?: PageData;
  width: number;
  height: number;
  themeColor: string;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  headerTitle?: string;
  chapterInfoText?: string;
  moveChromeWithPage?: boolean;
  topChromeHeight?: number;
  bottomChromeHeight?: number;
  topSafeInset?: number;
  contentHorizontalPadding?: number;
  contentTopPadding?: number;
  renderBackIcon?: () => React.ReactNode;
  onBack?: () => void;
}

export interface ReaderFlipBaseProps extends PageFrameProps {
  pages: PageData[];
  currentPage: number;
  onPageChange: (page: number, pageData?: PageData) => void;
  onRequestNextChapter?: () => void;
  onRequestPrevChapter?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  onTapCenter?: () => void;
  onFlipStart?: () => void;
  contentKey?: string;
}

export interface ReaderFlipProps extends ReaderFlipBaseProps {
  flipMode: FlipMode;
}

export interface ReaderProps {
  html: string;
  width: number;
  height: number;
  flipMode?: FlipMode;
  fontSize?: number;
  lineHeight?: number;
  lineHeightMultiplier?: number;
  themeColor?: string;
  textColor?: string;
  headerTitle?: string;
  chapterInfoText?: string;
  initialPage?: number;
  currentPage?: number;
  contentKey?: string;
  moveChromeWithPage?: boolean;
  topChromeHeight?: number;
  bottomChromeHeight?: number;
  topSafeInset?: number;
  contentHorizontalPadding?: number;
  contentTopPadding?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<TextStyle>;
  loadingComponent?: React.ReactNode;
  renderBackIcon?: () => React.ReactNode;
  onBack?: () => void;
  onPageChange?: (page: number, pageData?: PageData) => void;
  onBoundaryPrev?: () => void;
  onBoundaryNext?: () => void;
  onTapCenter?: () => void;
  onFlipStart?: () => void;
}
