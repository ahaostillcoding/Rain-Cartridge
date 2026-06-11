# 像素天气 / Rain Cartridge

GameBoy 情感、孤独、低保真（Lo-fi）的天气体验原型。它不会展示“晴，25 度”这类数字天气，而是调用实时天气数据，只用结果决定当前氛围模式，并生成一段 8-bit 音效和 Canvas 像素动画。

## 体验亮点

- 免费天气 API：使用 Open-Meteo，无需 API Key。
- 不显示天气数字：只把 `weather_code` 和风速映射成氛围模式。
- 全球城市选择：可以手动搜索城市，用候选城市坐标切换当前天空。
- Canvas 手绘动画：所有天气场景都由 `requestAnimationFrame` 逐帧绘制。
- 低保真音效：用 WebAudio 生成雨声、风噪、雾感脉冲和方波底噪。
- PC + 安卓：Vite Web App + PWA manifest + service worker，可在安卓浏览器里添加到主屏幕。

## 氛围模式

- `RAIN ROOM`：GBC 蓝色调，小人站在窗前，循环雨线和白噪声。
- `WIND STATIC`：GameBoy 摄像头噪声感，界面和画面会轻微抖动。
- `FOG MEMORY`：低对比雾气漂浮，安静、模糊、孤独。
- `LATE GLOW`：夜色里的微弱光点和方波底噪。

## 本地运行

```bash
npm install
npm run dev
```

打开本地地址后，应用会尝试读取设备位置来判断实时天气；如果定位不可用，会静默使用默认坐标进入一个氛围模式。也可以在 `CITY SIGNAL` 中输入全球城市名并选择候选城市。

## 构建

```bash
npm run build
```

构建产物会生成到 `dist/`。
