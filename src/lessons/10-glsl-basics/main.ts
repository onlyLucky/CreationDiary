/**
 * 第 10 课：GLSL 基础
 *
 * 学习目标：
 * 1. 理解 Vertex Shader / Fragment Shader 的结构和执行流程
 * 2. 掌握 gl_Position / gl_FragColor 的作用
 * 3. 区分 uniform / varying / attribute 三种变量类型
 * 4. 理解 ShaderMaterial vs RawShaderMaterial 的区别
 * 5. 掌握坐标系变换（模型→世界→观察→裁剪）
 *
 * 参考案例：
 * - Three.js webgl_shader（自定义顶点变形 + 片元着色）
 * - Three.js webgl_shader2（Uniform 传参 + varying 插值）
 * - The Book of Shaders（https://thebookofshaders.com）
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 观察三个 ShaderMaterial 物体的动态效果
 * - 使用控制面板切换效果和调整参数
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ========== 1. GLSL 着色器代码 ========== */

/**
 * 渐变球体 — 最基础的 ShaderMaterial 示例
 *
 * Vertex Shader（顶点着色器）：
 * - 每个顶点执行一次
 * - 职责：计算顶点在屏幕上的最终位置
 * - gl_Position：内置变量，必须赋值，表示裁剪空间坐标
 *
 * 三种变量类型：
 * - attribute：每个顶点不同的数据（位置、法线、UV），由 Three.js 自动传入
 * - uniform：所有顶点共享的数据（时间、颜色、矩阵），由 JS 手动传入
 * - varying：从顶点着色器传到片元着色器的变量（经过插值）
 */
const gradientVertexShader = /* glsl */ `
  /**
   * varying — 从顶点着色器传递到片元着色器的变量
   * Three.js 会自动在三角形的三个顶点之间做线性插值
   * 所以片元着色器拿到的是「插值后」的值，不是某个顶点的原始值
   */
  varying vec2 vUv;

  void main() {
    /**
     * uv — Three.js 内置 attribute，每个顶点的 UV 坐标（0~1）
     * 传递给片元着色器，用于在片元阶段做渐变计算
     */
    vUv = uv;

    /**
     * gl_Position — 内置变量，顶点着色器必须赋值
     * 表示顶点在裁剪空间（Clip Space）中的位置
     *
     * 坐标变换链：模型空间 → 世界空间 → 观察空间 → 裁剪空间
     * - modelMatrix：模型→世界（物体的位置/旋转/缩放）
     * - viewMatrix：世界→观察（相机的位置/朝向）
     * - projectionMatrix：观察→裁剪（透视/正交投影）
     * - modelViewMatrix = viewMatrix × modelMatrix（Three.js 预计算的快捷变量）
     *
     * 这行等价于 projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0)
     */
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * 渐变片元着色器 — 基于 UV 坐标和时间生成动态渐变
 *
 * Fragment Shader（片元着色器）：
 * - 每个像素执行一次
 * - 职责：计算这个像素最终显示什么颜色
 * - gl_FragColor：内置变量，必须赋值，表示像素的 RGBA 颜色
 */
const gradientFragmentShader = /* glsl */ `
  /**
   * uniform — 所有像素共享的变量，由 JavaScript 传入
   * uniform 的值在整个 draw call 期间不变
   * Three.js 会自动处理矩阵类型的 uniform（如 viewMatrix）
   * 自定义 uniform 需要通过 ShaderMaterial.uniforms 手动传入
   */
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  /**
   * varying — 接收从顶点着色器传来的插值后的 UV 坐标
   * 同一个三角形内，不同像素的 vUv 值是不同的（线性插值结果）
   */
  varying vec2 vUv;

  void main() {
    /**
     * sin() 生成周期性波动，配合 uTime 让颜色随时间流动
     * vUv.y 控制渐变方向（从底部到顶部）
     * * 0.5 + 0.5 把 sin 的 [-1,1] 范围映射到 [0,1]
     */
    float wave = sin(vUv.y * 6.2831 + uTime) * 0.5 + 0.5;

    /**
     * mix() — 线性插值函数
     * mix(a, b, t) = a * (1-t) + b * t
     * t=0 时返回 a，t=1 时返回 b，t=0.5 时返回中间值
     * 这里用 wave 在两种颜色之间平滑过渡
     */
    vec3 color = mix(uColorA, uColorB, wave);

    /**
     * gl_FragColor — 内置变量，片元着色器必须赋值
     * vec4(r, g, b, a) — RGBA 颜色，分量范围 [0, 1]
     * a=1.0 表示完全不透明
     */
    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 2. 顶点变形 Shader（高级） ========== */

/**
 * 波浪变形 — 在顶点着色器中修改顶点位置
 *
 * 这个 shader 演示了：
 * - 在 Vertex Shader 中修改 position（顶点动画）
 * - 用 varying 把变形后的法线传给片元着色器
 * - 简单的光照计算（漫反射）
 */
const waveVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uFrequency;

  varying vec3 vNormal;
  varying float vDisplacement;

  void main() {
    /**
     * 顶点变形：沿着法线方向偏移顶点位置
     * sin(x * freq + time) 生成沿 X 方向传播的波浪
     * position.y 控制波浪的「相位」，让不同高度的顶点偏移不同
     */
    float displacement = sin(position.x * uFrequency + uTime) * uAmplitude;

    /**
     * 沿法线方向偏移顶点
     * position + normal * displacement
     * 这是 shader 中最常见的顶点动画模式
     */
    vec3 newPosition = position + normal * displacement;

    /**
     * 传递给片元着色器：
     * - vNormal：法线方向（用于光照计算）
     * - vDisplacement：变形量（用于颜色映射）
     */
    vNormal = normalMatrix * normal;
    vDisplacement = displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

const waveFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLightDir;

  varying vec3 vNormal;
  varying float vDisplacement;

  void main() {
    /**
     * 简单的漫反射光照（Lambert）
     * dot(normal, lightDir) 计算光线与表面法线的夹角
     * 夹角越小（越正面朝光），值越大，表面越亮
     * max() 确保不会出现负值（背面不发光）
     */
    vec3 norm = normalize(vNormal);
    float diffuse = max(dot(norm, normalize(uLightDir)), 0.0);

    /**
     * 根据变形量改变颜色
     * 高处（vDisplacement > 0）偏亮，低处偏暗
     * 这样波浪的起伏有了视觉反馈
     */
    float colorShift = vDisplacement * 2.0 + 0.5;
    vec3 finalColor = uColor * (0.3 + 0.7 * diffuse) * colorShift;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

/* ========== 3. Fresnel 效果 Shader ========== */

/**
 * Fresnel 效果 — 边缘发光
 *
 * Fresnel 效应：物体边缘比中心更亮（或更透明）
 * 真实世界中，玻璃球的边缘比中心更反射，这就是 Fresnel
 *
 * 实现原理：
 * - 用 dot(viewDirection, normal) 计算视线与法线的夹角
 * - 正面（夹角≈0°）→ 中心区域 → 低反射
 * - 边缘（夹角≈90°）→ 边缘区域 → 高反射
 * - 用 pow() 控制衰减曲线
 */
const fresnelVertexShader = /* glsl */ `
  /**
   * varying 传递世界空间的法线和位置
   * 片元着色器需要这些来计算 Fresnel
   */
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    /**
     * (modelMatrix * vec4(normal, 0.0)).xyz — 把法线从模型空间变换到世界空间
     * 注意 w=0.0：法线是方向向量，不受平移影响
     *
     * 为什么不用 normalMatrix？
     * normalMatrix = transpose(inverse(modelViewMatrix))，变换到观察空间
     * 这里我们需要世界空间的法线，所以用 modelMatrix
     */
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fresnelFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCameraPosition;
  uniform float uFresnelPower;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    /**
     * Fresnel 计算：
     * 1. viewDir = 相机位置 - 片元位置（从片元指向相机的方向）
     * 2. dot(normalize(viewDir), normalize(normal)) = 视线与法线的夹角余弦
     * 3. 1.0 - dot(...) 反转：边缘=1，中心=0
     * 4. pow(..., power) 控制衰减曲线，power 越大，边缘越窄
     */
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    vec3 normal = normalize(vWorldNormal);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);

    /**
     * 基础色 + Fresnel 边缘发光
     * 中心区域显示 uColor，边缘叠加白色高光
     */
    vec3 finalColor = uColor + vec3(1.0) * fresnel;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

/* ========== 4. 创建 ShaderMaterial 物体 ========== */

/**
 * 创建渐变球体
 *
 * ShaderMaterial vs RawShaderMaterial：
 * - ShaderMaterial：Three.js 自动注入内置 uniform（如 projectionMatrix、modelMatrix）
 * - RawShaderMaterial：不注入任何内置变量，需要自己声明所有 uniform
 * - ShaderMaterial 更方便（不用手动声明内置矩阵），RawShaderMaterial 更灵活（完全自定义）
 */
function createGradientSphere(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.5, 64, 64)

  /**
   * ShaderMaterial 的 uniforms 选项：
   * 每个 uniform 需要指定 type 和 value
   * Three.js 根据 type 决定用哪个 GL 函数上传（如 glUniform1f、glUniform3fv）
   */
  const material = new THREE.ShaderMaterial({
    vertexShader: gradientVertexShader,
    fragmentShader: gradientFragmentShader,
    uniforms: {
      /** uTime：动画时间，每帧由 JS 更新 */
      uTime: { value: 0 },
      /** uColorA / uColorB：渐变的两种颜色 */
      uColorA: { value: new THREE.Color('#ff6b6b') },
      uColorB: { value: new THREE.Color('#4ecdc4') },
    },
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.x = -4
  return mesh
}

/**
 * 创建波浪变形平面
 */
function createWavePlane(): THREE.Mesh {
  /**
   * PlaneGeometry 的分段数：widthSegments=128, heightSegments=128
   * 分段数越多，波浪越平滑（顶点越多，变形越细腻）
   * 但顶点数 = (128+1) * (128+1) = 16641，性能可接受
   */
  const geometry = new THREE.PlaneGeometry(6, 6, 128, 128)

  const material = new THREE.ShaderMaterial({
    vertexShader: waveVertexShader,
    fragmentShader: waveFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAmplitude: { value: 0.3 },
      uFrequency: { value: 2.0 },
      uColor: { value: new THREE.Color('#6c5ce7') },
      uLightDir: { value: new THREE.Vector3(1, 1, 1) },
    },
    /**
     * side: THREE.DoubleSide — 双面渲染
     * 平面只有正面可见，变形后背面可能露出来
     * DoubleSide 让正反面都渲染，避免「穿帮」
     */
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  /**
   * 让平面朝向相机（绕 X 轴旋转 -90° 变成「地面」）
   * 然后稍微往前抬一点，让波浪效果更明显
   */
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -1.5
  return mesh
}

/**
 * 创建 Fresnel 效果球体
 */
function createFresnelSphere(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.5, 64, 64)

  const material = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color('#2d3436') },
      uCameraPosition: { value: new THREE.Vector3() },
      uFresnelPower: { value: 2.0 },
    },
    /**
     * transparent: true — 启用透明度混合
     * 虽然当前 gl_FragColor.a = 1.0，但后续可以改为透明 Fresnel
     */
    transparent: true,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.x = 4
  return mesh
}

/* ========== 5. 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景图结构：
 * scene (根节点)
 * ├── ambientLight          (环境光)
 * ├── directionalLight      (方向光)
 * ├── gradientSphere        (渐变球体，左侧)
 * │   └── ShaderMaterial    (UV 渐变 + 时间驱动)
 * ├── wavePlane             (波浪平面，底部)
 * │   └── ShaderMaterial    (顶点变形 + 漫反射光照)
 * └── fresnelSphere         (Fresnel 球体，右侧)
 *     └── ShaderMaterial    (Fresnel 边缘发光)
 *
 * 三种 ShaderMaterial 分别演示：
 * 1. 渐变球体：uniform 传时间、varying 传 UV、mix() 混合颜色
 * 2. 波浪平面：顶点着色器修改 position、法线变换、漫反射光照
 * 3. Fresnel 球体：世界空间法线、视线方向计算、边缘发光
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a0a',
    fov: 50,
  })

  manager.camera.position.set(0, 2, 10)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  /* ========== 灯光（Fresnel 和波浪用到光照计算） ========== */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
  manager.scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(5, 5, 5)
  manager.scene.add(directionalLight)

  /* ========== 创建三个 ShaderMaterial 物体 ========== */
  const gradientSphere = createGradientSphere()
  const wavePlane = createWavePlane()
  const fresnelSphere = createFresnelSphere()

  manager.scene.add(gradientSphere)
  manager.scene.add(wavePlane)
  manager.scene.add(fresnelSphere)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel()

  // 渐变颜色 A
  panel.addSelect({
    id: 'color-a',
    label: '渐变颜色 A',
    type: 'select',
    options: [
      { value: '#ff6b6b', label: '珊瑚红' },
      { value: '#fdcb6e', label: '暖黄' },
      { value: '#a29bfe', label: '薰衣草紫' },
      { value: '#55efc4', label: '薄荷绿' },
    ],
    defaultValue: '#ff6b6b',
    onChange: (value) => {
      (gradientSphere.material as THREE.ShaderMaterial).uniforms.uColorA.value.set(value)
    },
  })

  // 渐变颜色 B
  panel.addSelect({
    id: 'color-b',
    label: '渐变颜色 B',
    type: 'select',
    options: [
      { value: '#4ecdc4', label: '青绿' },
      { value: '#74b9ff', label: '天蓝' },
      { value: '#fd79a8', label: '粉红' },
      { value: '#ffeaa7', label: '淡黄' },
    ],
    defaultValue: '#4ecdc4',
    onChange: (value) => {
      (gradientSphere.material as THREE.ShaderMaterial).uniforms.uColorB.value.set(value)
    },
  })

  // 波浪振幅
  panel.addSlider({
    id: 'wave-amplitude',
    label: '波浪振幅',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0.3,
    onChange: (value) => {
      (wavePlane.material as THREE.ShaderMaterial).uniforms.uAmplitude.value = value
    },
  })

  // 波浪频率
  panel.addSlider({
    id: 'wave-frequency',
    label: '波浪频率',
    type: 'slider',
    min: 0.5,
    max: 8,
    step: 0.1,
    defaultValue: 2.0,
    onChange: (value) => {
      (wavePlane.material as THREE.ShaderMaterial).uniforms.uFrequency.value = value
    },
  })

  // Fresnel 强度
  panel.addSlider({
    id: 'fresnel-power',
    label: 'Fresnel 强度',
    type: 'slider',
    min: 0.5,
    max: 5,
    step: 0.1,
    defaultValue: 2.0,
    onChange: (value) => {
      (fresnelSphere.material as THREE.ShaderMaterial).uniforms.uFresnelPower.value = value
    },
  })

  // 波浪颜色
  panel.addSelect({
    id: 'wave-color',
    label: '波浪颜色',
    type: 'select',
    options: [
      { value: '#6c5ce7', label: '紫色' },
      { value: '#00cec9', label: '青色' },
      { value: '#e17055', label: '橙色' },
      { value: '#00b894', label: '绿色' },
    ],
    defaultValue: '#6c5ce7',
    onChange: (value) => {
      (wavePlane.material as THREE.ShaderMaterial).uniforms.uColor.value.set(value)
    },
  })

  /* ========== 动画循环 ========== */
  manager.onUpdate((delta, elapsed) => {
    controls.update()

    /**
     * 更新所有 shader 的 uTime uniform
     * elapsed 是从页面加载到现在经过的总秒数
     * 用 elapsed 而不是 delta，因为 shader 需要连续递增的时间
     */
    const gradientMat = gradientSphere.material as THREE.ShaderMaterial
    gradientMat.uniforms.uTime.value = elapsed

    const waveMat = wavePlane.material as THREE.ShaderMaterial
    waveMat.uniforms.uTime.value = elapsed

    /**
     * 更新 Fresnel shader 的相机位置
     * 相机位置每帧可能变化（OrbitControls），所以需要每帧更新
     */
    const fresnelMat = fresnelSphere.material as THREE.ShaderMaterial
    fresnelMat.uniforms.uCameraPosition.value.copy(manager.camera.position)

    /**
     * 渐变球体缓慢旋转，增加视觉动感
     * 这里用 JS 控制旋转，而不是在 shader 里做
     * 因为旋转是物体级别的变换，属于 modelMatrix 的职责
     */
    gradientSphere.rotation.y += delta * 0.5
    fresnelSphere.rotation.y += delta * 0.3
  })

  manager.start()

  /* ========== 控制台输出 ========== */
  console.log('=== 第 10 课：GLSL 基础 ===')
  console.log('')
  console.log('核心概念：')
  console.log('  - Vertex Shader：每个顶点执行一次，计算 gl_Position')
  console.log('  - Fragment Shader：每个像素执行一次，计算 gl_FragColor')
  console.log('  - uniform：所有顶点/像素共享的变量（时间、颜色、矩阵）')
  console.log('  - varying：从顶点着色器插值传到片元着色器的变量')
  console.log('  - attribute：每个顶点不同的数据（position、normal、uv）')
  console.log('')
  console.log('三个 ShaderMaterial 示例：')
  console.log('  1. 渐变球体：UV + 时间 → mix() 颜色混合')
  console.log('  2. 波浪平面：顶点变形 + 漫反射光照')
  console.log('  3. Fresnel 球体：边缘发光效果')
  console.log('')
  console.log('交互控制：')
  console.log('  - 切换渐变颜色 A / B')
  console.log('  - 调整波浪振幅 / 频率')
  console.log('  - 调整 Fresnel 强度')
  console.log('  - 鼠标拖拽旋转视角')
  console.log('')
  console.log('观察要点：')
  console.log('  - 渐变球体：颜色从底部到顶部平滑过渡，随时间流动')
  console.log('  - 波浪平面：顶点沿法线方向偏移，形成波浪起伏')
  console.log('  - Fresnel 球体：边缘亮、中心暗，像玻璃球的反光')
}

init()
