# 第 18 课技术笔记：创意交互实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. Raycaster 鼠标拾取

从相机向鼠标位置发射射线，检测与物体的交叉。

```typescript
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

canvas.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1   // [-1, 1]
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1  // [-1, 1]
})

raycaster.setFromCamera(mouse, camera)
const intersects = raycaster.intersectObjects(meshes)
```

### 2. 鼠标坐标归一化

Three.js 的 NDC 坐标范围是 [-1, 1]，需要从像素坐标转换。

### 3. lerp 平滑跟随

```typescript
camera.position.x += (targetX - camera.position.x) * 0.02
```

直接设置位置会抖动，lerp 让移动有惯性。

### 4. 涟漪 Shader

```glsl
float dist = distance(uv, uMouse);
float age = uTime - uRippleTime;
float ripple = sin(dist * 30.0 - age * 8.0) * exp(-age * 3.0) * exp(-dist * 5.0);
pos.z += ripple * 0.5;
```

- `sin(dist * freq - age * speed)` → 环形波纹
- `exp(-age * 3.0)` → 随时间衰减
- `exp(-dist * 5.0)` → 随距离衰减

---

## API 速查

| API | 用途 |
|-----|------|
| `THREE.Raycaster()` | 射线投射器 |
| `raycaster.setFromCamera(mouse, camera)` | 从鼠标位置设置射线 |
| `raycaster.intersectObjects(objects)` | 检测交叉 |
| `intersect.uv` | 交叉点的 UV 坐标 |
| `intersect.object` | 被击中的物体 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| Raycaster | 鼠标拾取 | 坐标归一化 + 射线检测 |
| 涟漪 Shader | 交互反馈 | sin 波纹 + 指数衰减 |
| 相机跟随 | 视差效果 | lerp 平滑 |
| hover 高亮 | 状态反馈 | uHover uniform |

---

## 常见错误

- 鼠标坐标没归一化 → Raycaster 方向完全错误
- `intersectObjects` 忘记传 `true` 递归 → 子物体检测不到
- 涟漪 Shader 的 `uRippleTime` 没重置 → 只能触发一次
- 移动端没有 touch 事件 → 触摸设备无法交互

---

## 相关资源

- [Three.js Raycaster 文档](https://threejs.org/docs/#api/en/core/Raycaster)
- [Three.js Examples — Raycasting](https://threejs.org/examples/#webgl_raycast)
