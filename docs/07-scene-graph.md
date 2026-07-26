# 第 7 课技术笔记：场景图与变换实现细节

> 日期：2026-07-24
> 状态：已完成
> 评分：9.8/10

---

## 场景图树形结构

**核心概念**：Three.js 场景是一个树形结构，scene 是根节点

```
scene
├── Object3D (sun)
│   ├── Object3D (earth)
│   │   └── Object3D (moon)
│   └── AxesHelper
├── AmbientLight
└── DirectionalLight
```

## 父子关系与变换继承

**关键规则**：
- 子物体的位置是相对于父物体的
- 父物体旋转时，子物体跟着旋转
- 子物体的世界坐标 = 父物体的世界变换 × 子物体的局部变换

**代码示例**：
```typescript
// 地球距离太阳 5 个单位
earth.position.x = 5

// 月球距离地球 1.5 个单位（不是距离太阳 6.5）
moon.position.x = 1.5

// 构建父子关系
sun.add(earth)   // 地球是太阳的子物体
earth.add(moon)  // 月球是地球的子物体
```

## 旋转方向判断（右手定则）

**核心规则**：Three.js 使用右手坐标系，旋转方向用右手定则判断

**右手定则**：
- 拇指指向轴的正方向（如 +Y 轴向上）
- 四指弯曲的方向就是正旋转方向
- 正 rotation.y = 逆时针（从上往下看）

**代码示例**：
```typescript
// 地球绕太阳公转
sun.rotation.y += speed * delta  // 逆时针公转（从上往下看）

// 如果想要顺时针
sun.rotation.y -= speed * delta  // 负值 = 顺时针
```

**常见误区**：
- ❌ 以为 rotation.y 正值 = 顺时针
- ✅ rotation.y 正值 = 逆时针（从 +Y 方向看向 -Y）

## 局部坐标系 vs 世界坐标系

| 坐标系 | 说明 | 获取方式 |
|--------|------|----------|
| 局部坐标系 | 物体自身的坐标系 | `object.position` |
| 世界坐标系 | 场景的全局坐标系 | `object.getWorldPosition()` |

```typescript
// 获取物体的世界坐标
const worldPos = new THREE.Vector3()
object.getWorldPosition(worldPos)
```

## Object3D 分组管理

```typescript
const group = new THREE.Group()
group.add(mesh1)
group.add(mesh2)
scene.add(group)

// 整体移动、旋转、缩放
group.position.set(1, 2, 3)
group.rotation.y = Math.PI / 4
```

## scene.traverse() 遍历

```typescript
scene.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    child.castShadow = true
  }
})
```

## AxesHelper / GridHelper 调试

```typescript
const axesHelper = new THREE.AxesHelper(5) // 红=X 绿=Y 蓝=Z
const gridHelper = new THREE.GridHelper(20, 20) // 网格
```

## API 速查

| API | 用途 |
|-----|------|
| `object.add(child)` | 添加子物体 |
| `object.remove(child)` | 移除子物体 |
| `object.parent` | 获取父物体 |
| `object.children` | 获取子物体数组 |
| `object.getWorldPosition(target)` | 获取世界坐标 |
| `object.getWorldQuaternion(target)` | 获取世界旋转 |
| `object.traverse(callback)` | 遍历所有子物体 |
| `new THREE.Group()` | 创建空组 |
| `new THREE.AxesHelper(size)` | 坐标轴辅助线 |
| `new THREE.GridHelper(size, divisions)` | 网格辅助线 |

---

## 课后作业：积木小动物拼装展示

**参考案例**：[Der Baukasten](https://www.awwwards.com/sites/der-baukasten) (SOTD 7.22/10)

**目标**：用基本几何体拼装积木小动物，对比 OBJ 模型，展示父子关系和变换继承

**考察因素（100分）**：

| 项目 | 分值 | 说明 |
|------|------|------|
| 父子关系实现 | 30分 | 动物部件的正确父子结构 |
| 变换继承 | 25分 | 父部件带动子部件运动 |
| 散开/组合动画 | 20分 | 部件分散展示与组合复原 |
| 交互体验 | 15分 | 控制面板调节旋转/分散 |
| 视觉完成度 | 10分 | 材质、灯光、整体构图 |

**代码位置**：`src/homework/07-scene-graph/main.ts`

**已有物料**：
- OBJ 模型：`/models/baukasten/storky.obj`（左侧对照组）
- 基本几何体：BoxGeometry、ExtrudeGeometry（右侧拼装组）

### 运行方式

1. 修改 `src/main.ts` 入口指向作业代码：
   ```typescript
   // MODE = 'homework'
   import './homework/07-scene-graph/main'
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
| **动物拼装结构** | XYZ 轴方向理解 + 部件层级 | 局部坐标系、空间变换 |
| **变换继承** | 父部件旋转带动子部件 | 变换继承原理 |
| **散开/组合动画** | 模块分散到各个方向再复原 | Object3D 分组管理 |
| **控制面板** | 旋转/分散调节 | 交互式参数调节 |

### 评分标准

| 分数段 | 标准 |
|--------|------|
| 90-100 | 所有功能完整，动画流畅，代码结构清晰 |
| 80-89 | 核心功能完整，少量瑕疵 |
| 70-79 | 基本功能实现，缺少部分交互 |
| 60-69 | 功能不完整，但有基础实现 |
| <60 | 未完成或代码无法运行 |

---

## 源码位置

- 课程代码：`src/lessons/07-scene-graph/main.ts`
- 技术文档：`docs/07-scene-graph.md`
