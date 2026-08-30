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

---

## API 速查

| API | 用途 |
|-----|------|
| `EffectComposer(renderer)` | 后处理管理器 |
| `RenderPass(scene, camera)` | 渲染 3D 场景到帧缓冲 |
| `UnrealBloomPass(resolution, strength, radius, threshold)` | Bloom 辉光 |
| `ShaderPass(shaderMaterial)` | 自定义后处理 Pass |
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

---

## 常见错误

- Pass 顺序影响效果：Vignette 放在 Bloom 前 → 暗角也被 Bloom 扩散
- 窗口 resize 时忘记 `composer.setSize()` → 画面错位
- `tDiffuse` 名字写错 → 画面全黑
- threshold 设为 0 → 整个场景都发光

---

## 相关资源

- [Three.js Examples — Post-processing](https://threejs.org/examples/#webgl_postprocessing_unreal_bloom)
- [Three.js Post-processing 文档](https://threejs.org/docs/#api/en/postprocessing/EffectComposer)
