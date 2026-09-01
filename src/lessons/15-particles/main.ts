/**
 * 第 15 课：粒子系统
 *
 * 学习目标：
 * 1. 掌握 BufferGeometry 粒子的创建方式
 * 2. 理解 PointsMaterial 的配置参数
 * 3. 学会用自定义 ShaderMaterial 控制粒子大小/颜色/生命周期
 * 4. 理解 GPU 粒子 vs CPU 粒子的性能差异
 *
 * 本节概览（一个 3D 场景，三种粒子效果并排）：
 * - 左：基础 PointsMaterial 星空粒子
 * - 中：自定义 Shader 粒子（大小/颜色随生命周期变化）
 * - 右：流线型粒子（沿噪声场流动）
 *
 * 核心思路：
 * - BufferGeometry 存储每个粒子的 position/color/size 属性
 * - gl_PointSize 在顶点着色器中控制粒子大小
 * - gl_PointCoord 在片元着色器中获取粒子内部 UV
 * - 生命周期：每个粒子有 birth time，shader 计算 age 驱动动画
 *
 * 参考案例：
 * - Three.js Examples — webgl_points_billboards
 * - Three.js Examples — webgl_points_sprites
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用控制面板调整粒子数量、大小、颜色
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ========== 1. 星空粒子（基础 PointsMaterial） ========== */

/**
 * 创建星空粒子 — 最简单的 PointsMaterial 用法
 *
 * 原理：
 * - BufferGeometry 只存一个 position 属性（count 个粒子的三维坐标）
 * - PointsMaterial 用固定大小（size）渲染所有点，颜色统一
 * - 位置在 [-10, 10] 立方体内随机分布
 *
 * @param count - 粒子数量
 */
function createStarField(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)

  /** 随机填充 20×20×20 立方体内的坐标 */
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  /** sizeAttenuation: true — 远处的粒子看起来更小（透视衰减） */
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05,
    sizeAttenuation: true,
  })

  return new THREE.Points(geometry, material)
}

/* ========== 2. 自定义 Shader 粒子 ========== */

/**
 * 自定义粒子 Shader
 *
 * 每个粒子有 birth time 属性，shader 计算 age：
 * - age = uTime - birthTime
 * - size 随 age 先增大后缩小
 * - color 随 age 从蓝变白变红
 * - alpha 随 age 淡出
 */
const particleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBirthTime;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uMaxLife;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float age = mod(uTime - aBirthTime, uMaxLife);
    float lifeRatio = age / uMaxLife;

    /** 大小随生命周期变化：sin 曲线，先大后小 */
    float size = aSize * sin(lifeRatio * 3.14159);

    /** 位置 */
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    /** 颜色和透明度 */
    vColor = aColor;
    vAlpha = 1.0 - lifeRatio;
  }
`

const particleFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    /** 圆形粒子：到中心距离 > 0.5 则丢弃 */
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;

    /** 柔和边缘 */
    float alpha = smoothstep(0.5, 0.3, d) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`

/**
 * 创建自定义 Shader 粒子
 *
 * 与星空粒子的区别：
 * - 每个粒子有独立的 aSize（大小）、aBirthTime（出生时间）、aColor（颜色）属性
 * - 顶点着色器用 gl_PointSize 控制大小、varying 传颜色/透明度
 * - 粒子按生命周期循环：出现 → 变大变亮 → 缩小淡出 → 重新出生
 *
 * @param count - 粒子数量
 */
function createShaderParticles(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const birthTimes = new Float32Array(count)
  const colors = new Float32Array(count * 3)

  /** 随机初始化每个粒子的位置 / 大小 / 出生时间 / 颜色（偏蓝调） */
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8
    positions[i * 3 + 1] = Math.random() * 4
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8
    sizes[i] = Math.random() * 20 + 5
    birthTimes[i] = Math.random() * 5
    colors[i * 3] = 0.2 + Math.random() * 0.3
    colors[i * 3 + 1] = 0.4 + Math.random() * 0.3
    colors[i * 3 + 2] = 0.8 + Math.random() * 0.2
  }

  /** 把自定义 attribute 写入几何体（aSize/aBirthTime/aColor 对应 shader 里的变量名） */
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aBirthTime', new THREE.BufferAttribute(birthTimes, 1))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))

  /**
   * 透明渲染配置：
   * - transparent + depthWrite: false：半透明粒子互不遮挡
   * - AdditiveBlending：加法混合，重叠区域更亮，适合发光粒子
   */
  const material = new THREE.ShaderMaterial({
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uMaxLife: { value: 5.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  return new THREE.Points(geometry, material)
}

/* ========== 3. 流动粒子（噪声场驱动） ========== */

const flowVertexShader = /* glsl */ `
  attribute float aSpeed;
  attribute float aOffset;

  uniform float uTime;
  uniform float uFlowSpeed;

  varying float vAlpha;

  /**
   * 简化版 2D 噪声（用于流动方向）
   */
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 pos = position;

    /**
     * 粒子沿噪声场流动
     * - 用 noise 采样当前位置的"风向"
     * - 加时间偏移让粒子持续移动
     * - pos.x/z 随噪声变化，pos.y 缓慢上升
     */
    float t = uTime * uFlowSpeed * aSpeed + aOffset;
    float n = noise(pos.xz * 0.5 + t * 0.1);
    pos.x += sin(n * 6.28) * 0.5;
    pos.z += cos(n * 6.28) * 0.5;
    pos.y = mod(pos.y + t * 0.3, 8.0) - 4.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 3.0 * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    /** 高度越高越透明 */
    vAlpha = smoothstep(-4.0, 4.0, pos.y) * 0.8;
  }
`

const flowFragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.2, d) * vAlpha;
    gl_FragColor = vec4(0.3, 0.7, 1.0, alpha);
  }
`

/**
 * 创建流动粒子 — 顶点着色器用噪声场驱动运动
 *
 * 原理：
 * - 每个粒子有 aSpeed（速度倍数）、aOffset（相位偏移）属性
 * - 顶点着色器里用 2D 噪声采样当前位置的「风向」，决定 x/z 偏移
 * - y 坐标随时间循环上升，越过顶部后回到底部（mod 循环）
 *
 * @param count - 粒子数量
 */
function createFlowParticles(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  const offsets = new Float32Array(count)

  /** 随机位置；speed 让粒子快慢不一，offset 打乱流动起始相位 */
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10
    speeds[i] = 0.5 + Math.random() * 1.5
    offsets[i] = Math.random() * 100
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: flowVertexShader,
    fragmentShader: flowFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: 1.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  return new THREE.Points(geometry, material)
}

/* ========== 4. 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景图结构：
 * scene (根节点)
 * ├── starField        (星空粒子，最左侧，x = -6)
 * │   └── PointsMaterial (固定大小白点，随机分布)
 * ├── shaderParticles  (自定义 Shader 粒子，中央)
 * │   └── ShaderMaterial (大小/颜色/透明度随生命周期变化)
 * └── flowParticles    (流动粒子，最右侧，x = 6)
 *     └── ShaderMaterial (噪声场驱动的流动效果)
 *
 * 三种粒子分别演示：
 * 1. PointsMaterial：最简单的粒子渲染
 * 2. ShaderMaterial：自定义 attribute + 生命周期动画
 * 3. 流动粒子：顶点着色器里做噪声场运动计算
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#050510', fov: 60 })

  manager.camera.position.set(0, 2, 12)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true

  /** 创建三种粒子（左右两个偏移到两侧，中央的 Shader 粒子保持原位） */
  const starField = createStarField(5000)
  starField.position.set(-6, 0, 0)
  manager.scene.add(starField)

  const shaderParticles = createShaderParticles(2000)
  manager.scene.add(shaderParticles)

  const flowParticles = createFlowParticles(3000)
  flowParticles.position.set(6, 0, 0)
  manager.scene.add(flowParticles)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  /** 流动粒子速度 / 自定义粒子生命周期（uMaxLife 越大，粒子存活越久） */
  panel.addSlider({ id: 'flow-speed', label: '流动速度', type: 'slider', min: 0, max: 3, step: 0.1, defaultValue: 1.0,
    onChange: (v: number) => { (flowParticles.material as THREE.ShaderMaterial).uniforms.uFlowSpeed.value = v } })
  panel.addSlider({ id: 'particle-life', label: '生命周期', type: 'slider', min: 1, max: 10, step: 0.5, defaultValue: 5.0,
    onChange: (v: number) => { (shaderParticles.material as THREE.ShaderMaterial).uniforms.uMaxLife.value = v } })

  let animationSpeed = 1.0
  panel.addSlider({ id: 'animation-speed', label: '动画速度', type: 'slider', min: 0, max: 3, step: 0.1, defaultValue: 1.0,
    onChange: (v: number) => { animationSpeed = v } })

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    const t = clock.getElapsedTime() * animationSpeed;

    /** 两个 Shader 粒子面板需要每帧更新 uTime（星空粒子是静态的） */
    (shaderParticles.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    (flowParticles.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    /** 星空粒子绕 Y 轴缓慢旋转，增加星空流动感 */
    starField.rotation.y = t * 0.02

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
