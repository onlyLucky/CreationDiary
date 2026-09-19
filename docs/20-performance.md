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

## 部署

### 构建与产物

```bash
pnpm build   # 产物输出到 dist/
pnpm preview # 本地预览构建产物
```

`dist/` 是纯静态文件，任何静态托管都能直接部署。

### base: './'（相对路径）

`vite.config.ts` 里配置了 `base: './'`：所有资源引用都写成相对路径，构建产物放到**任意静态目录**（包括子路径）都能跑。

类比：`base` 就像邀请函上的地址写法——写绝对地址（`/assets/main.js`）意味着客人必须从城市大门（域名根）进来才找得到；写相对地址（`./assets/main.js`）意味着客人从哪条路进来都能按相对位置找到。

三种 base 取值对比：

| base | 资源引用 | 适用 |
|------|---------|------|
| `'/'`（默认） | `/assets/main.js` | 只部署在域名根 |
| `'./'`（本项目） | `./assets/main.js` | 根路径 / 子路径 / GitHub Pages 项目页 |
| `'/my-app/'` | `/my-app/assets/main.js` | 固定子路径部署 |

本项目用 hash 路由（`#lesson-17`），路由不占 URL 路径段，`base: './'` 是最省心的选择。

### 分包（manualChunks）

`vite.config.ts` 把 three 和 gsap 拆成独立 chunk：

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks(id: string) {
        if (id.includes('gsap')) return 'gsap'
        if (id.includes('node_modules') && id.includes('three')) return 'three'
      },
    },
  },
},
```

好处：业务代码（课程示例）改动后，浏览器只需重新下载变动的 `main-*.js`，`three` / `gsap` chunk 的文件名（hash）不变，缓存继续有效。Vite 8（rolldown）的 `manualChunks` 只接受函数形式，不接受对象形式。

另注意：20 个课程通过 `import.meta.glob` 动态导入，构建后每课各自一个 `main-*.js` 懒加载 chunk——首屏只加载入口 + 选中的那一课，这正是分批加载的意义。

gsap chunk 约 750KB（gzip 约 207KB），会触发 Vite 的 chunk 体积警告；这是 gsap 全量插件的体积，属于预期，可用 `build.chunkSizeWarningLimit` 调整警告阈值或后续按需引入插件。

### Draco 解码器路径（已知问题）

加载 Draco 压缩模型时，`DRACOLoader` 会按 `setDecoderPath()` 给的路径去 fetch 解码器（wasm/js）。项目里有两处写法、三种可能状态：

| 位置 | 当前写法 | dev | 根路径部署 | 子路径部署 |
|------|---------|-----|-----------|-----------|
| `lessons/08` | `'three/examples/jsm/libs/draco/'` | ✗ 404 | ✗ 404 | ✗ 404 |
| `homework/08` | `'/draco/'`（public/ 下有对应文件） | ✓ | ✓ | ✗ 指向域名根 |

说明：

- `lessons/08` 的包路径写法只是传给 `setDecoderPath` 的普通字符串，Vite 不会据此拷贝文件，运行时 fetch 不到。当前演示模型（Duck.glb、suzanne.glb 等）都不是 Draco 压缩的，解码器从未被真正请求，所以问题没暴露。
- 构建产物 `assets/` 里出现的带 hash 的 `draco_decoder-*.wasm` 是 Vite 8 自动资源处理的产物，文件名对不上运行时 fetch 路径，不能直接用。
- 正确做法：解码器文件放在 `public/draco/`（构建时原样拷贝到 `dist/draco/`），代码里写 `dracoLoader.setDecoderPath('./draco/')`——相对路径在根路径和子路径部署下都成立。两处代码建议统一改成这个写法。

### 静态托管平台要点

| 平台 | Framework Preset | 输出目录 | 备注 |
|------|-----------------|---------|------|
| Vercel | Vite | `dist` | 导入 Git 仓库后自动识别；构建命令默认 `npm run build` |
| Netlify | Vite | `dist` | 同上；可在 `netlify.toml` 里固化配置 |
| GitHub Pages | 无 | `dist` | 用官方 Pages 部署工作流（actions/deploy-pages）；项目页是子路径，`base: './'` 已兼容 |

三者都是「选仓库 → 指定构建命令和输出目录 → 部署」，`base: './'` 配好后无需任何平台特殊设置。

### 体积预算

| 资源 | 建议 |
|------|------|
| 单页首屏（HTML + JS + CSS） | < 500KB（gzip 后） |
| 全页资源（含模型纹理） | < 5MB |
| 单张纹理 | ≤ 1024×1024；能压缩用 KTX2/WebP |
| 单个模型 | < 2MB；Draco 压缩 |

public/ 下的 room 场景模型与烘焙纹理较大（构建产物总量约 50MB），仅第 08 课按需加载，不影响其他课程首屏；若日后部署给移动端用户，优先压缩这批资源。

---

## 相关资源

- [Three.js — Instancing](https://threejs.org/docs/#api/en/objects/InstancedMesh)
- [Three.js Examples — Instancing Performance](https://threejs.org/examples/#webgl_instancing_performance)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
