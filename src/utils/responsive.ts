import { Dimensions, PixelRatio } from 'react-native';

const DESIGN_WIDTH = 375;

export const px = (size: number): number => {
  const { width } = Dimensions.get('window');
  const scaled = size * (width / DESIGN_WIDTH);
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
};

export const sp = (size: number): number => px(size);
