# 第 3 课技术笔记：材质系统实现细节

> 日期：2026-07-07

---

## 材质继承关系

```
Material (基类)
├── MeshBasicMaterial      — 不受光照
├── MeshLambertMaterial    — Lambert 漫反射
├── MeshPhongMaterial      — Phong 高光
├── MeshStandardMaterial   — PBR 物理渲染
│   └── MeshPhysicalMaterial — PBR 扩展（清漆、透射）
├── MeshToonMaterial       — 卡通着色
├── MeshMatcapMaterial     — MatCap 球面贴图
├── MeshDepthMaterial      — 深度可视化
├── MeshNormalMaterial     — 法线可视化
└── ShaderMaterial         — 自定义着色器
```

## PBR 材质参数详解

### roughness（粗糙度）

| 值 | 效果 | 示例 |
|----|------|------|
| 0 | 完美镜面反射 | 镜子、铬 |
| 0.2 | 光滑 | 抛光金属、塑料 |
| 0.5 | 中等 | 磨砂金属 |
| 0.8 | 粗糙 | 木头、石头 |
| 1 | 完全粗糙（漫反射） | 粉笔、布料 |

### metalness（金属感）

| 值 | 效果 | 示例 |
|----|------|------|
| 0 | 非金属（电介质） | 塑料、木头、玻璃 |
| 0.5 | 半金属（不常见） | 氧化金属 |
| 1 | 纯金属 | 金、银、铜、铁 |

**重要**：metalness 只有 0 和 1 有意义，中间值只在特殊情况下使用。

## 环境贴图原理

环境贴图（Environment Map）是一个立方体贴图（CubeTexture），包含 6 张图片：

```
        +---+
        | +Y |  （顶部）
    +---+---+---+
    | -X | +Z | +X |  （侧面）
    +---+---+---+
        | -Y |  （底部）
        +---+
        | -Z |  （背面）
        +---+
```

物体根据表面法线方向，从环境贴图中采样颜色，实现反射效果。

## 法线贴图原理

法线贴图用 RGB 值编码表面法线方向：

| 通道 | 方向 | 值范围 |
|------|------|--------|
| R | X（左右） | 0~255 → -1~+1 |
| G | Y（上下） | 0~255 → -1~+1 |
| B | Z（前后） | 0~255 → -1~+1 |

- 平坦表面的法线贴图颜色：(128, 128, 255) → 蓝紫色（法线朝 +Z）
- 凹凸细节通过改变 RGB 值模拟

## API 速查

| API | 用途 |
|-----|------|
| `new THREE.MeshBasicMaterial({ color })` | 不受光照的材质 |
| `new THREE.MeshLambertMaterial({ color })` | Lambert 漫反射材质 |
| `new THREE.MeshPhongMaterial({ color, shininess })` | Phong 高光材质 |
| `new THREE.MeshStandardMaterial({ color, roughness, metalness })` | PBR 物理材质 |
| `new THREE.MeshPhysicalMaterial({ clearcoat, transmission })` | PBR 扩展材质 |
| `new THREE.MeshToonMaterial({ color })` | 卡通着色材质 |
| `new THREE.CubeTextureLoader().load([...])` | 加载立方体环境贴图 |
| `new THREE.TextureLoader().load(url)` | 加载普通纹理 |
| `material.envMap = texture` | 设置环境贴图 |
| `material.normalMap = texture` | 设置法线贴图 |
| `material.normalScale.set(x, y)` | 设置法线强度 |
