# 第 7 课技术笔记：场景图与变换实现细节

> 日期：2026-07-24
> 状态：进行中

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

## 源码位置

- 课程代码：`src/lessons/07-scene-graph/main.ts`
- 技术文档：`docs/07-scene-graph.md`
