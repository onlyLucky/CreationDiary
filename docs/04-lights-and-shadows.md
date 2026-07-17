# 第 4 课技术笔记：灯光与阴影实现细节

> 日期：2026-07-16

---

## 灯光类型对比

| 灯光 | 作用 | 适用场景 | 性能 |
|------|------|----------|------|
| AmbientLight | 全局均匀照明，无方向 | 补充环境光，减少阴影 | 最快 |
| HemisphereLight | 半球照明（天空+地面） | 室外场景，自然过渡 | 快 |
| DirectionalLight | 平行光，模拟太阳 | 室外场景，平行阴影 | 中 |
| PointLight | 点光源，向四周发光 | 台灯、蜡烛、灯泡 | 中 |
| SpotLight | 聚光灯，锥形光束 | 手电筒、舞台灯 | 慢 |

## 阴影三要素

开启阴影需要三步设置：

```typescript
// 1. 光源：设置 castShadow = true
directionalLight.castShadow = true

// 2. 投射物：设置 castShadow = true
mesh.castShadow = true

// 3. 接收面：设置 receiveShadow = true
ground.receiveShadow = true

// 4. 渲染器：开启阴影
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
```

## 阴影质量与性能

**shadow.mapSize**：阴影贴图分辨率
- 512×512：低质量，性能最好
- 1024×1024：中等质量，推荐
- 2048×2048：高质量，性能较差
- 4096×4096：极高质量，性能最差

**shadow.camera**：阴影相机范围
- 范围太大 → 阴影模糊（像素被拉伸）
- 范围太小 → 阴影被裁切

## 灯光 Helper

Three.js 提供了灯光 Helper，用于可视化灯光范围和方向：

```typescript
// 方向光 Helper
const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 1)
scene.add(directionalHelper)

// 聚光灯 Helper
const spotHelper = new THREE.SpotLightHelper(spotLight)
scene.add(spotHelper)

// 点光源 Helper
const pointHelper = new THREE.PointLightHelper(pointLight, 0.5)
scene.add(pointHelper)
```

## 灯光切换功能

代码中添加了灯光切换功能，可以通过下拉菜单选择显示哪种灯光：

**HTML 结构**：
```html
<select id="light-select">
  <option value="all">全部显示</option>
  <option value="ambient">环境光 (Ambient)</option>
  <option value="hemisphere">半球光 (Hemisphere)</option>
  <option value="directional">方向光 (Directional)</option>
  <option value="point">点光源 (Point)</option>
  <option value="spot">聚光灯 (Spot)</option>
</select>
```

**TypeScript 实现**：
```typescript
// 灯光对象映射
const lights: Record<string, THREE.Light> = {
  ambient: ambientLight,
  hemisphere: hemisphereLight,
  directional: directionalLight,
  point: pointLight,
  spot: spotLight,
}

// 切换灯光显示
function switchLight(type: string) {
  // 先隐藏所有灯光
  Object.values(lights).forEach((light) => {
    light.visible = false
  })

  if (type === 'all') {
    // 显示所有灯光
    Object.values(lights).forEach((light) => {
      light.visible = true
    })
  } else {
    // 只显示选中的灯光
    if (lights[type]) {
      lights[type].visible = true
    }
  }
}

// 添加下拉菜单事件监听
const lightSelect = document.getElementById('light-select') as HTMLSelectElement
lightSelect.addEventListener('change', (e) => {
  const target = e.target as HTMLSelectElement
  switchLight(target.value)
})
```

## 外部资源加载

### TextureLoader 加载地面纹理

```typescript
const textureLoader = new THREE.TextureLoader()
textureLoader.load(
  '/textures/concrete-floor.jpg',
  (texture) => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4)

    const groundMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0,
    })
    // 使用材质...
  },
  undefined,
  (error) => {
    console.warn('加载纹理失败:', error)
  }
)
```

### GLTFLoader 加载模型

**模型说明**：Suzanne 是 Blender 的默认猴头模型，常用于 3D 场景测试。

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const gltfLoader = new GLTFLoader()
gltfLoader.load(
  '/models/suzanne.glb',  // 从 public/models/ 加载
  (gltf) => {
    const model = gltf.scene
    model.position.set(0, 3, 0)
    model.scale.set(0.8, 0.8, 0.8)

    // 遍历模型，设置阴影和材质
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Suzanne 模型没有材质，需要手动添加
        child.material = new THREE.MeshStandardMaterial({
          color: 0x8B4513,
          roughness: 0.6,
          metalness: 0.2,
        })
      }
    })

    scene.add(model)
  },
  (progress) => {
    console.log('加载进度:', (progress.loaded / progress.total * 100) + '%')
  },
  (error) => {
    console.error('加载失败:', error)
    // 降级：使用简单球体
    const fallbackGeo = new THREE.SphereGeometry(0.8, 32, 16)
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.6,
      metalness: 0.2,
    })
    const fallback = new THREE.Mesh(fallbackGeo, fallbackMat)
    fallback.position.set(0, 3, 0)
    fallback.castShadow = true
    fallback.receiveShadow = true
    scene.add(fallback)
  }
)
```

## API 速查

| API | 用途 |
|-----|------|
| `new THREE.AmbientLight(color, intensity)` | 环境光 |
| `new THREE.HemisphereLight(skyColor, groundColor, intensity)` | 半球光 |
| `new THREE.DirectionalLight(color, intensity)` | 方向光 |
| `new THREE.PointLight(color, intensity, distance)` | 点光源 |
| `new THREE.SpotLight(color, intensity, distance, angle)` | 聚光灯 |
| `light.castShadow = true` | 光源投射阴影 |
| `mesh.castShadow = true` | 物体投射阴影 |
| `mesh.receiveShadow = true` | 物体接收阴影 |
| `renderer.shadowMap.enabled = true` | 渲染器开启阴影 |
| `new THREE.DirectionalLightHelper(light, size)` | 方向光 Helper |
| `new THREE.SpotLightHelper(light)` | 聚光灯 Helper |
| `new THREE.PointLightHelper(light, size)` | 点光源 Helper |
| `new THREE.TextureLoader().load(url)` | 加载普通纹理 |
| `new THREE.GLTFLoader().load(url)` | 加载 GLTF/GLB 模型 |
| `new THREE.Group()` | 创建组合对象 |
