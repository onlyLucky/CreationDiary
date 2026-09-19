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

关键认知：`scene.remove(mesh)` 只让对象不参与渲染，GPU 侧的顶点缓冲区**不会回收**。切换场景时必须真正调用 dispose：

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

**验证资源真的被释放 —— `renderer.info.memory`**：

```typescript
const before = { ...renderer.info.memory }
oldScene.dispose()
const after = renderer.info.memory
console.log(`geometries: ${before.geometries} -> ${after.geometries}, textures: ${before.textures} -> ${after.textures}`)
```

- `info.memory.geometries / textures` 是当前驻留 GPU 的资源计数
- 几何体在**首帧渲染后**才计入（GPU buffer 是懒上传的），dispose 则同步递减
- 打开控制台切换场景，看到计数回落，说明释放真的发生了

### 4. 预加载 vs 按需加载

| | 预加载 | 按需加载 |
|--|--|--|
| 首次加载 | 慢（加载所有资源） | 快（只加载当前页面） |
| 切换体验 | 快（已缓存） | 慢（需要等待） |
| 带宽消耗 | 高（可能浪费） | 低（按需） |
| 适用场景 | 小项目、资源少 | 大项目、资源多 |

本课采用按需加载：管理器注册的是场景**工厂函数**，切换到它时才创建实例；配合 LoadingScreen 过渡页掩盖创建耗时（模拟异步资源准备）。

### 5. hash 路由 —— 与 React Router 的对应关系

hash 路由的全部要素：读 `location.hash` + 监听 `hashchange`。React Router 的 HashRouter 本质就是这件事的封装：

```typescript
/** 路由表：地址 ↔ 场景 */
const ROUTE_TO_SCENE: Record<string, SceneName> = {
  'scene-a': 'geometry',
  'scene-b': 'particles',
  'scene-c': 'shader',
}

/** hash 变化的唯一入口（浏览器前进/后退按钮也会触发 hashchange） */
window.addEventListener('hashchange', applyRoute)

function applyRoute() {
  const route = location.hash.replace('#', '') || 'scene-a'
  const sceneName = ROUTE_TO_SCENE[route] ?? 'geometry'
  if (sceneName !== store.getState().currentScene) {
    store.setState({ currentScene: sceneName })
  }
}
```

在 React 项目里挂接 3D 场景管理器 —— `useEffect` 管生命周期，路由参数驱动切换：

```tsx
function App() {
  const { scene } = useParams()            // React Router 提供
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const managerRef = useRef<SceneManagerMulti | null>(null)

  useEffect(() => {
    const manager = new SceneManagerMulti(renderer)
    manager.addScene('geometry', createGeometryScene)
    // ... 注册其他场景
    managerRef.current = manager
    return () => manager.destroy()          // 组件卸载 = 销毁全部资源
  }, [])

  useEffect(() => {
    managerRef.current?.switchScene(scene)  // 路由变化 = 切场景
  }, [scene])

  return <canvas ref={canvasRef} />
}
```

对应关系：

| 本课手写 | React Router 对应 |
|----------|-------------------|
| 读 `location.hash` 解析路由 | `useParams()` / `useSearchParams()` |
| `hashchange` 监听 | 路由状态变化 → 组件重渲染 |
| `applyRoute()` 手动调用 | Router 自动响应 |
| `location.hash = route` 写地址 | `navigate('/scene-b')` |

### 6. 发布订阅 store —— 这就是 Zustand 的核心思想

状态散在各闭包里的问题：下拉框要通知管理器、管理器要通知 UI、路由还要通知两者……改一处牵三处。解法是**单一数据源**，30 行以内：

```typescript
function createPubSubStore<T extends object>(initialState: T) {
  let state = initialState
  const listeners = new Set<(state: T, prevState: T) => void>()

  return {
    getState: () => state,
    setState(partial: Partial<T>) {
      const prevState = state
      state = { ...state, ...partial }
      listeners.forEach((listener) => listener(state, prevState))
    },
    subscribe(listener: (state: T, prevState: T) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }   // 取消订阅
    },
  }
}
```

这就是 Zustand 的全部核心：**外部 store + 订阅更新**。Zustand 额外提供的只是 React 绑定（`useStore` hook 用 `useSyncExternalStore` 实现）、中间件与 immer 糖。

本课的单一数据流：

```
下拉框 onChange ────┐
                    ├──> 只改 hash / store ──> 订阅者响应：
地址栏 / 前进后退 ───┘        1. 同步地址栏  2. 同步下拉框  3. manager.switchScene()
```

原则：**任何入口只改状态源，不直接调用彼此**。避免相互触发时写防抖/去重的补丁代码（如 hash 写回前先判断是否已一致）。

---

## API 速查

| API | 用途 |
|-----|------|
| `geometry.dispose()` | 释放几何体 GPU 内存 |
| `material.dispose()` | 释放材质 |
| `texture.dispose()` | 释放纹理 |
| `renderer.dispose()` | 释放 WebGL 上下文 |
| `renderer.info.memory.geometries` | 驻留 GPU 的几何体数量（首帧渲染后才计入） |
| `renderer.info.memory.textures` | 驻留 GPU 的纹理数量 |
| `LoadingScreen.show() / update(0~1) / hide()` | 显示 / 汇报进度 / 隐藏（core 现成组件） |
| `location.hash` + `hashchange` | hash 路由的「读」与「听」 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| SceneManagerMulti | 场景管理器 | 工厂注册/按需创建/销毁旧场景/Loading 过渡 |
| createGeometryScene | 几何体场景 | 独立 Scene + dispose |
| createParticleScene | 粒子场景 | BufferGeometry 管理 |
| createShaderScene | Shader 场景 | ShaderMaterial 管理 |
| createPubSubStore | 发布订阅 store | 单一数据源/Zustand 核心思想 |
| hash 路由 | #scene-a/b/c ↔ 三场景 | location.hash + hashchange + 双向同步 |

---

## 常见错误

- 忘记 dispose → WebGL 上下文资源耗尽（画面冻结）
- 只 `scene.remove()` 不 `dispose()` → 对象不渲染了，但 GPU buffer 还在，泄漏照旧
- 只 dispose geometry 忘记 material/texture → 内存泄漏
- 切换后立刻看 memory 计数「没降」→ 新场景几何体首帧渲染后才计入，属正常现象
- 下拉框与 hash 相互触发死循环 → 写 hash 前先判断值是否已一致；反向同步 UI 用不触发 onChange 的 `setValue`
- 场景切换时还在更新旧场景 → 性能浪费
- 没有处理 resize 事件 → 新场景相机比例错误

---

## 相关资源

- [Three.js — How to dispose of objects](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)
- [Three.js Examples — Multiple Scenes](https://threejs.org/examples)
- [Zustand — 官方文档（vanilla store 一节就是本课的手写版）](https://zustand.docs.pmnd.rs/)
- [React Router — HashRouter 与 useParams](https://reactrouter.com/)
