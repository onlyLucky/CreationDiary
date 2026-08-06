# 第 10 课技术笔记：GLSL 基础实现细节

> 日期：2026-08-05
> 状态：进行中
> 评分：待定

---

## 核心概念

### ShaderMaterial 创建流程

```typescript
import * as THREE from 'three'

const material = new THREE.ShaderMaterial({
  vertexShader: vertexShaderCode,     // GLSL 顶点着色器代码
  fragmentShader: fragmentShaderCode, // GLSL 片元着色器代码
  uniforms: {
    uTime: { value: 0 },              // 自定义 uniform
    uColor: { value: new THREE.Color('#ff0000') },
  },
  transparent: true,  // 可选：启用透明度混合
  side: THREE.DoubleSide,  // 可选：双面渲染
})
```

### Uniform 更新

```typescript
// 每帧更新 uniform（动画驱动）
material.uniforms.uTime.value = elapsedTime

// 更新颜色
material.uniforms.uColor.value.set('#00ff00')

// 更新向量
material.uniforms.uCameraPosition.value.copy(camera.position)
```

### 坐标系变换

Three.js ShaderMaterial 自动注入的内置 uniform：
- `projectionMatrix` — 观察→裁剪
- `modelViewMatrix` — 模型→观察（viewMatrix × modelMatrix）
- `modelMatrix` — 模型→世界
- `viewMatrix` — 世界→观察
- `normalMatrix` — 法线变换矩阵（modelMatrix 的逆转置）

### 法线变换

```glsl
// 世界空间法线（用于 Fresnel 等需要世界坐标的计算）
vec3 worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

// 观察空间法线（用于内置光照计算）
vec3 viewNormal = normalMatrix * normal;
```

## API 速查

| API | 用途 |
|-----|------|
| `new THREE.ShaderMaterial(opts)` | 创建自定义着色器材质 |
| `new THREE.RawShaderMaterial(opts)` | 创建裸着色器材质（不注入内置变量） |
| `material.uniforms.xxx.value` | 读写 uniform 值 |
| `new THREE.Color(hex)` | 创建颜色 uniform |
| `new THREE.Vector3(x,y,z)` | 创建向量 uniform |
| `mix(a, b, t)` | GLSL 线性插值 |
| `sin/cos` | GLSL 周期函数 |
| `dot(a, b)` | GLSL 点积 |
| `normalize(v)` | GLSL 向量归一化 |
| `pow(x, n)` | GLSL 幂运算 |
