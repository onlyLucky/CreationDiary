/**
 * 第 13 课：高级 Shader 效果
 *
 * 学习目标：
 * 1. 掌握 Dissolve（消融）效果：噪声 + discard + 边缘发光
 * 2. 掌握 Hologram（全息）效果：Fresnel 效应 + 扫描线
 * 3. 理解 Fresnel 效应的物理原理和计算方法
 * 4. 学会 Distortion（扭曲）：顶点偏移 + 时间驱动
 *
 * 本节概览（四个并排的 ShaderMaterial 面板）：
 * 1. Dissolve 面板：噪声驱动的消融效果 + 边缘发光
 * 2. Hologram 面板：Fresnel 透明 + 扫描线 + 闪烁
 * 3. Fresnel 面板：可视化 Fresnel 效应的物理原理
 * 4. Distortion 面板：噪声驱动的顶点扭曲
 *
 * 核心思路：
 * - discard 关键字：在片元着色器中丢弃像素（不渲染）
 * - Fresnel 效应：观察角度越接近掠射角，反射越强
 * - 噪声作为遮罩：控制消融/扭曲的空间分布
 *
 * 参考案例：
 * - Three.js Examples — webgl_shader_lava
 * - Shadertoy — Dissolve Effect
 * - The Book of Shaders — Pattern 章节
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用控制面板切换效果和调整参数
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ========== 1. GLSL 噪声工具函数 ========== */

const noiseUtils = /* glsl */ `
  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 a = hash(i);
    vec2 b = hash(i + vec2(1.0, 0.0));
    vec2 c = hash(i + vec2(0.0, 1.0));
    vec2 d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(a, f), dot(b, f - vec2(1.0, 0.0)), u.x),
               mix(dot(c, f - vec2(0.0, 1.0)), dot(d, f - vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amplitude * perlinNoise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
`

/* ========== 2. Dissolve（消融）效果 ========== */

/**
 * 消融效果的原理：
 * 1. 用噪声生成一个遮罩（每个像素有一个噪声值）
 * 2. 用 uThreshold 控制"烧掉"的区域（噪声 < threshold 的像素被 discard）
 * 3. 在 threshold 附近的边缘添加发光效果（emissive glow）
 *
 * discard 关键字：片元着色器专用，直接丢弃当前像素不渲染
 */
const dissolveVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const dissolveFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uThreshold;
  uniform float uEdgeWidth;
  uniform vec3 uEdgeColor;
  uniform vec3 uBaseColor;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  ${noiseUtils}

  void main() {
    /** 用 FBM 生成噪声遮罩 */
    float noise = fbm(vUv * 5.0 + uTime * 0.05, 4) * 0.5 + 0.5;

    /**
     * discard：噪声值低于阈值的像素被丢弃
     * 这是消融效果的核心——低于阈值的部分"消失"
     */
    if (noise < uThreshold) discard;

    /**
     * 边缘发光效果
     * 在 threshold 附近的窄带内，混合边缘发光颜色
     * smoothstep 在 [threshold, threshold + edgeWidth] 之间插值
     */
    float edge = smoothstep(uThreshold, uThreshold + uEdgeWidth, noise);
    vec3 emissive = uEdgeColor * (1.0 - edge) * 2.0;

    /** 简单光照 */
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);

    vec3 color = uBaseColor * (0.2 + diffuse * 0.8) + emissive;
    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 3. Hologram（全息）效果 ========== */

/**
 * 全息效果的三大要素：
 * 1. Fresnel 边缘透明：正对观察者的地方半透明，边缘更亮
 * 2. 扫描线：水平条纹上下移动，模拟全息投影的扫描感
 * 3. 闪烁：随机噪点让画面偶尔"卡顿"
 */
const holoVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const holoFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFresnelPower;
  uniform float uScanSpeed;
  uniform float uScanDensity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  ${noiseUtils}

  void main() {
    /**
     * Fresnel 效应
     * - dot(normal, viewDir)：法线与视线方向的点积
     * - 正对时 dot ≈ 1，掠射时 dot ≈ 0
     * - 1.0 - dot = 边缘越亮
     * - pow(..., power) 控制衰减曲线
     */
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), uFresnelPower);

    /**
     * 扫描线
     * - sin(uv.y * density + time * speed)：水平条纹
     * - smoothstep 让线条更清晰
     */
    float scan = sin(vUv.y * uScanDensity - uTime * uScanSpeed) * 0.5 + 0.5;
    scan = smoothstep(0.3, 0.7, scan) * 0.3;

    /**
     * 闪烁噪点
     * - random 在每帧产生不同噪点
     * - 只在小概率出现（step(0.98, ...)）
     */
    float flicker = step(0.98, random(vec2(vUv.x * 100.0, uTime * 10.0))) * 0.15;

    /** 合成颜色：青色全息 + Fresnel 边缘 + 扫描线 + 闪烁 */
    vec3 holoColor = vec3(0.0, 0.9, 1.0);
    float alpha = fresnel * 0.6 + scan + flicker + 0.05;
    vec3 color = holoColor * (fresnel + scan + flicker);

    gl_FragColor = vec4(color, alpha);
  }
`

/* ========== 4. Fresnel 效应可视化 ========== */

/**
 * Fresnel 面板：可视化物理原理
 * 用一个球体展示不同角度的 Fresnel 反射强度
 */
const fresnelVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fresnelFragmentShader = /* glsl */ `
  uniform float uFresnelPower;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), uFresnelPower);
    vec3 color = mix(uColorA, uColorB, fresnel);
    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 5. Distortion（扭曲）效果 ========== */

/**
 * 扭曲效果：噪声驱动的顶点偏移
 * 与第 12 课的顶点变形类似，但更强调时间动态
 */
const distortVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uDistortScale;
  uniform float uDistortStrength;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  ${noiseUtils}

  void main() {
    vec3 pos = position;

    /** 用 FBM 噪声偏移顶点 */
    float n = fbm(pos.xy * uDistortScale + uTime * 0.2, 4);
    pos += normal * n * uDistortStrength;

    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const distortFragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    vec3 color = vec3(0.3, 0.6, 1.0) * (0.15 + diffuse * 0.85);
    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 6. 创建面板 ========== */

function createDissolvePanel(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.5, 64, 64)
  const material = new THREE.ShaderMaterial({
    vertexShader: dissolveVertexShader,
    fragmentShader: dissolveFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uThreshold: { value: 0.3 },
      uEdgeWidth: { value: 0.08 },
      uEdgeColor: { value: new THREE.Color(1.0, 0.3, 0.0) },
      uBaseColor: { value: new THREE.Color(0.8, 0.6, 0.4) },
    },
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-6, 0, 0)
  return mesh
}

function createHologramPanel(): THREE.Mesh {
  const geometry = new THREE.IcosahedronGeometry(1.5, 3)
  const material = new THREE.ShaderMaterial({
    vertexShader: holoVertexShader,
    fragmentShader: holoFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFresnelPower: { value: 2.0 },
      uScanSpeed: { value: 3.0 },
      uScanDensity: { value: 80.0 },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-2, 0, 0)
  return mesh
}

function createFresnelPanel(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.5, 64, 64)
  const material = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
      uFresnelPower: { value: 2.0 },
      uColorA: { value: new THREE.Color(0.1, 0.2, 0.8) },
      uColorB: { value: new THREE.Color(1.0, 0.8, 0.2) },
    },
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(2, 0, 0)
  return mesh
}

function createDistortPanel(): THREE.Mesh {
  const geometry = new THREE.IcosahedronGeometry(1.5, 64)
  const material = new THREE.ShaderMaterial({
    vertexShader: distortVertexShader,
    fragmentShader: distortFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uDistortScale: { value: 2.0 },
      uDistortStrength: { value: 0.3 },
    },
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(6, 0, 0)
  return mesh
}

/* ========== 7. 初始化场景 ========== */

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#0a0a0a', fov: 50 })

  manager.camera.position.set(0, 0, 14)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
  manager.scene.add(ambientLight)

  const dissolvePanel = createDissolvePanel()
  const holoPanel = createHologramPanel()
  const fresnelPanel = createFresnelPanel()
  const distortPanel = createDistortPanel()

  manager.scene.add(dissolvePanel)
  manager.scene.add(holoPanel)
  manager.scene.add(fresnelPanel)
  manager.scene.add(distortPanel)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  const updateSliderVisibility = (panelValue: string) => {
    const show = (el: HTMLElement | undefined, visible: boolean) => {
      if (el?.parentElement) el.parentElement.style.display = visible ? '' : 'none'
    }
    const isAll = panelValue === 'all'
    show(panel.getControl('dissolve-threshold'), isAll || panelValue === 'dissolve')
    show(panel.getControl('dissolve-edge'), isAll || panelValue === 'dissolve')
    show(panel.getControl('holo-fresnel'), isAll || panelValue === 'holo')
    show(panel.getControl('holo-scan'), isAll || panelValue === 'holo')
    show(panel.getControl('fresnel-power'), isAll || panelValue === 'fresnel')
    show(panel.getControl('distort-scale'), isAll || panelValue === 'distort')
    show(panel.getControl('distort-strength'), isAll || panelValue === 'distort')
  }

  panel.addSelect({
    id: 'panel-selector', label: '当前面板', type: 'select',
    options: [
      { value: 'all', label: '全部' },
      { value: 'dissolve', label: '消融' },
      { value: 'holo', label: '全息' },
      { value: 'fresnel', label: 'Fresnel' },
      { value: 'distort', label: '扭曲' },
    ],
    defaultValue: 'all',
    onChange: (value: string) => {
      dissolvePanel.visible = value === 'all' || value === 'dissolve'
      holoPanel.visible = value === 'all' || value === 'holo'
      fresnelPanel.visible = value === 'all' || value === 'fresnel'
      distortPanel.visible = value === 'all' || value === 'distort'
      updateSliderVisibility(value)
    },
  })

  /** Dissolve 参数 */
  panel.addSlider({ id: 'dissolve-threshold', label: '消融阈值', type: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0.3,
    onChange: (v: number) => { (dissolvePanel.material as THREE.ShaderMaterial).uniforms.uThreshold.value = v } })
  panel.addSlider({ id: 'dissolve-edge', label: '边缘宽度', type: 'slider', min: 0.01, max: 0.2, step: 0.005, defaultValue: 0.08,
    onChange: (v: number) => { (dissolvePanel.material as THREE.ShaderMaterial).uniforms.uEdgeWidth.value = v } })

  /** Hologram 参数 */
  panel.addSlider({ id: 'holo-fresnel', label: 'Fresnel 强度', type: 'slider', min: 0.5, max: 5, step: 0.1, defaultValue: 2.0,
    onChange: (v: number) => { (holoPanel.material as THREE.ShaderMaterial).uniforms.uFresnelPower.value = v } })
  panel.addSlider({ id: 'holo-scan', label: '扫描密度', type: 'slider', min: 20, max: 200, step: 5, defaultValue: 80,
    onChange: (v: number) => { (holoPanel.material as THREE.ShaderMaterial).uniforms.uScanDensity.value = v } })

  /** Fresnel 参数 */
  panel.addSlider({ id: 'fresnel-power', label: 'Fresnel 指数', type: 'slider', min: 0.5, max: 8, step: 0.1, defaultValue: 2.0,
    onChange: (v: number) => { (fresnelPanel.material as THREE.ShaderMaterial).uniforms.uFresnelPower.value = v } })

  /** Distortion 参数 */
  panel.addSlider({ id: 'distort-scale', label: '噪声频率', type: 'slider', min: 0.5, max: 8, step: 0.1, defaultValue: 2.0,
    onChange: (v: number) => { (distortPanel.material as THREE.ShaderMaterial).uniforms.uDistortScale.value = v } })
  panel.addSlider({ id: 'distort-strength', label: '扭曲强度', type: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0.3,
    onChange: (v: number) => { (distortPanel.material as THREE.ShaderMaterial).uniforms.uDistortStrength.value = v } })

  let animationSpeed = 1.0
  panel.addSlider({ id: 'animation-speed', label: '动画速度', type: 'slider', min: 0, max: 3, step: 0.1, defaultValue: 1.0,
    onChange: (v: number) => { animationSpeed = v } })

  updateSliderVisibility('all')

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    const t = clock.getElapsedTime() * animationSpeed;

    (dissolvePanel.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    (holoPanel.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    (distortPanel.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    holoPanel.rotation.y = t * 0.3
    distortPanel.rotation.y = t * 0.15

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
