# 第 8 课技术笔记：模型加载实现细节

> 日期：2026-07-28
> 状态：已完成
> 评分：9.2/10

---

## GLTF 格式详解

**GLTF vs GLB**：

| 格式 | 说明 | 适用场景 |
|------|------|----------|
| GLTF | JSON 文本，资源分散 | 开发调试 |
| GLB | 二进制，单文件 | 生产环境 |

## GLTFLoader 使用

**基础加载**：
```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
loader.load('/models/suzanne.glb', (gltf) => {
  scene.add(gltf.scene)
})
```

## LoadingManager 进度管理

**关键**：LoadingManager 必须传给 Loader 构造函数，否则 `onLoad` 不会触发。

```typescript
const manager = new THREE.LoadingManager()
manager.onProgress = (url, loaded, total) => {
  console.log(`${(loaded / total * 100).toFixed(0)}%`)
}
manager.onLoad = () => { /* 全部加载完成 */ }

const loader = new GLTFLoader(manager)
```

**LoadingScreen 类**：`src/core/LoadingScreen.ts`，自行创建 DOM 元素，不依赖 index.html。

## Draco 压缩

**原理**：通过量化、预测和熵编码压缩顶点数据，可减小 90%+。

**权衡**：网络传输 vs CPU 解码。小模型/localhost/低端设备下 Draco 反而更慢。

```typescript
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/')
dracoLoader.setDecoderConfig({ type: 'wasm' })
loader.setDRACOLoader(dracoLoader)
```

## 模型自动缩放和居中

```typescript
// 1. 计算包围盒
const box = new THREE.Box3().setFromObject(model)

// 2. 缩放（必须先缩放）
model.scale.setScalar(targetSize / Math.max(size.x, size.y, size.z))

// 3. 重新计算包围盒再居中（scale 改变了世界坐标）
const newBox = new THREE.Box3().setFromObject(model)
model.position.sub(newBox.getCenter(new THREE.Vector3()))
```

## LOD（Level of Detail）

```typescript
const lod = new THREE.LOD()
lod.addLevel(highPoly, 0)    // 近距离：高精度
lod.addLevel(lowPoly, 16)    // 远距离：低精度
scene.add(lod)

// 动画循环中更新
lod.update(camera)
```

## AnimationMixer 动画播放

```typescript
const mixer = new THREE.AnimationMixer(model)
const action = mixer.clipAction(gltf.animations[0])
action.setLoop(THREE.LoopRepeat, Infinity)
action.play()

// 动画循环中更新
mixer.update(delta)
```

## AnimationController 封装

`AnimationController` 类管理多个动画的播放/暂停/切换：
- `play(name, options)` — 播放指定动画，自动 fadeOut 当前动画
- `stop()` — 停止所有动画
- `update(delta)` — 每帧更新
- `getAnimationNames()` — 获取所有动画名称

## API 速查

| API | 用途 |
|-----|------|
| `new GLTFLoader(manager)` | 创建 GLTF 加载器（传入 manager） |
| `new DRACOLoader()` | 创建 Draco 解码器 |
| `new THREE.LoadingManager()` | 创建加载管理器 |
| `new THREE.LOD()` | 创建 LOD 对象 |
| `lod.addLevel(object, distance)` | 添加 LOD 级别 |
| `lod.update(camera)` | 每帧更新 LOD |
| `new THREE.AnimationMixer(model)` | 创建动画混合器 |
| `action.play()` / `action.stop()` | 播放/停止动画 |
| `mixer.update(delta)` | 更新动画 |
| `new LoadingScreen({ title })` | 创建加载界面（TS 类） |

---

## 📝 课后作业

### 作业要求：参考 my-room-in-3d 实现场景搭建

**参考案例**：[brunosimon/my-room-in-3d](https://github.com/brunosimon/my-room-in-3d)

**目标**：参考 Bruno Simon 的 my-room-in-3d 项目，用 GLTF 模型加载实现场景搭建，综合运用模型加载、材质、灯光、阴影、动画等前 8 课知识

**考察因素（100分）**：

| 项目 | 分值 | 说明 |
|------|------|------|
| 模型加载与展示 | 30分 | GLTFLoader 加载场景模型 + 自动缩放居中 |
| 材质与灯光 | 25分 | PBR 材质 + 三点照明 + 阴影 |
| 场景搭建 | 25分 | 多模型组合、空间布局合理 |
| 交互体验 | 20分 | OrbitControls 漫游 + 控制面板 |

**代码位置**：`src/homework/08-model-loading/main.ts`

### 运行方式

1. 修改 `src/main.ts` 入口指向作业代码：
   ```typescript
   // MODE = 'homework'
   import './homework/08-model-loading/main'
   ```

2. 启动开发服务器：
   ```bash
   cd ~/Documents/code/2026/@learn/threejs_creative_3d
   pnpm dev
   ```

3. 访问 http://localhost:3300/ 查看效果

### 作业代码功能说明

| 模块 | 功能 | 对应课程知识点 |
|------|------|----------------|
| **GLTFLoader** | 加载房间场景模型 | 第 8 课：模型加载 |
| **材质系统** | PBR 材质 + 环境贴图 | 第 3 课：材质系统 |
| **灯光布局** | 三点照明 + 阴影 | 第 4 课：灯光与阴影 |
| **OrbitControls** | 第一人称漫游 | 第 5 课：相机与控制 |
| **场景图** | 多模型父子关系 | 第 7 课：场景图与变换 |

### 评分标准

| 分数段 | 标准 |
|--------|------|
| 90-100 | 场景完整、灯光氛围好、交互流畅 |
| 80-89 | 核心场景完整，少量瑕疵 |
| 70-79 | 基本场景搭建，缺少部分细节 |
| 60-69 | 能加载模型但布局不合理 |
| <60 | 未完成或代码无法运行 |
