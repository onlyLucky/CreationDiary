# 第 15 课技术笔记：粒子系统实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. BufferGeometry 粒子

每个粒子是 BufferGeometry 中的一个顶点，用 PointsMaterial 渲染。

```typescript
const positions = new Float32Array(count * 3)  // xyz per particle
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
const particles = new THREE.Points(geometry, material)
```

### 2. gl_PointSize（顶点着色器）

控制粒子大小。需要除以 `-mvPosition.z` 实现近大远小（透视衰减）。

```glsl
gl_PointSize = size * (300.0 / -mvPosition.z);
```

### 3. gl_PointCoord（片元着色器）

获取粒子内部的 UV 坐标 [0, 1]，用于画圆形/星形粒子。

```glsl
float d = distance(gl_PointCoord, vec2(0.5));
if (d > 0.5) discard;  // 圆形粒子
```

### 4. 生命周期

每个粒子有 `aBirthTime` 属性，shader 计算 age 驱动大小/颜色/透明度变化。

```glsl
float age = mod(uTime - aBirthTime, uMaxLife);
float lifeRatio = age / uMaxLife;
float size = aSize * sin(lifeRatio * 3.14159);  // 先大后小
```

### 5. AdditiveBlending（叠加混合）

重叠粒子的颜色相加，越重叠越亮。适合火焰/烟雾/光效。

```typescript
material.blending = THREE.AdditiveBlending
material.depthWrite = false  // 必须禁用深度写入
```

### 6. GPU vs CPU 粒子

| | CPU 粒子 | GPU 粒子 |
|--|--|--|
| 更新 | JS 每帧更新 position | Shader 中计算 |
| 数量上限 | ~1 万 | ~100 万 |
| 灵活性 | 高（JS 任意逻辑） | 低（只能用 GLSL） |
| Three.js 方案 | BufferGeometry + JS | Transform Feedback |

---

## API 速查

| API | 用途 |
|-----|------|
| `THREE.Points(geometry, material)` | 粒子系统对象 |
| `THREE.PointsMaterial` | 基础粒子材质 |
| `gl_PointSize` | 顶点着色器控制粒子大小 |
| `gl_PointCoord` | 片元着色器获取粒子内部 UV |
| `THREE.AdditiveBlending` | 叠加混合模式 |
| `BufferAttribute(array, itemSize)` | 自定义顶点属性 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| createStarField | 星空粒子 | PointsMaterial 基础用法 |
| createShaderParticles | 自定义粒子 | 顶点属性 + 生命周期 + 颜色变化 |
| createFlowParticles | 流动粒子 | 噪声场驱动 + 粒子运动 |

---

## 常见错误

- 忘记 `depthWrite: false` → 粒子互相遮挡
- `gl_PointSize` 没除以深度 → 远处粒子太大
- AdditiveBlending 时背景不是黑色 → 整体过曝
- 粒子数量太多（>10万）用 CPU 更新 → 帧率暴跌

---

## 相关资源

- [Three.js Examples — Points](https://threejs.org/examples/#webgl_points_billboards)
- [The Book of Shaders — Pattern](https://thebookofshaders.com/09/)
