# 第 8 课：模型加载

> 掌握 GLTF/GLB 模型加载，理解 Draco 压缩和 LOD 策略，学会实现 Loading 进度条和动画播放。

## 核心概念

### GLTF 格式

GLTF（GL Transmission Format）是 3D 模型的"JPEG"：

| 格式 | 说明 | 适用场景 |
|------|------|----------|
| GLTF | JSON 文本，资源分散 | 开发调试 |
| GLB | 二进制，单文件 | 生产环境 |

### GLTFLoader 使用

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
loader.load('/models/suzanne.glb', (gltf) => {
  scene.add(gltf.scene)
})
```

### LoadingManager 进度管理

```typescript
const manager = new THREE.LoadingManager()
manager.onProgress = (url, loaded, total) => {
  console.log(`${(loaded / total * 100).toFixed(0)}%`)
}
manager.onLoad = () => { /* 全部加载完成 */ }
```

### Draco 压缩

Google 的 3D 几何压缩库，可减小 90%+ 文件大小：

```typescript
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
loader.setDRACOLoader(dracoLoader)
```

### LOD（Level of Detail）

根据距离切换不同精度的模型：

```typescript
const lod = new THREE.LOD()
lod.addLevel(highPoly, 0)    // 近距离：高精度
lod.addLevel(lowPoly, 50)    // 远距离：低精度
scene.add(lod)
```

### AnimationMixer 动画播放

```typescript
const mixer = new THREE.AnimationMixer(model)
const action = mixer.clipAction(gltf.animations[0])
action.play()

// 动画循环中更新
mixer.update(delta)
```

## 代码结构

```
src/lessons/08-model-loading/
└── main.ts    # GLTF 加载 + LoadingManager + 动画控制
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

## 复盘自测

1. **GLTF 和 GLB 的区别？** GLTF 是 JSON 文本，GLB 是二进制单文件，生产环境用 GLB。
2. **Draco 压缩原理？** 通过量化、预测和熵编码压缩顶点数据，利用网格拓扑结构减少冗余。
3. **LOD 何时使用？** 大场景中的远景物体，自动切换低精度模型节省性能。
4. **LoadingManager 作用？** 统一管理多资源加载进度，全部完成后才渲染。
5. **AnimationMixer.update 为何要 delta？** 保证动画速度与帧率无关。
