# 第 5 课技术笔记：相机与控制实现细节

> 日期：2026-07-16

---

## 相机类型对比

| 相机 | 特点 | 适用场景 | 参数 |
|------|------|----------|------|
| PerspectiveCamera | 近大远小，有透视效果 | 3D 游戏、第一人称视角 | fov, aspect, near, far |
| OrthographicCamera | 远近一样大，无透视效果 | 2D 游戏、CAD、UI 叠加 | left, right, top, bottom, near, far |

## 透视相机参数

**fov（Field of View）**：视野角度
- 30°：窄视野，望远镜效果
- 50°：正常视野，接近人眼
- 75°：广角视野
- 120°：超广角，鱼眼效果

**aspect**：宽高比
- 通常为 `window.innerWidth / window.innerHeight`
- 窗口变化时需要更新

**near / far**：裁切范围
- 物体距离 < near：不渲染
- 物体距离 > far：不渲染
- 范围太大会导致深度精度问题（z-fighting）

```typescript
const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100)
```

## 正交相机参数

**left / right / top / bottom**：视锥体边界
- 定义了相机能看到的范围
- 物体在这个范围内才可见

**near / far**：裁切范围（同透视相机）

```typescript
const frustumSize = 10
const aspect = window.innerWidth / window.innerHeight
const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2,  // left
  frustumSize * aspect / 2,   // right
  frustumSize / 2,            // top
  -frustumSize / 2,           // bottom
  0.1,                        // near
  100                         // far
)
```

## OrbitControls 配置

```typescript
const controls = new OrbitControls(camera, canvas)

// 阻尼效果（惯性）
controls.enableDamping = true
controls.dampingFactor = 0.05

// 目标点（相机看向的点）
controls.target.set(0, 0, 0)

// 限制旋转范围
controls.minPolarAngle = 0        // 最小极角（不能看到底部）
controls.maxPolarAngle = Math.PI / 2  // 最大极角（不能看到顶部）

// 限制缩放范围
controls.minDistance = 2           // 最小距离
controls.maxDistance = 20          // 最大距离

// 禁用平移
controls.enablePan = false

// 自动旋转
controls.autoRotate = true
controls.autoRotateSpeed = 1.0

// 更新（必须在动画循环中调用）
controls.update()
```

## 相机 Helper

```typescript
// 相机 Helper（可视化视锥体）
const cameraHelper = new THREE.CameraHelper(camera)
scene.add(cameraHelper)

// 更新 Helper（相机参数变化后调用）
cameraHelper.update()
```

## 窗口自适应

```typescript
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight
  
  // 更新透视相机
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  
  // 更新正交相机
  orthographicCamera.left = -frustumSize * aspect / 2
  orthographicCamera.right = frustumSize * aspect / 2
  orthographicCamera.top = frustumSize / 2
  orthographicCamera.bottom = -frustumSize / 2
  orthographicCamera.updateProjectionMatrix()
  
  cameraHelper.update()
})
```

## API 速查

| API | 用途 |
|-----|------|
| `new THREE.PerspectiveCamera(fov, aspect, near, far)` | 透视相机 |
| `new THREE.OrthographicCamera(left, right, top, bottom, near, far)` | 正交相机 |
| `camera.position.set(x, y, z)` | 设置相机位置 |
| `camera.lookAt(x, y, z)` | 设置相机看向的点 |
| `camera.updateProjectionMatrix()` | 更新投影矩阵（参数变化后调用） |
| `new THREE.OrbitControls(camera, canvas)` | 轨道控制器 |
| `controls.enableDamping = true` | 启用阻尼效果 |
| `controls.dampingFactor = 0.05` | 阻尼系数 |
| `controls.target.set(x, y, z)` | 设置控制器目标点 |
| `controls.update()` | 更新控制器（动画循环中调用） |
| `new THREE.CameraHelper(camera)` | 相机 Helper |
| `cameraHelper.update()` | 更新 Helper |

## 源码位置

- 课程代码：`src/lessons/05-cameras/main.ts`
- 技术文档：`docs/05-cameras.md`
- 课后作业代码：`src/homework/05-cameras-gsap-path/main.ts`
- 静态资源：复用 `public/models/suzanne.glb`

---

## 课后作业：GSAP 相机路径动画

### 作业目标

1. 学会用 GSAP 控制相机沿路径移动
2. 实现一个"过山车"相机漫游效果
3. 理解 timeline 和关键帧动画

### 作业要求

- [ ] 相机沿预设路径平滑移动（30 分）
- [ ] 相机始终看向目标点（20 分）
- [ ] 可以循环播放或手动触发（20 分）
- [ ] 速度可调节（15 分）
- [ ] 路径可视化（15 分）

**总分：100 分**

### 运行方式

```bash
# 修改 src/main.ts 的 import 指向作业代码
import './homework/05-cameras-gsap-path/main'
```

### 关键知识点

#### 1. CatmullRomCurve3 曲线

```typescript
const points = [
  new THREE.Vector3(0, 5, 15),
  new THREE.Vector3(-8, 3, 8),
  // ...
]
const curve = new THREE.CatmullRomCurve3(points, true) // true = 闭合曲线
```

#### 2. GSAP Timeline

```typescript
const timeline = gsap.timeline({
  repeat: -1,      // 无限循环
  yoyo: false,     // 不往返
  paused: true,    // 初始暂停
})

timeline.to(target, {
  progress: 1,
  duration: 10,
  ease: 'none',
  onUpdate: () => {
    // 更新相机位置
  },
})
```

#### 3. 曲线上的点

```typescript
// 根据进度获取路径上的位置（0-1）
const point = curve.getPointAt(progress)
camera.position.copy(point)
```

### 扩展挑战

完成基础作业后，可以尝试：

1. **改变路径形状**：修改 `cameraPathPoints` 数组
2. **改变动画时长**：修改 `duration` 参数
3. **改变缓动效果**：修改 `ease` 参数（如 `'power2.inOut'`）
4. **看向切线方向**：让相机看向路径的切线方向而不是固定点
5. **添加路径点动画**：用 GSAP 控制 `curve` 的参数

### 评分标准

| 项目 | 分值 | 说明 |
|------|------|------|
| 相机沿路径移动 | 30 | 平滑移动，无卡顿 |
| 相机看向目标 | 20 | 始终看向指定点 |
| 播放控制 | 20 | 播放/暂停/重置功能 |
| 速度调节 | 15 | 速度滑块正常工作 |
| 路径可视化 | 15 | 路径线显示/隐藏 |
| **总分** | **100** | |

### 参考资源

- [GSAP 官方文档](https://gsap.com/docs/v3/)
- [Three.js CatmullRomCurve3](https://threejs.org/docs/#api/en/extras/curves/CatmullRomCurve3)
- [Three.js Path Animation](https://threejs.org/examples/#webgl_geometry_extrude_splines)
