# 第 20 课技术笔记：性能调优与部署实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. Draw Call

CPU 向 GPU 发送一次渲染指令。每个 Draw Call 有固定的 CPU 开销（状态切换、数据传输）。

- 1000 个独立 Mesh = 1000 个 Draw Call → CPU 瓶颈
- 1 个 InstancedMesh（1000 实例）= 1 个 Draw Call → GPU 瓶颈

### 2. InstancedMesh 批量渲染

一次 Draw Call 渲染成千上万个相同几何体的实例。

```typescript
const mesh = new THREE.InstancedMesh(geometry, material, count)
const dummy = new THREE.Object3D()
for (let i = 0; i < count; i++) {
  dummy.position.set(...)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
  mesh.setColorAt(i, color)
}
```

### 3. 性能监控

```typescript
const info = renderer.info
console.log(info.render.calls)     // Draw Call 数量
console.log(info.render.triangles) // 三角形数量
console.log(info.memory.geometries) // 几何体数量
console.log(info.memory.textures)   // 纹理数量
```

### 4. 优化策略

| 策略 | 方法 | 效果 |
|------|------|------|
| 减少 Draw Call | InstancedMesh / 合并几何体 | ↓ CPU 开销 |
| 纹理压缩 | KTX2 / Basis / WebP | ↓ 显存 / ↓ 加载时间 |
| LOD | 远处用低面数模型 | ↓ 三角形数量 |
| Shader 优化 | 减少分支 / 采样次数 | ↓ GPU 时间 |
| Tree-shaking | Vite 自动移除未使用代码 | ↓ 包体积 |

### 5. InstancedMesh vs 合并几何体

| | InstancedMesh | 合并几何体 |
|--|--|--|
| 独立控制 | ✅ 每个实例可独立位置/颜色/缩放 | ❌ 合并后不可独立修改 |
| 内存 | 低（共享一份几何体） | 高（合并后顶点数据重复） |
| 动态更新 | ✅ setMatrixAt | ❌ 需要重建 |
| 适用 | 大量相同物体（草/石头/粒子） | 静态场景（建筑/地形） |

---

## API 速查

| API | 用途 |
|-----|------|
| `THREE.InstancedMesh(geo, mat, count)` | 实例化网格 |
| `instancedMesh.setMatrixAt(i, matrix)` | 设置第 i 个实例的变换矩阵 |
| `instancedMesh.setColorAt(i, color)` | 设置第 i 个实例的颜色 |
| `renderer.info` | 渲染信息（Draw Call/三角形/内存） |
| `BufferGeometryUtils.mergeGeometries()` | 合并多个几何体 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| createNormalMeshes | 普通 Mesh 渲染 | 每个一个 Draw Call |
| createInstancedMeshes | InstancedMesh 渲染 | 一次 Draw Call |
| PerformanceMonitor | 性能监控 | FPS / Draw Calls / 内存 |

---

## 常见错误

- `renderer.info` 在每帧重置前读取 → 数据不准确
- InstancedMesh 的 count 写死 → 无法动态增减实例
- 合并几何体后尝试独立修改 → 不可能
- 忘记 `instanceMatrix.needsUpdate = true` → 实例位置不更新

---

## 相关资源

- [Three.js — Instancing](https://threejs.org/docs/#api/en/objects/InstancedMesh)
- [Three.js Examples — Instancing Performance](https://threejs.org/examples/#webgl_instancing_performance)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
