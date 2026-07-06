import type { FlipMode, NormalizedFlipMode } from '../types';

export const normalizeFlipMode = (mode?: FlipMode): NormalizedFlipMode => {
  if (mode === '上下' || mode === 'vertical') return 'vertical';
  if (mode === '覆蓋' || mode === 'cover') return 'cover';
  if (mode === '平移' || mode === 'slide') return 'slide';
  if (mode === '無動畫' || mode === 'none') return 'none';
  return 'simulation';
};
