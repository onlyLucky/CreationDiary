# 第 4 课技术笔记：灯光与阴影实现细节

> 日期：待定

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

```typescript
const gltfLoader = new GLTFLoader()
gltfLoader.load(
  '/models/suzanne.glb',
  (gltf) => {
    const model = gltf.scene
    model.position.set(0, 3, 0)
    model.scale.set(0.8, 0.8, 0.8)

    // 遍历模型，设置阴影
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    scene.add(model)
  },
  undefined,
  (error) => {
    console.warn('加载模型失败:', error)
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
| `new GLTFLoader().load(url)` | 加载 GLTF/GLB 模型 |
