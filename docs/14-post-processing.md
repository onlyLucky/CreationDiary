# 第 14 课技术笔记：后处理效果实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. EffectComposer 工作原理

后处理链像 Instagram 滤镜叠加：渲染结果逐个 Pass 处理。

```typescript
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))  // 渲染 3D 场景
composer.addPass(new UnrealBloomPass(...))        // Bloom 辉光
composer.addPass(new ShaderPass(ColorCorrection)) // 色彩校正
composer.addPass(new ShaderPass(Vignette))        // 暗角
composer.addPass(new OutputPass())                // 色调映射 + sRGB（链末尾必需）
composer.render()  // 替代 renderer.render()
```

### 2. UnrealBloomPass（辉光）

三个参数：
- **threshold**（0.85）：亮度超过此值的像素才会发光
- **strength**（1.5）：发光强度
- **radius**（0.4）：发光扩散范围

原理：提取高亮区域 → 高斯模糊 → 叠加到原图。

### 3. 自定义 ShaderPass

```typescript
const MyShader = {
  uniforms: { tDiffuse: { value: null }, uIntensity: { value: 0.4 } },
  vertexShader: `...`,
  fragmentShader: `...`,
}
const pass = new ShaderPass(MyShader)
```

`tDiffuse` 是 EffectComposer 自动传入的上一个 Pass 的输出纹理。

### 4. Vignette（暗角）

```glsl
float dist = distance(vUv, vec2(0.5));
float vignette = smoothstep(0.8, 0.3, dist * uIntensity * 2.0);
color.rgb *= vignette;
```

### 5. 色彩校正

- 亮度：`color.rgb += brightness`
- 对比度：`(color.rgb - 0.5) * contrast + 0.5`
- 饱和度：`mix(vec3(luminance), color.rgb, saturation)`

### 6. 色调映射（Tone Mapping）

把超亮的高动态范围（HDR）压回显示器能表达的范围 [0, 1]。

本课 HDR 的来源正是 Bloom：`emissiveIntensity = 2.0` 的高发光材质叠加辉光后，像素值会远超 1.0。显示器是 SDR 设备，超出部分被直接裁剪成死白，高光层次全丢——色调映射把高值平滑压缩回来。

常用两种模式（本课控制面板可切换对照）：
- **ACESFilmicToneMapping**：电影业常用的压缩曲线，高光平滑滚落，过曝区域有过渡层次
- **LinearToneMapping**：线性乘 exposure 后直接 clamp，「无压缩」对照组——下拉高曝光很快死白

```typescript
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0  // 曝光：映射前先乘的亮度系数
```

两个坑：

1. **顺序**：`renderer.outputColorSpace` 与 tone mapping 的先后关系——three 里 tone mapping 发生在输出色彩空间转换（linear → sRGB）**之前**。即管线是「tone mapping 压缩 → sRGB 编码」，两者都发生在着色器输出阶段
2. **EffectComposer**：中间 Pass 渲染到 render target 时不执行 tone mapping，只有链末尾的 `OutputPass` 会读取 `renderer.toneMapping` 统一执行（压缩 + sRGB 转换）。用 composer 必须显式加 OutputPass，否则画面偏暗且无色调映射

---

## API 速查

| API | 用途 |
|-----|------|
| `EffectComposer(renderer)` | 后处理管理器 |
| `RenderPass(scene, camera)` | 渲染 3D 场景到帧缓冲 |
| `UnrealBloomPass(resolution, strength, radius, threshold)` | Bloom 辉光 |
| `ShaderPass(shaderMaterial)` | 自定义后处理 Pass |
| `OutputPass()` | 链末尾执行色调映射 + sRGB 转换（composer 必需） |
| `renderer.toneMapping` | 色调映射模式（ACES / Linear 等） |
| `renderer.toneMappingExposure` | 曝光系数，映射前先乘 |
| `composer.render()` | 执行整个后处理链 |
| `composer.setSize(w, h)` | 窗口自适应 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| VignetteShader | 暗角效果 | 到中心距离 → 变暗 |
| ColorCorrectionShader | 色彩校正 | 亮度/对比度/饱和度 |
| EffectComposer | 后处理链管理 | Pass 串联 |
| UnrealBloomPass | Bloom 辉光 | 高亮提取 + 高斯模糊 |
| OutputPass | 输出 | 色调映射 + sRGB 转换，跟随 renderer.toneMapping |

---

## 常见错误

- Pass 顺序影响效果：Vignette 放在 Bloom 前 → 暗角也被 Bloom 扩散
- 窗口 resize 时忘记 `composer.setSize()` → 画面错位
- `tDiffuse` 名字写错 → 画面全黑
- threshold 设为 0 → 整个场景都发光
- 用 EffectComposer 却不加 OutputPass → 无色调映射且画面偏暗（中间 Pass 不做 sRGB 转换）
- 直接改 `renderer.toneMapping` 期待 composer 生效 → 无变化，tone mapping 由链末尾 OutputPass 读取执行

---

## 相关资源

- [Three.js Examples — Post-processing](https://threejs.org/examples/#webgl_postprocessing_unreal_bloom)
- [Three.js Post-processing 文档](https://threejs.org/docs/#api/en/postprocessing/EffectComposer)
