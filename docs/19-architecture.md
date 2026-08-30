# 第 19 课技术笔记：网站架构设计实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. 多场景管理架构

每个场景独立拥有 Scene + Camera + update 函数，通过场景管理器切换。

```typescript
interface Scene3D {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  update: (time: number) => void
  dispose: () => void
}
```

### 2. 场景切换过渡

用黑色 overlay 做淡入淡出：

```typescript
overlay.style.opacity = '1'  // 淡出（覆盖黑色）
await sleep(500)
// 切换场景
overlay.style.opacity = '0'  // 淡入（露出新场景）
```

### 3. dispose 防止内存泄漏

```typescript
dispose: () => {
  meshes.forEach(m => {
    m.geometry.dispose()
    m.material.dispose()
    if (m.material.map) m.material.map.dispose()
  })
}
```

需要释放：geometry、material、texture、renderTarget。

### 4. 预加载 vs 按需加载

| | 预加载 | 按需加载 |
|--|--|--|
| 首次加载 | 慢（加载所有资源） | 快（只加载当前页面） |
| 切换体验 | 快（已缓存） | 慢（需要等待） |
| 带宽消耗 | 高（可能浪费） | 低（按需） |
| 适用场景 | 小项目、资源少 | 大项目、资源多 |

---

## API 速查

| API | 用途 |
|-----|------|
| `geometry.dispose()` | 释放几何体 GPU 内存 |
| `material.dispose()` | 释放材质 |
| `texture.dispose()` | 释放纹理 |
| `renderer.dispose()` | 释放 WebGL 上下文 |
| `renderer.info` | 查看内存使用情况 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| SceneManagerMulti | 场景管理器 | 切换/淡入淡出/更新 |
| createGeometryScene | 几何体场景 | 独立 Scene + dispose |
| createParticleScene | 粒子场景 | BufferGeometry 管理 |
| createShaderScene | Shader 场景 | ShaderMaterial 管理 |

---

## 常见错误

- 忘记 dispose → WebGL 上下文资源耗尽（画面冻结）
- 只 dispose geometry 忘记 material/texture → 内存泄漏
- 场景切换时还在更新旧场景 → 性能浪费
- 没有处理 resize 事件 → 新场景相机比例错误

---

## 相关资源

- [Three.js — How to dispose of objects](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)
- [Three.js Examples — Multiple Scenes](https://threejs.org/examples)
