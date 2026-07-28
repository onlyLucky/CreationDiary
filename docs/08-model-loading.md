# 第 8 课技术笔记：模型加载实现细节

> 日期：2026-07-27
> 状态：进行中

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

## Draco 压缩

**原理**：Google 的 3D 几何压缩库，通过量化、预测和熵编码压缩顶点数据。

```typescript
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
loader.setDRACOLoader(dracoLoader)
```

## 模型自动缩放和居中

**算法**：
```typescript
// 1. 计算包围盒
const box = new THREE.Box3().setFromObject(model)
const size = box.getSize(new THREE.Vector3())

// 2. 缩放
const maxDim = Math.max(size.x, size.y, size.z)
model.scale.setScalar(targetSize / maxDim)

// 3. 重新计算包围盒并居中（scale 改变了世界坐标）
const newBox = new THREE.Box3().setFromObject(model)
model.position.sub(newBox.getCenter(new THREE.Vector3()))
```

## LOD（Level of Detail）

```typescript
const lod = new THREE.LOD()
lod.addLevel(highPoly, 0)    // 近距离：高精度
lod.addLevel(lowPoly, 50)    // 远距离：低精度
scene.add(lod)
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

## API 速查

| API | 用途 |
|-----|------|
| `new GLTFLoader()` | 创建 GLTF 加载器 |
| `new DRACOLoader()` | 创建 Draco 解码器 |
| `new THREE.LoadingManager()` | 创建加载管理器 |
| `new THREE.LOD()` | 创建 LOD 对象 |
| `new THREE.AnimationMixer(model)` | 创建动画混合器 |
| `action.play()` / `action.stop()` | 播放/停止动画 |
| `mixer.update(delta)` | 更新动画 |
