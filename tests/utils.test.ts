import { describe, expect, it } from 'vitest';
import { normalizeFlipMode } from '../src/utils/flipMode';
import { htmlToPlainText } from '../src/utils/htmlToText';

describe('normalizeFlipMode', () => {
  it.each([
    ['上下', 'vertical'],
    ['vertical', 'vertical'],
    ['覆蓋', 'cover'],
    ['平移', 'slide'],
    ['無動畫', 'none'],
    ['仿真', 'simulation'],
  ] as const)('normalizes %s to %s', (mode, expected) => {
    expect(normalizeFlipMode(mode)).toBe(expected);
  });
});

describe('htmlToPlainText', () => {
  it('preserves block and line breaks without duplicate empty lines', () => {
    expect(htmlToPlainText('<p>第一段<br/>第二行</p><div>第三段</div>')).toBe('第一段\n第二行\n第三段');
  });

  it('returns an empty string for empty content', () => {
    expect(htmlToPlainText('')).toBe('');
  });
});
