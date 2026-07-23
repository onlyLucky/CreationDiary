# 第 6 课技术笔记：纹理与贴图实现细节

> 日期：2026-07-23
> 状态：已完成
> 评分：9.4/10

---

## 纹理类型对比

| 纹理类型 | 作用 | 加载方式 | 适用场景 |
|----------|------|----------|----------|
| 图片纹理 | 给几何体表面贴图 | TextureLoader | 皮肤、材质、贴花 |
| 立方体纹理 | 6 面立方体包裹 | CubeTextureLoader | 天空盒、环境反射 |
| HDRI 纹理 | 高动态范围环境图 | RGBELoader | 环境光照、反射 |
| Canvas 纹理 | 程序生成纹理 | CanvasTexture | 动态纹理、数据可视化 |

## TextureLoader 加载纹理

```typescript
const textureLoader = new THREE.TextureLoader()

textureLoader.load(
  '/textures/image.jpg',
  (texture) => {
    // 加载成功
    material.map = texture
    material.needsUpdate = true
  },
  (progress) => {
    console.log('加载进度:', (progress.loaded / progress.total * 100) + '%')
  },
  (error) => {
    console.error('加载失败:', error)
  }
)
```

**注意**：TextureLoader.load() 是异步的！

## UV 坐标系统

**UV 坐标**：决定纹理如何映射到几何体表面

```
V (1,1) ┌─────────┐
        │         │
        │  纹理   │
        │         │
   (0,0)└─────────┘ U (1,0)
```

- U：水平方向（0 → 1）
- V：垂直方向（0 → 1）
- (0,0)：左下角
- (1,1)：右上角

## 纹理变换参数

### repeat — 纹理重复次数

```typescript
texture.repeat.set(2, 2)  // 水平和垂直各重复 2 次
```

### offset — 纹理偏移量

```typescript
texture.offset.set(0.5, 0)  // 水平偏移 0.5（半个纹理宽度）
```

### rotation — 纹理旋转

```typescript
texture.rotation = Math.PI / 4  // 旋转 45 度
```

### wrapS / wrapT — 环绕模式

| 模式 | 效果 | 适用场景 |
|------|------|----------|
| RepeatWrapping | 重复 | 地面、墙壁 |
| ClampToEdgeWrapping | 边缘拉伸 | 单张贴图 |
| MirroredRepeatWrapping | 镜像重复 | 无缝纹理 |

```typescript
texture.wrapS = THREE.RepeatWrapping
texture.wrapT = THREE.RepeatWrapping
```

## CubeTextureLoader 加载天空盒

```typescript
const cubeTextureLoader = new THREE.CubeTextureLoader()

const envMap = cubeTextureLoader.load([
  '/textures/skybox/px.jpg',  // 右（+X）
  '/textures/skybox/nx.jpg',  // 左（-X）
  '/textures/skybox/py.jpg',  // 上（+Y）
  '/textures/skybox/ny.jpg',  // 下（-Y）
  '/textures/skybox/pz.jpg',  // 前（+Z）
  '/textures/skybox/nz.jpg',  // 后（-Z）
])

// 设置为场景背景
scene.background = envMap

// 设置为环境贴图（让金属物体反射）
scene.environment = envMap
```

## RGBELoader 加载 HDRI 环境贴图

```typescript
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

const rgbeLoader = new RGBELoader()
rgbeLoader.load('/textures/venice-sunset.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = texture  // 环境光照
  scene.background = texture   // 背景（可选）
})
```

**HDRI vs CubeTextureLoader**：
- HDRI：单张图片，球形映射，光照信息更丰富
- CubeTextureLoader：6 张图片，立方体映射，性能更好

## 环境贴图（envMap）

**作用**：让物体反射周围环境

```typescript
// 方式 1：通过 scene.environment 自动应用
scene.environment = envMap
const material = new THREE.MeshStandardMaterial({
  metalness: 1,
  roughness: 0,
})

// 方式 2：手动设置到材质
const material = new THREE.MeshStandardMaterial({
  envMap: envMap,
  metalness: 1,
  roughness: 0,
  envMapIntensity: 1.0,
})
```

**金属度与粗糙度对反射的影响**：
- metalness=1, roughness=0 → 完美镜面反射
- metalness=1, roughness=0.5 → 模糊反射
- metalness=0 → 不反射环境

## Canvas 纹理生成

```typescript
const canvas = document.createElement('canvas')
canvas.width = 512
canvas.height = 512
const ctx = canvas.getContext('2d')!

// 绘制内容
ctx.fillStyle = '#ffffff'
ctx.fillRect(0, 0, 512, 512)

const texture = new THREE.CanvasTexture(canvas)
texture.wrapS = THREE.RepeatWrapping
texture.wrapT = THREE.RepeatWrapping
```

## 纹理滤波

| 滤波方式 | 效果 | 适用场景 |
|----------|------|----------|
| NearestFilter | 最近邻（像素风格） | 像素游戏、复古风格 |
| LinearFilter | 线性插值（平滑） | 照片级纹理 |
| Mipmap | 多级渐远纹理 | 性能优化 |

```typescript
texture.magFilter = THREE.NearestFilter  // 放大
texture.minFilter = THREE.LinearFilter   // 缩小
```

## API 速查

| API | 用途 |
|-----|------|
| `new THREE.TextureLoader()` | 纹理加载器 |
| `textureLoader.load(url, onLoad)` | 加载纹理 |
| `new THREE.CanvasTexture(canvas)` | Canvas 纹理 |
| `new THREE.CubeTextureLoader()` | 立方体纹理加载器 |
| `new RGBELoader()` | HDRI 纹理加载器 |
| `texture.repeat.set(x, y)` | 设置重复次数 |
| `texture.offset.set(x, y)` | 设置偏移量 |
| `texture.rotation = angle` | 设置旋转角度 |
| `texture.wrapS = THREE.RepeatWrapping` | 水平环绕模式 |
| `texture.wrapT = THREE.RepeatWrapping` | 垂直环绕模式 |
| `texture.magFilter = THREE.NearestFilter` | 放大滤波 |
| `texture.minFilter = THREE.LinearFilter` | 缩小滤波 |
| `material.map = texture` | 应用纹理到材质 |
| `material.envMap = envMap` | 应用环境贴图 |
| `material.bumpMap = texture` | 应用凹凸贴图 |
| `material.roughnessMap = texture` | 应用粗糙度贴图 |
| `material.needsUpdate = true` | 通知材质更新 |
| `scene.background = envMap` | 设置场景背景 |
| `scene.environment = envMap` | 设置环境光照 |

## 源码位置

- 课程代码：`src/lessons/06-textures/main.ts`
- 技术文档：`docs/06-textures.md`
- 纹理资源：`public/textures/`

---

## 课后作业：奢侈品手表展示

**参考案例**：[watch.marplacode.com](https://watch.marplacode.com/) (Awwwards Honorable Mention)

**目标**：加载手表模型，展示纹理、材质、环境贴图的实际应用，实现旋转+浮动的居中展示效果

**考察因素（100分）**：

| 项目 | 分值 | 说明 |
|------|------|------|
| 环境贴图反射 | 25分 | CubeTextureLoader 加载天空盒 + scene.environment |
| 材质参数调整 | 25分 | 金属质感增强（metalness/roughness） |
| 光影氛围 | 20分 | 三点照明（主光/补光/背光/环境光） |
| 交互体验 | 15分 | 控制面板调节旋转速度/浮动幅度/自动旋转 |
| 视觉完成度 | 15分 | 镜面地面 + 整体构图 |

**代码位置**：`src/homework/06-textures/main.ts`

**已有物料**：
- 模型：`/models/watch/diegoWatchAnimation4.gltf`（模型非常小，需根据包围盒自动缩放）
- 天空盒：`/textures/skybox/` 下 6 张图片
- 手表纹理：`/textures/watch/` 下的 ao 和 nor 贴图

### 运行方式

1. 修改 `src/main.ts` 入口指向作业代码：
   ```typescript
   // MODE = 'homework'
   import './homework/06-textures/main'
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
| **环境贴图** | CubeTextureLoader 加载天空盒 | CubeTextureLoader、scene.environment |
| **镜面地面** | roughness=0.05, metalness=0.98 | 金属度与粗糙度对反射的影响 |
| **手表模型** | GLTFLoader + 自动缩放 | PBR 材质参数控制 |
| **控制面板** | 旋转/浮动/自动旋转 | 交互式参数调节 |
| **浮动动画** | sin 函数 + 帧率无关 | 动画循环 |

### 评分标准

| 分数段 | 标准 |
|--------|------|
| 90-100 | 所有功能完整，动画流畅，代码结构清晰 |
| 80-89 | 核心功能完整，少量瑕疵 |
| 70-79 | 基本功能实现，缺少部分交互 |
| 60-69 | 功能不完整，但有基础实现 |
| <60 | 未完成或代码无法运行 |
