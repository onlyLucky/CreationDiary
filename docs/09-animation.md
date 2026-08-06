# 第 9 课技术笔记：动画系统实现细节

> 日期：2026-07-30
> 状态：已完成
> 评分：9.8/10

---

## requestAnimationFrame vs GSAP

| 特性 | requestAnimationFrame | GSAP |
|------|----------------------|------|
| 用途 | 每帧逻辑（物理、LOD、渲染） | 补间动画（平滑过渡） |
| 控制 | 手动管理 delta、进度 | 自动插值、缓动曲线 |
| 缓动 | 需要自己实现 | 内置 30+ 缓动函数 |
| 序列 | 需要自己编排 | timeline 一行搞定 |
| 性能 | 最优 | 优秀（自动优化） |

**两者可以同时使用**：rAF 做渲染循环，GSAP 做动画控制。

## gsap.to() — 补间动画

```typescript
import gsap from 'gsap'

// 基础用法
gsap.to(cube.position, {
  x: 3,
  duration: 1.5,
  ease: 'power2.inOut',
  repeat: -1,    // 无限重复
  yoyo: true,    // 来回播放
})

// 回调
gsap.to(cube.position, {
  x: 3,
  duration: 1,
  onComplete: () => console.log('动画完成'),
  onStart: () => console.log('动画开始'),
})
```

## gsap.from() — 入场动画

```typescript
// 从指定状态动画到当前状态
gsap.from(cube.scale, {
  x: 0, y: 0, z: 0,
  duration: 1,
  ease: 'back.out(1.7)',  // 回弹效果
})
```

**注意**：from() 会立即应用初始值（immediateRender: true）。

## gsap.timeline() — 时间线

```typescript
const tl = gsap.timeline({
  defaults: { duration: 0.8, ease: 'power2.out' },
  repeat: -1,
  yoyo: true,
})

tl.to(cube.position, { x: 3 })           // 先移到右边
  .to(cube.position, { y: 2 }, '<')      // 同时上移（"<" = 与前一个同时开始）
  .to(cube.rotation, { y: Math.PI }, '-=0.4')  // 提前 0.4s 开始旋转
  .to(cube.scale, { x: 1.5 })            // 放大
```

**位置参数**：
- `1` — 第 1 秒
- `"+=0.5"` — 前一个动画结束后 0.5s
- `"-=0.2"` — 前一个动画结束前 0.2s
- `"<"` — 与前一个动画同时开始
- `"<0.2"` — 前一个动画开始后 0.2s

## GSAP 缓动函数

| 缓动 | 效果 | 适用场景 |
|------|------|----------|
| `"power1.out"` | 默认，平滑减速 | 通用 |
| `"power2.inOut"` | 平滑加速减速 | 移动过渡 |
| `"back.out(1.7)"` | 回弹 | 入场动画 |
| `"bounce.out"` | 弹跳 | 落地效果 |
| `"elastic.out(1, 0.3)"` | 弹性 | 强调效果 |
| `"none"` | 线性 | 匀速旋转 |

## AnimationMixer — 模型动画

AnimationMixer 是 Three.js 的动画播放器，用于播放模型自带的骨骼/关键帧动画。

**基本流程**：

```typescript
// 1. 创建 mixer
const mixer = new THREE.AnimationMixer(model)

// 2. 获取动画片段
const clip = gltf.animations[0]

// 3. 创建 action 并播放
const action = mixer.clipAction(clip)
action.setLoop(THREE.LoopRepeat, Infinity)
action.play()

// 4. 动画循环中更新
mixer.update(delta)
```

**AnimationAction 控制方法**：

| 方法 | 作用 | 说明 |
|------|------|------|
| `play()` | 播放 | 从当前位置继续播放 |
| `pause()` | 暂停 | 保持当前位置 |
| `stop()` | 停止 | 重置到初始状态 |
| `reset()` | 重置 | 回到第 0 帧 |
| `resetToLoopStart()` | 重置到循环起点 | 回到当前循环的起点 |

**循环模式**：

| 模式 | 效果 | 说明 |
|------|------|------|
| `THREE.LoopOnce` | 播放一次 | 播完停止在最后一帧 |
| `THREE.LoopRepeat` | 循环播放 | 播完从头开始 |
| `THREE.LoopPingPong` | 来回播放 | 播完倒放回来 |

```typescript
// 设置循环模式
action.setLoop(THREE.LoopRepeat, Infinity)  // 无限循环
action.setLoop(THREE.LoopOnce, 1)           // 只播放一次
action.setLoop(THREE.LoopPingPong, 3)       // 来回播放 3 次
```

**时间缩放（timeScale）**：

```typescript
// 暂停动画
mixer.timeScale = 0

// 恢复播放
mixer.timeScale = 1

// 慢放（0.5 倍速）
mixer.timeScale = 0.5

// 快进（2 倍速）
mixer.timeScale = 2

// 倒放
mixer.timeScale = -1
```

**权重（weight）**：

```typescript
// 设置动画权重（0-1）
action.weight = 0.5  // 50% 混合

// 多动画混合
const walkAction = mixer.clipAction(walkClip)
const runAction = mixer.clipAction(runClip)

walkAction.weight = 0.7  // 70% 走路
runAction.weight = 0.3   // 30% 跑步

walkAction.play()
runAction.play()
```

**动画事件**：

```typescript
// 监听动画完成事件
action.getMixer().addEventListener('finished', (event) => {
  console.log('动画播放完成:', event.action.getClip().name)
})

// 监听循环完成事件
action.getMixer().addEventListener('loop', (event) => {
  console.log('循环完成:', event.action.getClip().name)
})
```

## KeyframeTrack — 手动关键帧

KeyframeTrack 是 Three.js 动画系统的基础，用于定义属性随时间变化的关键帧序列。

**四种 KeyframeTrack 类型**：

| 类型 | 用途 | 值格式 |
|------|------|--------|
| `VectorKeyframeTrack` | 位置、缩放 | `[x,y,z, x,y,z, ...]` |
| `QuaternionKeyframeTrack` | 旋转 | 四元数 `[x,y,z,w, ...]` |
| `ColorKeyframeTrack` | 颜色 | `[r,g,b, r,g,b, ...]` |
| `NumberKeyframeTrack` | 透明度、数值 | `[v1, v2, ...]` |

**插值方式**：

| 插值 | 效果 | 适用场景 |
|------|------|----------|
| `InterpolateLinear`（默认） | 平滑过渡 | 位置、透明度 |
| `InterpolateDiscrete` | 瞬间切换 | 颜色、离散状态 |
| `InterpolateSmooth` | 平滑曲线 | 需要更自然的过渡 |

```typescript
// 位置关键帧（VectorKeyframeTrack）
// 原点 → 右上 → 左下 → 回原点
const positionKF = new THREE.VectorKeyframeTrack(
  '.position',
  [0, 1, 2, 3],
  [
    0, 0, 0,       // t=0: 原点
    5, 5, 0,       // t=1: 右上
    -5, -3, 0,     // t=2: 左下
    0, 0, 0,       // t=3: 回原点
  ],
)

// 旋转关键帧（QuaternionKeyframeTrack）
const xAxis = new THREE.Vector3(1, 0, 0)
const qInitial = new THREE.Quaternion().setFromAxisAngle(xAxis, 0)
const qFinal = new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI)

const quaternionKF = new THREE.QuaternionKeyframeTrack(
  '.quaternion',
  [0, 1, 2],
  [
    qInitial.x, qInitial.y, qInitial.z, qInitial.w,
    qFinal.x, qFinal.y, qFinal.z, qFinal.w,
    qInitial.x, qInitial.y, qInitial.z, qInitial.w,
  ],
)

// 颜色关键帧（ColorKeyframeTrack）— 离散插值，瞬间切换
const colorKF = new THREE.ColorKeyframeTrack(
  '.material.color',
  [0, 1, 2],                           // 时间点
  [1,0,0, 0,1,0, 0,0,1],              // 红 → 绿 → 蓝
  THREE.InterpolateDiscrete,           // 离散插值
)

// 透明度关键帧（NumberKeyframeTrack）— 线性插值，平滑过渡
const opacityKF = new THREE.NumberKeyframeTrack(
  '.material.opacity',
  [0, 1, 2],                           // 时间点
  [1, 0, 1],                           // 完全透明 → 不透明 → 完全透明
)

// 组合成动画片段
const clip = new THREE.AnimationClip('myAnimation', 3, [
  positionKF,
  quaternionKF,
  colorKF,
  opacityKF,
])

// 用 AnimationMixer 播放
const mixer = new THREE.AnimationMixer(cube)
const action = mixer.clipAction(clip)
action.play()
```

## AnimationObjectGroup — 多对象共享动画

```typescript
// 创建动画组，所有加入的对象共享同一个动画状态
const animationGroup = new THREE.AnimationObjectGroup()

// 多个对象加入组
cubes.forEach(cube => animationGroup.add(cube))

// 用组作为 Mixer 的根对象
const mixer = new THREE.AnimationMixer(animationGroup)
const action = mixer.clipAction(clip)
action.play()

// 性能优势：关键帧求值只做一次，结果广播给所有对象
```

## BlendMode — 动画混合模式

| 模式 | 效果 | 适用场景 |
|------|------|----------|
| `NormalAnimationBlendMode`（默认） | 直接覆盖 | 单一动画 |
| `AdditiveAnimationBlendMode` | 叠加增量 | 多动画组合（走路+挥手） |

```typescript
// Normal 模式：动画值直接覆盖目标属性
const clip1 = new THREE.AnimationClip('walk', 2, [walkTrack])

// Additive 模式：动画值是相对于参照姿态的偏移
const clip2 = new THREE.AnimationClip('wave', 1, [waveTrack], THREE.AdditiveAnimationBlendMode)
```

## API 速查

| API | 用途 |
|-----|------|
| `gsap.to(target, vars)` | 补间动画 |
| `gsap.from(target, vars)` | 入场动画 |
| `gsap.timeline(opts)` | 时间线 |
| `tl.to(target, vars, position)` | 时间线添加动画 |
| `tween.kill()` | 销毁动画 |
| `tween.pause()` | 暂停动画 |
| `tween.play()` | 播放动画 |
| `new THREE.AnimationMixer(model)` | 创建动画混合器 |
| `mixer.clipAction(clip)` | 创建动画动作 |
| `mixer.update(delta)` | 更新动画 |
| `mixer.timeScale` | 时间缩放（0=暂停，1=正常，-1=倒放） |
| `action.setLoop(mode, count)` | 设置循环模式 |
| `action.weight` | 设置动画权重 |
| `new THREE.VectorKeyframeTrack()` | 位置关键帧 |
| `new THREE.QuaternionKeyframeTrack()` | 旋转关键帧 |
| `new THREE.ColorKeyframeTrack()` | 颜色关键帧 |
| `new THREE.NumberKeyframeTrack()` | 数值关键帧 |
| `new THREE.AnimationClip()` | 动画片段 |
| `new THREE.AnimationObjectGroup()` | 动画对象组 |
