# 第 13 课技术笔记：高级 Shader 效果实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. Dissolve（消融）效果

用噪声纹理作为遮罩，`discard` 丢弃低于阈值的像素，边缘添加发光。

```glsl
float noise = fbm(vUv * 5.0 + uTime * 0.05, 4) * 0.5 + 0.5;
if (noise < uThreshold) discard;
float edge = smoothstep(uThreshold, uThreshold + uEdgeWidth, noise);
vec3 emissive = uEdgeColor * (1.0 - edge) * 2.0;
```

**关键点**：
- `discard` 是片元着色器专用关键字，直接丢弃像素（不渲染），比 `alpha=0` 性能更好
- 边缘发光用 `smoothstep` 在 threshold 附近的窄带内混合
- 噪声值必须映射到 [0, 1]（`* 0.5 + 0.5`）

### 2. Hologram（全息）效果

三要素：Fresnel 边缘透明 + 扫描线 + 闪烁噪点。

```glsl
float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), uFresnelPower);
float scan = sin(vUv.y * uScanDensity - uTime * uScanSpeed) * 0.5 + 0.5;
float flicker = step(0.98, random(vec2(vUv.x * 100.0, uTime * 10.0))) * 0.15;
```

### 3. Fresnel 效应

物理现象：观察角度越接近掠射角（平行于表面），反射越强。

```glsl
float fresnel = pow(1.0 - abs(dot(normal, viewDir)), power);
```

- `dot(normal, viewDir)` ≈ 1 时（正对）→ fresnel ≈ 0（不反射）
- `dot(normal, viewDir)` ≈ 0 时（掠射）→ fresnel ≈ 1（强反射）
- `power` 控制衰减曲线：值越大，只有极端掠射角才反射

### 4. Distortion（扭曲）效果

在顶点着色器中用噪声偏移顶点位置，法线需要重算。

```glsl
float n = fbm(pos.xy * uDistortScale + uTime * 0.2, 4);
pos += normal * n * uDistortStrength;
```

---

## API 速查

| API | 用途 |
|-----|------|
| `discard` | 片元着色器丢弃像素 |
| `dot(N, V)` | 法线与视线的点积（Fresnel 输入） |
| `pow(x, n)` | 幂函数（控制 Fresnel 衰减曲线） |
| `smoothstep(e0, e1, x)` | 平滑阶跃（边缘发光过渡） |
| `fbm(p, octaves)` | 分形布朗运动（噪声叠加） |
| `transparent: true` | ShaderMaterial 启用透明 |
| `depthWrite: false` | 透明物体禁用深度写入 |

---

## 课程代码结构

| 面板 | 着色器 | 核心知识点 |
|------|--------|-----------|
| Dissolve | `dissolveFragmentShader` | discard + 噪声遮罩 + 边缘发光 |
| Hologram | `holoFragmentShader` | Fresnel + 扫描线 + 闪烁 |
| Fresnel | `fresnelFragmentShader` | Fresnel 物理可视化 |
| Distort | `distortVertexShader` | 顶点噪声偏移 |

---

## 常见错误

- 忘记 `transparent: true` 导致全息效果不透明
- `discard` 后不写 `depthWrite: false` 导致背面穿透
- Fresnel 没用 `abs(dot(...))` 导致背面计算错误
- 消融效果噪声值域未归一化导致全黑/全白

---

## 相关资源

- [Three.js Examples — webgl_shader_lava](https://threejs.org/examples/#webgl_shader_lava)
- [Shadertoy — Dissolve Effect](https://www.shadertoy.com)
- [The Book of Shaders — Pattern](https://thebookofshaders.com/09/)
