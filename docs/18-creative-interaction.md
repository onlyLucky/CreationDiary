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

### 5. Rapier 物理引擎接入（@dimforge/rapier3d-compat）

**为什么选 compat 版**：Rapier 核心是 Rust 编译的 wasm。非 compat 版把 `.wasm` 作为独立资源，需要配置 Vite 的 wasm 打包/资源路径；compat 版把 wasm 以 base64 内嵌进 JS，`import` 即用，代价是包体大（约 3 MB）。学习项目选 compat 省心。

**init 的异步性**：`await RAPIER.init()` 负责解码并编译 wasm，必须先 await 才能调用任何其他 Rapier API，否则直接报错。

**物理世界与渲染世界的同步模式**：

```
渲染帧（rAF）:
  world.step()                          ← 物理推进一步（固定步长 1/60）
  for (mesh, body) of pairs:
    p = body.translation()              ← 刚体算出的位置
    mesh.position.set(p.x, p.y, p.z)    ← 抄写给 Mesh
    r = body.rotation()
    mesh.quaternion.set(r.x, r.y, r.z, r.w)
  renderer.render(...)                  ← 渲染只负责画
```

要点：Rapier 与 Three.js 互不感知，靠「每帧把刚体状态抄写回 mesh」这条单向数据流连接；`translation()` 返回的是 Rapier 自己的 `{x,y,z}` 对象，不是 `THREE.Vector3`，不能直接 `copy()`，用 `set` 逐分量赋值最稳。

**固定时间步长 vs rAF 可变步长**：`world.timestep = 1/60` 表示每次 step 推进固定 1/60 秒。简单做法（本课）：一帧一步，60Hz 屏幕上物理时间 = 真实时间；但在 120Hz 屏幕上物理会跑两倍速。严谨做法是「累加器」：按真实流逝时间攒 dt，攒够一个固定步长才 step（可能一帧多步或零步），保证任意刷新率下物理表现一致。

**刚体与碰撞体**：`RigidBodyDesc.dynamic()`（受物理驱动）/ `.fixed()`（静止，如地面）创建刚体；`ColliderDesc.ball(r)` / `.cuboid(hx,hy,hz)` 挂碰撞体——注意 cuboid 用**半尺寸**；`restitution`（弹性）与 `friction`（摩擦）作用在碰撞体上。

---

## API 速查

| API | 用途 |
|-----|------|
| `THREE.Raycaster()` | 射线投射器 |
| `raycaster.setFromCamera(mouse, camera)` | 从鼠标位置设置射线 |
| `raycaster.intersectObjects(objects)` | 检测交叉 |
| `intersect.uv` | 交叉点的 UV 坐标 |
| `intersect.object` | 被击中的物体 |
| `RAPIER.init()` | 初始化 wasm（必须先 await） |
| `new RAPIER.World({x,y,z})` | 创建物理世界（参数是重力向量） |
| `world.timestep = 1/60` | 设置固定时间步长 |
| `world.step()` | 推进一次物理模拟 |
| `RAPIER.RigidBodyDesc.dynamic()/fixed()` | 动态/静止刚体描述 |
| `.setTranslation(x,y,z)` | 刚体初始位置 |
| `RAPIER.ColliderDesc.ball(r)/cuboid(hx,hy,hz)` | 球/长方体碰撞体（cuboid 半尺寸） |
| `.setRestitution(n)/.setFriction(n)` | 弹性/摩擦 |
| `world.createRigidBody(desc)` | 在世界中创建刚体 |
| `world.createCollider(desc, body)` | 给刚体挂碰撞体 |
| `world.removeRigidBody(body)` | 移除刚体（回收时用） |
| `body.translation()/rotation()` | 读取刚体位置/旋转（Rapier 自己的向量类型） |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| Raycaster | 鼠标拾取 | 坐标归一化 + 射线检测 |
| 涟漪 Shader | 交互反馈 | sin 波纹 + 指数衰减 |
| 相机跟随 | 视差效果 | lerp 平滑 |
| hover 高亮 | 状态反馈 | uHover uniform |
| Rapier 物理世界 | 掉落小球模拟 | step 同步模式 + 固定时间步长 + 点击生成/回收 |

---

## 常见错误

- 鼠标坐标没归一化 → Raycaster 方向完全错误
- `intersectObjects` 忘记传 `true` 递归 → 子物体检测不到
- 涟漪 Shader 的 `uRippleTime` 没重置 → 只能触发一次
- 移动端没有 touch 事件 → 触摸设备无法交互
- 忘记 `await RAPIER.init()` → 任何 Rapier 调用直接报错（wasm 未就绪）
- 用 `mesh.position.copy(body.translation())` → Rapier 向量与 THREE.Vector3 类型不同，TS 报错；应 `set(p.x, p.y, p.z)`
- 每帧只 step 一次但屏幕是 120Hz → 物理跑两倍速；需要累加器方案才能与刷新率解耦
- 回收刚体只删 mesh 不 `removeRigidBody` → 物理世界持续计算幽灵刚体，越跑越卡

---

## 相关资源

- [Three.js Raycaster 文档](https://threejs.org/docs/#api/en/core/Raycaster)
- [Three.js Examples — Raycasting](https://threejs.org/examples/#webgl_raycast)
- [Rapier 官方文档](https://rapier.rs/docs/) — Rust 编写的物理引擎，JS 绑定
- [rapier.js 用户指南 — compat 与非 compat 版](https://rapier.rs/docs/user-guides/javascript/getting_started)
