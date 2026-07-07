# 第 1 课技术笔记：SceneManager 实现细节

> 日期：2026-07-06

---

## SceneManager 设计决策

### 为什么用 class 而不是函数式？

Three.js 的 Scene/Camera/Renderer 三件套需要被多个回调共享。class 天然适合这种"有状态的模块"：

```typescript
// class 方式：状态自然绑定
const manager = new SceneManager({ canvas })
manager.onUpdate((delta) => { /* 能访问 manager.scene */ })

// 函数式方式：需要手动传递闭包
const state = createSceneManager({ canvas })
state.onUpdate((delta) => { /* 能访问 state.scene */ })
```

两种都行，class 读起来更直觉。

### onUpdate 回调列表 vs 单一 update 函数

```typescript
// 回调列表：允许多个模块独立注册
manager.onUpdate((delta) => { cube.rotation.x += delta })
manager.onUpdate((delta) => { light.intensity = Math.sin(elapsed) })

// 单一函数：所有逻辑堆在一起
manager.onUpdate((delta) => {
  cube.rotation.x += delta
  light.intensity = Math.sin(elapsed)
})
```

回调列表的好处是模块解耦，每个模块只管自己的更新逻辑。

### registerDisposable 的必要性

Three.js 的 Geometry、Material、Texture 都占用 GPU 内存，JS 的 GC 无法自动回收。

```typescript
// 不清理 → GPU 内存泄漏
const geometry = new THREE.BoxGeometry()
// 切换场景后 geometry 还在 GPU 里

// 正确做法
geometry.dispose()  // 手动释放 GPU 资源
```

SceneManager 的 `registerDisposable` 让你提前注册，`dispose()` 时统一清理。

---

## 踩坑记录

### 1. MeshNormalMaterial 不需要灯光

```typescript
// NormalMaterial 用法线方向做颜色，不需要 Light
const material = new THREE.MeshNormalMaterial()

// MeshStandardMaterial 需要灯光，否则全黑
const material = new THREE.MeshStandardMaterial()
// 忘记加 light → 画面全黑
```

### 2. camera.position.z = 5 的原因

相机默认在 (0, 0, 0)，立方体也在 (0, 0, 0)。相机在物体内部，看不到任何东西。

```typescript
camera.position.z = 5  // 往后退 5 个单位才能看到
```

### 3. setPixelRatio 的坑

```typescript
// 错误：不设 pixel ratio → Retina 屏模糊
renderer.setSize(width, height)

// 正确：考虑设备像素比
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
```

---

## API 速查

| API | 用途 |
|-----|------|
| `new THREE.Scene()` | 创建场景 |
| `new THREE.PerspectiveCamera(fov, aspect, near, far)` | 透视相机 |
| `new THREE.WebGLRenderer({ canvas, antialias })` | 创建渲染器 |
| `renderer.setSize(w, h)` | 设置渲染尺寸 |
| `renderer.setPixelRatio(n)` | 设置像素比 |
| `renderer.render(scene, camera)` | 执行一次渲染 |
| `renderer.dispose()` | 释放渲染器资源 |
| `camera.updateProjectionMatrix()` | 更新相机投影矩阵 |
| `geometry.dispose()` | 释放几何体 GPU 资源 |
| `material.dispose()` | 释放材质 GPU 资源 |
| `requestAnimationFrame(callback)` | 浏览器下一帧回调 |
| `cancelAnimationFrame(id)` | 取消帧回调 |
