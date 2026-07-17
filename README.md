# React Native Reader

从鳳梨小說 App 抽出的 React Native 小说阅读核心。它负责内容分页、页面渲染、跨章边界和翻页交互，数据请求、书架、登录、VIP、目录、音频与阅读进度由宿主 App 管理。

支持五种模式：

- `vertical` / `上下`
- `cover` / `覆蓋`
- `slide` / `平移`
- `simulation` / `仿真`
- `none` / `無動畫`

## 安装

```bash
npm install @tangfeifan/react-native-reader
```

阅读器使用原生动画和 Skia。Expo 项目可安装匹配当前 SDK 的 peer dependencies：

```bash
npx expo install expo-linear-gradient @shopify/react-native-skia \
  react-native-gesture-handler react-native-reanimated react-native-worklets
```

使用 Reanimated 3 时不需要单独安装 `react-native-worklets`。原生依赖必须同时安装在最终 App 中，并按对应库文档完成 Babel、入口手势容器和原生重建配置。

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
      lineHeightMultiplier={1.8}
      themeColor="#E8E3CE"
      textColor="#333333"
      headerTitle="第一章"
      chapterInfoText="第一章 / 共100章"
      onBoundaryPrev={() => loadPreviousChapter()}
      onBoundaryNext={() => loadNextChapter()}
      onTapCenter={() => toggleReaderMenu()}
    />
  );
}
```

`Reader` 支持 `currentPage` 受控页码，也可以通过 `initialPage` 使用内部页码。尺寸、字号、行高、颜色或 `contentKey` 改变时会重新分页。

## 跨章与预加载

宿主已加载前后章节时，可以使用低层 API。先通过 `PaginationCalculator` 生成每章的 `PageData[]`，补充章节信息后按阅读顺序拼接，再交给 `ReaderFlip`：

```tsx
import {
  ReaderFlip,
  type PageData,
} from '@tangfeifan/react-native-reader';

const pages: PageData[] = chapterPages.flatMap(({ chapter, pages }) =>
  pages.map((page, chapterPageIndex) => ({
    ...page,
    chapterId: chapter.id,
    chapterPageIndex,
    chapterTitle: chapter.title,
  }))
);

<ReaderFlip
  pages={pages}
  currentPage={currentPage}
  onPageChange={(nextPage, page) => {
    setCurrentPage(nextPage);
    saveProgress(page?.chapterId, page?.chapterPageIndex);
  }}
  onRequestPrevChapter={loadPreviousChapter}
  onRequestNextChapter={loadNextChapter}
  flipMode="仿真"
  width={width}
  height={height}
  fontSize={24}
  lineHeight={43.2}
  themeColor="#E8E3CE"
  textColor="#333333"
/>
```

跨章异步更新时，组件使用 `chapterId + chapterPageIndex` 保持提交页，避免父层替换页面数组造成闪回。

## 锁章

`PageData` 支持通用锁章信息：

```ts
const lockedPage: PageData = {
  index: 0,
  lines: [],
  content: '',
  startOffset: 0,
  endOffset: 0,
  chapterId: 12,
  chapterPageIndex: 0,
  locked: true,
  lockedReason: 'vip',
  lockedBadgeText: 'VIP',
  lockedTitle: '本章为 VIP 内容',
  lockedDescription: '开通 VIP 后即可继续阅读。',
};
```

`lockedOverlay` 可注入登录或购买按钮。包只负责展示和手势层级，不包含具体鉴权及支付逻辑。

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
- 相关 TypeScript 类型

## 运行要求

仿真翻页使用 Skia RuntimeEffect 和页面截图。请把阅读器放在 `GestureHandlerRootView` 内，并确保宿主使用与 React Native 版本匹配的 Skia、Gesture Handler 和 Reanimated。切到后台、截图超时或截图失败时，仿真模式会清理状态并留在当前页；未完成的动画锁也会自动超时释放，避免交互卡死。

## 许可证

项目使用 MIT License。仿真卷页 Shader 包含第三方 MIT 与 BSD-3-Clause 代码，详见 `THIRD_PARTY_NOTICES.md`。
