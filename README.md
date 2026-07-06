# React Native Reader

从凤梨小说 App 抽出来的 React Native 小说阅读器组件，支持：

- `上下`：纵向阅读
- `覆蓋`：覆盖翻页
- `平移`：平移翻页
- `仿真`：3D 仿真翻页
- `無動畫`：无动画翻页

## 安装

如果还没有发布到 npm，可以先直接安装 GitHub 仓库：

```bash
npm install github:1176506184/react-native-reader
# 或
yarn add https://github.com/1176506184/react-native-reader.git
```

发布到 npm 后可使用：

```bash
npm install @tangfeifan/react-native-reader
```

## 基础用法

```tsx
import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Reader } from '@tangfeifan/react-native-reader';

export function ChapterReader({ html }: { html: string }) {
  const { width, height } = useWindowDimensions();

  return (
    <Reader
      html={html}
      width={width}
      height={height}
      flipMode="覆蓋"
      fontSize={24}
      lineHeight={43}
      themeColor="#E8E3CE"
      textColor="#333333"
      headerTitle="第一章"
      chapterInfoText="第一章 / 共100章"
      onBoundaryPrev={() => {
        // 加载上一章
      }}
      onBoundaryNext={() => {
        // 加载下一章
      }}
      onTapCenter={() => {
        // 显示或隐藏阅读器菜单
      }}
    />
  );
}
```

## 章节预加载

如果你的 App 已经预加载了前后章节，可以继续使用低层组件：

```tsx
import {
  PaginationCalculator,
  ReaderFlip,
  type PageData,
} from '@tangfeifan/react-native-reader';
```

先用 `PaginationCalculator` 把章节 HTML 转成 `PageData[]`，再把当前章、上一章、下一章的 pages 拼接后传给 `ReaderFlip`。这样可以和 App 里的章节缓存、进度保存逻辑继续解耦。

## FlipMode

组件同时支持中文模式和英文别名：

```ts
type FlipMode =
  | '上下'
  | '覆蓋'
  | '平移'
  | '仿真'
  | '無動畫'
  | 'vertical'
  | 'cover'
  | 'slide'
  | 'simulation'
  | 'none';
```

## 导出

- `Reader`
- `ReaderFlip`
- `PaginationCalculator`
- `PageFrame`
- `CoverFlip`
- `SlideFlip`
- `SimulationFlip`
- `NoAnimationFlip`
- `VerticalFlip`
- `htmlToPlainText`
- `normalizeFlipMode`
