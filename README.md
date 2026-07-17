# React Native Reader

一套面向 React Native 的小说与电子书阅读核心组件，提供内容分页、页面渲染、跨章边界处理、锁章展示和多种翻页交互。数据请求、书架、登录、VIP、目录、音频及阅读进度由宿主应用按业务需要接入。

## 功能

- 五种阅读模式：上下、覆盖、平移、仿真、无动画。
- 中文模式名和英文别名可以混用。
- HTML 文本提取、测量和分页。
- 支持受控页码和内部页码。
- 支持预加载章节拼接及异步跨章边界。
- 支持章节锁定、登录提示和 VIP 提示。
- 支持自定义主题、字号、行高、内容边距和页眉页脚。
- 仿真模式使用 Skia RuntimeEffect，并由 Gesture Handler 与 Reanimated 在 UI 线程驱动手势进度。
- 仿真截图失败、应用切后台或动画异常时自动清理交互锁。

## 效果预览

[点击播放仿真翻页演示](https://pineread.com/Content/Screenrecording_20260717_112630..mp4)

## 环境要求

当前版本开发和验证所使用的环境：

| 依赖 | 已验证版本 | peer 范围 |
| --- | --- | --- |
| React | 19.2.0 | `>=19.0.0` |
| React Native | 0.83.2 | `>=0.78.0` |
| Expo | 55 | `>=53.0.0` |
| Expo Linear Gradient | 55.0.8 | `>=14.0.0` |
| React Native Skia | 2.6.9 | `>=2.6.9` |
| Gesture Handler | 2.30.0 | `>=2.0.0` |
| Reanimated | 4.2.1 | `>=3.19.1` |
| Worklets | 0.7.2 | `>=0.7.0`，仅 Reanimated 4 需要 |

`@shopify/react-native-skia@2.6.9` 自身要求 React 19、React Native 0.78 及 Reanimated 3.19.1 以上。peer 范围表示依赖解析允许的范围，不代表所有组合都经过真机验证。

## 安装

### Expo

```bash
npm install @tangfeifan/react-native-reader

npx expo install expo-linear-gradient @shopify/react-native-skia \
  react-native-gesture-handler react-native-reanimated react-native-worklets
```

如果项目使用 Reanimated 3，不要安装 `react-native-worklets`：

```bash
npx expo install expo-linear-gradient @shopify/react-native-skia \
  react-native-gesture-handler react-native-reanimated
```

安装或升级原生依赖后，需要重新生成并构建原生应用。仅刷新 Metro 不会安装原生模块。

```bash
npx expo prebuild
npx expo run:android
# 或
npx expo run:ios
```

### Bare React Native

组件使用 `expo-linear-gradient`，Bare React Native 项目需要先启用 Expo Modules：

```bash
npx install-expo-modules@latest

npm install @tangfeifan/react-native-reader \
  expo expo-linear-gradient @shopify/react-native-skia \
  react-native-gesture-handler react-native-reanimated react-native-worklets
```

iOS 安装后执行：

```bash
cd ios && pod install
```

## 原生配置

### Gesture Handler

应用入口需要尽早导入 Gesture Handler，并使用 `GestureHandlerRootView` 包裹阅读器所在的应用区域：

```tsx
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
```

### Reanimated 4

Bare React Native 使用 Reanimated 4 时，确保 Worklets Babel 插件位于插件列表最后：

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-worklets/plugin',
  ],
};
```

Reanimated 3 使用 `react-native-reanimated/plugin`，并且不需要 `react-native-worklets`。Expo 项目通常由 `babel-preset-expo` 根据 SDK 版本完成对应配置；不要同时添加两个插件。

修改 Babel 配置后清理 Metro 缓存：

```bash
npx expo start --clear
```

## 快速开始

`Reader` 适合读取单章 HTML，并由组件负责分页和页码状态：

```tsx
import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Reader } from '@tangfeifan/react-native-reader';

export function ChapterReader({ chapterId, html }: {
  chapterId: number;
  html: string;
}) {
  const { width, height } = useWindowDimensions();

  return (
    <Reader
      html={html}
      contentKey={String(chapterId)}
      width={width}
      height={height}
      flipMode="仿真"
      fontSize={24}
      lineHeightMultiplier={1.8}
      themeColor="#E8E3CE"
      textColor="#333333"
      headerTitle="第一章"
      chapterInfoText="第一章 / 共 100 章"
      onBoundaryPrev={() => loadPreviousChapter()}
      onBoundaryNext={() => loadNextChapter()}
      onPageChange={(pageIndex, page) => {
        saveProgress(chapterId, pageIndex, page?.startOffset);
      }}
      onTapCenter={() => toggleReaderMenu()}
    />
  );
}
```

`contentKey` 应当在章节或正文内容改变时同步改变。它会参与分页缓存和仿真截图身份计算，避免不同章节复用旧页面纹理。

## 翻页模式

| 中文 | 英文 | 说明 |
| --- | --- | --- |
| `上下` | `vertical` | 连续纵向滚动 |
| `覆蓋` | `cover` | 当前页横向覆盖切换 |
| `平移` | `slide` | 前后页面同步平移 |
| `仿真` | `simulation` | Skia Shader 卷页效果 |
| `無動畫` | `none` | 点击后直接切页 |

```tsx
<Reader flipMode="simulation" {...readerProps} />
```

## 受控页码

传入 `currentPage` 后，页码完全由宿主控制；宿主必须在 `onPageChange` 中更新它：

```tsx
const [page, setPage] = useState(0);

<Reader
  {...readerProps}
  currentPage={page}
  onPageChange={(nextPage) => setPage(nextPage)}
/>
```

不传 `currentPage` 时，组件使用 `initialPage` 初始化内部页码。

## 跨章与预加载

宿主已经管理章节内容和分页缓存时，可以直接使用 `PaginationCalculator` 与 `ReaderFlip`。将上一章、当前章和下一章页面按阅读顺序拼接，翻到数组边界时再加载相邻章节。

```tsx
import {
  PaginationCalculator,
  ReaderFlip,
  type PageData,
} from '@tangfeifan/react-native-reader';

const pages: PageData[] = chapterPages.flatMap(({ chapter, pages }) =>
  pages.map((page, chapterPageIndex) => ({
    ...page,
    chapterId: chapter.id,
    chapterPageIndex,
    chapterTitle: chapter.title,
    chapterInfoText: `${chapter.title} / 共 ${chapterCount} 章`,
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
  contentKey={`${bookId}:${layoutVersion}`}
  width={width}
  height={height}
  fontSize={24}
  lineHeight={43.2}
  themeColor="#E8E3CE"
  textColor="#333333"
/>
```

跨章加载建议：

- `pages` 必须始终保持实际阅读顺序。
- `chapterId + chapterPageIndex` 应当稳定且唯一。
- 在当前章附近提前准备前后章节，避免到边界后才请求正文。
- 异步插入上一章后，需要同步修正宿主的全局 `currentPage` 索引。
- 相邻章节加载期间不要清空当前章节页面。

## 锁章

锁章可以作为只有一页的 `PageData` 插入页面数组：

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

通过 `lockedOverlay` 注入登录、购买或订阅按钮。组件只负责页面展示和手势层级，不包含鉴权、订单或支付逻辑。

## Reader 主要属性

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `html` | `string` | 必填 | 当前章节 HTML |
| `width` / `height` | `number` | 必填 | 阅读器逻辑尺寸 |
| `flipMode` | `FlipMode` | `上下` | 翻页模式 |
| `fontSize` | `number` | `24` | 正文字号 |
| `lineHeight` | `number` | - | 明确指定行高 |
| `lineHeightMultiplier` | `number` | `1.8` | 未传 `lineHeight` 时使用 |
| `currentPage` | `number` | - | 受控页码 |
| `initialPage` | `number` | `0` | 非受控初始页码 |
| `contentKey` | `string` | 自动生成 | 内容及分页缓存身份 |
| `themeColor` | `string` | `#E8E3CE` | 页面背景色 |
| `textColor` | `string` | `#333333` | 正文颜色 |
| `contentHorizontalPadding` | `number` | `24px` | 正文左右边距 |
| `contentTopPadding` | `number` | `6px` | 正文顶部边距 |
| `moveChromeWithPage` | `boolean` | `false` | 页眉页脚是否随页面移动 |
| `loadingComponent` | `ReactNode` | 内置文字 | 分页期间占位内容 |
| `isMenuVisible` | `boolean` | `false` | 菜单显示时覆盖翻页手势 |
| `onPageChange` | `(index, page) => void` | - | 页码改变回调 |
| `onBoundaryPrev` | `() => void` | - | 到达上一章边界 |
| `onBoundaryNext` | `() => void` | - | 到达下一章边界 |
| `onTapCenter` | `() => void` | - | 点击页面中央区域 |
| `onFlipStart` | `() => void` | - | 有效翻页手势开始 |

完整类型请查看导出的 `ReaderProps`、`ReaderFlipProps` 和 `PageFrameProps`。

## 仿真模式说明

仿真模式会把当前页和目标页捕获为 Skia 图像，再交给 RuntimeEffect 绘制卷页。需要注意：

- 页面截图和纹理创建发生在原生侧，低端设备可能比覆盖和平移模式更慢。
- 拖动进度通过 Reanimated SharedValue 驱动，不会逐帧经过 React State。
- 一次手势期间复用固定纹理，不会逐帧截图。
- 成功翻页后，目标页纹理会提升为新的当前页纹理。
- 截图失败时保持当前页并清理状态，不会无动画跳页。
- 动画锁超过 3.5 秒会自动释放。
- 生命周期日志统一使用 `[Reader][Simulation]` 前缀。

对 GPU 或内存较弱的设备，宿主可以默认使用 `cover` 或 `slide`，把 `simulation` 作为可选效果。

## 常见问题

### 手势完全不响应

确认阅读器位于 `GestureHandlerRootView` 内，并且安装原生依赖后重新构建了应用。

### Reanimated 或 Worklets 初始化失败

确认 Reanimated 版本与 Worklets 匹配。Reanimated 4 需要 `react-native-worklets`；Reanimated 3 不需要。Babel 插件必须与所安装的主版本一致。

### Skia RuntimeEffect 或截图失败

确认安装的是支持当前 React Native 版本的 Skia，并使用真机日志检查：

```bash
adb logcat | grep "\[Reader\]\[Simulation\]"
```

Windows PowerShell：

```powershell
adb logcat | Select-String '\[Reader\]\[Simulation\]'
```

### 页面内容改变后仍显示旧页

为新章节或新内容传入不同的 `contentKey`，并同步更新受控 `currentPage`。

### 修改字号后页码越界

字号、行高、尺寸和内容改变都会重新分页。受控模式下，宿主应在分页变化后把页码限制到新的页面范围。

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
- `PageData`、`ReaderProps` 等 TypeScript 类型

## 许可证

项目使用 MIT License。仿真卷页 Shader 包含第三方 MIT 与 BSD-3-Clause 代码，详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
