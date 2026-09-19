# 第 2 课技术笔记：几何体与图元实现细节

> 日期：2026-07-07

---

## 主题目标

- 掌握 5 种基础几何体的构造函数和参数
- 理解分段数与顶点数的关系
- 学会程序生成纹理（Canvas）
- 理解 Wireframe 的实现原理
- 了解 TextGeometry 生成 3D 文字（FontLoader 异步加载字体）

---

## 几何体的本质

Three.js 的几何体本质上是**顶点数据的集合**：

```
Geometry = {
  position: Float32Array  // 顶点坐标 (x, y, z)
  normal: Float32Array    // 法线方向 (nx, ny, nz)
  uv: Float32Array        // 纹理坐标 (u, v)
  index: Uint16Array      // 面的索引（哪些顶点组成一个面）
}
```

### 为什么用 BufferGeometry？

Three.js 早期有 `Geometry` 类（更易用），现在统一用 `BufferGeometry`（更高效）：
- `BufferGeometry` 直接存储 GPU 可用的数据格式
- `Geometry` 需要转换后才能传给 GPU
- `BufferGeometry` 性能更好，内存占用更少

---

## 分段数与顶点数的关系

### BoxGeometry

```
顶点数 = (widthSeg + 1) × (heightSeg + 1) × (depthSeg + 1) × 6面 / 某些共享
```

简化理解：每个面有 `(wSeg+1) × (hSeg+1)` 个顶点，6 个面。

### SphereGeometry

```
顶点数 ≈ (widthSeg + 1) × (heightSeg + 1)
```

- widthSegments = 32, heightSegments = 16 → 约 33 × 17 = 561 个顶点
- widthSegments = 8, heightSegments = 4 → 约 9 × 5 = 45 个顶点

**性能影响**：顶点数直接影响 GPU 的顶点着色器调用次数。

---

## Wireframe 的实现原理

```typescript
const material = new THREE.MeshBasicMaterial({ wireframe: true })
```

Wireframe 模式下：
- 只渲染面的**边**，不渲染面本身
- 用 `gl.LINE_STRIP` 替代 `gl.TRIANGLES`
- 不需要灯光（用 `MeshBasicMaterial`）
- 性能比正常渲染更好（不需要计算光照）

---

## 程序生成纹理

```typescript
function createCheckerTexture(size = 256, squares = 8): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const squareSize = size / squares
  for (let i = 0; i < squares; i++) {
    for (let j = 0; j < squares; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#333333'
      ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}
```

**用途**：
- 不需要下载外部纹理文件
- 用于 UV 可视化调试
- 棋盘格是经典的 UV 测试图案

---

## TextGeometry（3D 文字）

TextGeometry 不是 `THREE` 命名空间的内置几何体，要从 addons 引入，且依赖**异步加载**的字体文件：

```typescript
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'

const fontLoader = new FontLoader()
fontLoader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
  const textGeometry = new TextGeometry('Three.js', {
    font,               // 字体对象（来自 FontLoader 回调参数）
    size: 1,            // 字号（世界坐标单位）
    depth: 0.4,         // 挤出厚度（旧版叫 height，r163 起改名 depth）
    curveSegments: 8,   // 曲线分段数
    bevelEnabled: true, // 倒角：边缘斜切，立体感和高光更好
    bevelThickness: 0.04, // 倒角厚度（挤出方向）
    bevelSize: 0.02,      // 倒角宽度（轮廓向外扩多少）
    bevelSegments: 2,     // 倒角分段数
  })
  const mesh = new THREE.Mesh(textGeometry, new THREE.MeshStandardMaterial())
  scene.add(mesh)
})
```

### 要点

- **异步时序**：`fontLoader.load()` 是异步的。加载完成前场景照常渲染，在回调里再 `add` 文字；不要在同步初始化流程里阻塞等待字体。
- **原点在文字左下角**：`TextGeometry` 以文字起点为原点生成，居中要手动算宽度平移：

```typescript
textGeometry.computeBoundingBox()
const b = textGeometry.boundingBox!
textGeometry.translate(-(b.max.x - b.min.x) / 2, 0, 0)
```

- **depth 而不是 height**：r163 之前挤出厚度参数叫 `height`，r163 起改名 `depth`（和 BoxGeometry 的第三轴命名统一）。旧教程的 `height: 0.4` 在新版本会被静默忽略——文字变成没有厚度的平面薄片。
- **curveSegments 与性能**：曲线分段数控制笔画圆弧的圆滑度，类比球体的 segments——越大越圆滑，顶点数也随之上涨；`bevelSegments` 同理。笔画多的文字 + 高倒角分段时顶点数增长很快。

### 字体文件

- 字体是 typeface.json 格式（由 TTF 转换，可用 facetype.js 之类的在线工具从自己的字体生成，适合展示中文）
- 本项目放在 `public/fonts/helvetiker_regular.typeface.json`，运行时按 `/fonts/...` 路径加载
- **three r185 起 npm 包不再附带 `examples/fonts/`**（r184 及以前还有），字体文件需要自行下载放进 public 目录

---

## API 速查

| API | 用途 |
|-----|------|
| `new THREE.BoxGeometry(w, h, d, wSeg, hSeg, dSeg)` | 创建立方体 |
| `new THREE.SphereGeometry(r, wSeg, hSeg)` | 创建球体 |
| `new THREE.CylinderGeometry(rTop, rBot, h, seg)` | 创建圆柱体 |
| `new THREE.TorusGeometry(r, tube, rSeg, tSeg)` | 创建圆环 |
| `new THREE.PlaneGeometry(w, h, wSeg, hSeg)` | 创建平面 |
| `new THREE.Group()` | 创建分组 |
| `group.add(mesh)` | 把物体加入组 |
| `new THREE.MeshBasicMaterial({ wireframe: true })` | 线框材质 |
| `new THREE.CanvasTexture(canvas)` | 从 canvas 创建纹理 |
| `new FontLoader().load(url, onLoad)` | 异步加载 typeface.json 字体 |
| `new TextGeometry(text, { font, size, depth, curveSegments })` | 创建 3D 文字（r163+ 用 depth） |
| `geometry.computeBoundingBox()` | 计算包围盒（文字居中前先算宽度） |
