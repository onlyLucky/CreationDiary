/**
 * 第 15 课：粒子系统
 *
 * 学习目标：
 * 1. 掌握 BufferGeometry 粒子的创建方式
 * 2. 理解 PointsMaterial 的配置参数
 * 3. 学会用自定义 ShaderMaterial 控制粒子大小/颜色/生命周期
 * 4. 理解 GPU 粒子 vs CPU 粒子的性能差异——同一套运动规则两种执行路径，用 FPS 实测
 * 5. 学会用 uProgress 在两个目标位置之间插值（噪声流动 ↔ 聚合成球）
 *
 * 本节概览（一个 3D 场景，四组粒子并排）：
 * - 左一：基础 PointsMaterial 星空粒子
 * - 左二：自定义 Shader 粒子（大小/颜色随生命周期变化）
 * - 右二：流线型粒子（沿噪声场流动，可聚拢成球面）
 * - 最右：CPU/GPU 对照粒子（同一规则两种路径，粒子数最高 10 万，配 FPS 实测）
 *
 * 核心思路：
 * - BufferGeometry 存储每个粒子的 position/color/size 属性
 * - gl_PointSize 在顶点着色器中控制粒子大小
 * - gl_PointCoord 在片元着色器中获取粒子内部 UV
 * - 生命周期：每个粒子有 birth time，shader 计算 age 驱动动画
 * - CPU/GPU 对照：GPU 模式每帧只传一个 uTime；CPU 模式每帧把全部顶点
 *   从 JS 写进缓冲再上传显存（needsUpdate），粒子越多差距越大
 *
 * 参考案例：
 * - Three.js Examples — webgl_points_billboards
 * - Three.js Examples — webgl_points_sprites
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用控制面板调整粒子数量、大小、颜色
 * - 最右侧对照组：切换 CPU/GPU 模式、拖大粒子数到 10 万，观察 FPS 变化
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
  attribute vec3 aTargetPos;

  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uProgress;

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
    float flowY = mod(pos.y + t * 0.3, 8.0) - 4.0;

    /**
     * 聚合插值：uProgress = 0 时纯流动，1 时完全落在球面目标点上
     * 目标位置初始化时算好存进 aTargetPos（斐波那契球面均匀分布），
     * 运行时只插值不重算——两个形态共用一条顶点管线
     */
    vec3 finalPos = mix(vec3(pos.x, flowY, pos.z), aTargetPos, uProgress);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = 3.0 * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    /** 流动模式高度越高越透明；聚合后整体变亮聚成球 */
    float flowAlpha = smoothstep(-4.0, 4.0, flowY) * 0.8;
    vAlpha = mix(flowAlpha, 0.9, uProgress);
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
 * - 每个粒子有 aSpeed（速度倍数）、aOffset（相位偏移）、aTargetPos（聚合目标点）属性
 * - 顶点着色器里用 2D 噪声采样当前位置的「风向」，决定 x/z 偏移
 * - y 坐标随时间循环上升，越过顶部后回到底部（mod 循环）
 * - uProgress 在「噪声流动」与「球面聚合」之间插值：
 *   aTargetPos 用斐波那契球面分布（黄金角 2.399963 弧度递增），
 *   比随机采样均匀得多——聚合出的球没有疏密斑驳
 *
 * @param count - 粒子数量
 */
function createFlowParticles(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  const offsets = new Float32Array(count)
  const targets = new Float32Array(count * 3)

  /** 随机位置；speed 让粒子快慢不一，offset 打乱流动起始相位 */
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10
    speeds[i] = 0.5 + Math.random() * 1.5
    offsets[i] = Math.random() * 100

    /** 斐波那契球面均匀分布：y 从 1 匀速降到 -1，方位角按黄金角递增 */
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = i * 2.399963
    targets[i * 3] = Math.cos(theta) * r * 2.5
    targets[i * 3 + 1] = y * 2.5
    targets[i * 3 + 2] = Math.sin(theta) * r * 2.5
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))
  geometry.setAttribute('aTargetPos', new THREE.BufferAttribute(targets, 3))

  const material = new THREE.ShaderMaterial({
    vertexShader: flowVertexShader,
    fragmentShader: flowFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: 1.0 },
      uProgress: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  return new THREE.Points(geometry, material)
}

/* ========== 4. CPU/GPU 对照粒子 ========== */

/**
 * 对照粒子顶点着色器 — 一份代码同时服务两种执行路径
 *
 * 运动规则（两种模式完全一致）：每个粒子绕 Y 轴匀速转圈
 * - 位置公式：angle = aAngle + uTime * uSpeed
 *             x = cos(angle) * aRadius，z = sin(angle) * aRadius，y = aHeight
 *
 * uIsCpu 在两份「位置来源」之间插值：
 * - GPU 模式（uIsCpu = 0）：公式在 shader 里算，JS 每帧只上传一个 uTime（4 字节）。
 *   10 万个顶点着色器并行执行——GPU 天生擅长「同一条规则、海量数据」
 * - CPU 模式（uIsCpu = 1）：JS 每帧循环全部粒子算位置写进 position 数组，
 *   needsUpdate = true 触发整块缓冲从内存上传显存。
 *   10 万粒子 = 每帧 1.2 MB——粒子越多，CPU 路径的传输与循环开销越明显
 */
const compareVertexShader = /* glsl */ `
  attribute float aAngle;
  attribute float aRadius;
  attribute float aHeight;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uIsCpu;

  varying vec3 vColor;

  void main() {
    /** GPU 路径：位置由公式实时计算 */
    float angle = aAngle + uTime * uSpeed;
    vec3 gpuPos = vec3(cos(angle) * aRadius, aHeight, sin(angle) * aRadius);

    /** CPU 模式下 position 已由 JS 每帧写好，mix 直接选用（shader 端几乎零成本） */
    vec3 pos = mix(gpuPos, position, uIsCpu);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 2.5 * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    /** 按轨道半径渐变色：内圈暖、外圈冷，转起来像个彩色星盘 */
    vColor = mix(vec3(1.0, 0.6, 0.3), vec3(0.3, 0.6, 1.0), aRadius / 4.0);
  }
`

const compareFragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.2, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`

/** 对照组的固定角速度（两种模式共用，保证运动完全一致） */
const COMPARE_SPEED = 0.8

/**
 * 创建 CPU/GPU 对照粒子
 *
 * position 的初始值按 uTime = 0 的公式预填：
 * GPU 模式直接正确；切到 CPU 模式后由 JS 每帧覆盖
 *
 * @param count - 粒子数量（滑块可调，上限 10 万）
 */
function createCompareParticles(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const angles = new Float32Array(count)
  const radii = new Float32Array(count)
  const heights = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    angles[i] = Math.random() * Math.PI * 2
    /** 半径 0.5~4、高度 ±3 的扁平圆盘，绕圈时呈星盘状 */
    radii[i] = 0.5 + Math.random() * 3.5
    heights[i] = (Math.random() - 0.5) * 6

    positions[i * 3] = Math.cos(angles[i]) * radii[i]
    positions[i * 3 + 1] = heights[i]
    positions[i * 3 + 2] = Math.sin(angles[i]) * radii[i]
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1))
  geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: compareVertexShader,
    fragmentShader: compareFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: COMPARE_SPEED },
      uIsCpu: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  return new THREE.Points(geometry, material)
}

/* ========== 5. 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景图结构：
 * scene (根节点)
 * ├── starField        (星空粒子，左一，x = -6)
 * │   └── PointsMaterial (固定大小白点，随机分布)
 * ├── shaderParticles  (自定义 Shader 粒子，左二，x = 0)
 * │   └── ShaderMaterial (大小/颜色/透明度随生命周期变化)
 * ├── flowParticles    (流动粒子，右二，x = 6)
 * │   └── ShaderMaterial (噪声场驱动流动，uProgress 可聚拢成球)
 * └── compareParticles (CPU/GPU 对照粒子，最右，x = 12)
 *     └── ShaderMaterial (同一绕圈规则，uIsCpu 切换 JS/shader 两条更新路径)
 *
 * 四组粒子分别演示：
 * 1. PointsMaterial：最简单的粒子渲染
 * 2. ShaderMaterial：自定义 attribute + 生命周期动画
 * 3. 流动粒子：顶点着色器里做噪声场运动计算 + uProgress 形态插值
 * 4. 对照粒子：CPU/GPU 更新路径对比，拖到 10 万粒子看 FPS 实测差距
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#050510', fov: 60 })

  /** 四组粒子分布在 x = -6 ~ 12，相机中心对准 x = 3 */
  manager.camera.position.set(3, 2, 12)
  manager.camera.lookAt(3, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true

  /** 创建四组粒子（左右两个偏移到两侧，左二的 Shader 粒子保持原位） */
  const starField = createStarField(5000)
  starField.position.set(-6, 0, 0)
  manager.scene.add(starField)

  const shaderParticles = createShaderParticles(2000)
  manager.scene.add(shaderParticles)

  const flowParticles = createFlowParticles(3000)
  flowParticles.position.set(6, 0, 0)
  manager.scene.add(flowParticles)

  /**
   * CPU/GPU 对照粒子：初始 3 万，粒子数滑块可调（1000 ~ 100000）。
   * 改数量需要重建 geometry——用 let 保存当前实例与属性引用，
   * 重建前 dispose 旧的 geometry 和 material（否则泄漏，见第 20 课）
   */
  let compareCount = 30000
  let comparePoints = createCompareParticles(compareCount)
  comparePoints.position.set(12, 0, 0)
  manager.scene.add(comparePoints)

  /** JS 直通到 attribute 数组的引用（CPU 更新路径每帧写这里） */
  let comparePositions = comparePoints.geometry.attributes.position.array as Float32Array
  let compareAngles = comparePoints.geometry.attributes.aAngle.array as Float32Array
  let compareRadii = comparePoints.geometry.attributes.aRadius.array as Float32Array
  let compareHeights = comparePoints.geometry.attributes.aHeight.array as Float32Array

  /** 重建对照粒子：dispose 旧资源 → 新建 → 刷新属性引用 */
  function rebuildCompareParticles(count: number) {
    compareCount = count
    manager.scene.remove(comparePoints)
    comparePoints.geometry.dispose()
    ;(comparePoints.material as THREE.Material).dispose()

    comparePoints = createCompareParticles(count)
    comparePoints.position.set(12, 0, 0)
    manager.scene.add(comparePoints)

    comparePositions = comparePoints.geometry.attributes.position.array as Float32Array
    compareAngles = comparePoints.geometry.attributes.aAngle.array as Float32Array
    compareRadii = comparePoints.geometry.attributes.aRadius.array as Float32Array
    compareHeights = comparePoints.geometry.attributes.aHeight.array as Float32Array
  }

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  /** 流动粒子速度 / 自定义粒子生命周期（uMaxLife 越大，粒子存活越久） */
  panel.addSlider({ id: 'flow-speed', label: '流动速度', type: 'slider', min: 0, max: 3, step: 0.1, defaultValue: 1.0,
    onChange: (v: number) => { (flowParticles.material as THREE.ShaderMaterial).uniforms.uFlowSpeed.value = v } })
  panel.addSlider({ id: 'particle-life', label: '生命周期', type: 'slider', min: 1, max: 10, step: 0.5, defaultValue: 5.0,
    onChange: (v: number) => { (shaderParticles.material as THREE.ShaderMaterial).uniforms.uMaxLife.value = v } })
  /** 聚合插值：0 = 纯噪声流动，1 = 完全聚拢成斐波那契球面 */
  panel.addSlider({ id: 'gather-progress', label: '聚合成球', type: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0,
    onChange: (v: number) => { (flowParticles.material as THREE.ShaderMaterial).uniforms.uProgress.value = v } })

  let animationSpeed = 1.0
  panel.addSlider({ id: 'animation-speed', label: '动画速度', type: 'slider', min: 0, max: 3, step: 0.1, defaultValue: 1.0,
    onChange: (v: number) => { animationSpeed = v } })

  /* ---- CPU/GPU 对照组控件 ---- */

  /** 切换执行路径：两种模式的运动规则完全一致，只换「谁算位置」 */
  panel.addSelect({ id: 'compare-mode', label: '计算位置', type: 'select',
    options: [
      { value: 'gpu', label: 'GPU（着色器算）' },
      { value: 'cpu', label: 'CPU（JS 每帧上传）' },
    ],
    defaultValue: 'gpu',
    onChange: (v: string) => {
      ;(comparePoints.material as THREE.ShaderMaterial).uniforms.uIsCpu.value = v === 'cpu' ? 1 : 0
    } })

  /**
   * 粒子数量（重建 geometry）：实验点——拖到 10 万，切 CPU/GPU 对比 FPS。
   * CPU 模式下 JS 每帧循环 10 万次 + 整块缓冲上传显存；GPU 模式只传一个 uTime。
   * step 取 5000 避免拖动过程触发过于频繁的重建
   */
  panel.addSlider({ id: 'compare-count', label: '粒子数量', type: 'slider', min: 1000, max: 100000, step: 5000, defaultValue: 30000,
    onChange: (v: number) => { rebuildCompareParticles(Math.round(v)) } })

  /**
   * FPS 实测显示：控制面板没有文本显示控件，这里直接往 #controls 插一行只读信息。
   * 统计方式：requestAnimationFrame 真实帧间隔累加，每 0.5 秒刷新一次显示值
   */
  const fpsDisplay = document.createElement('div')
  fpsDisplay.className = 'control-item'
  fpsDisplay.textContent = 'FPS: --'
  document.getElementById('controls')?.appendChild(fpsDisplay)

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()
  /** 缩放后的累计时间（替代 getElapsedTime：FPS 统计需要真实帧间隔） */
  let elapsed = 0
  let frameCount = 0
  let fpsTimer = 0

  function animate() {
    requestAnimationFrame(animate)
    /** 真实帧间隔：FPS 统计用；动画时间在其上乘 animationSpeed */
    const rawDelta = clock.getDelta()
    elapsed += rawDelta * animationSpeed

    /** 三个 Shader 粒子组需要每帧更新 uTime（星空粒子是静态的） */
    ;(shaderParticles.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    (flowParticles.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    (comparePoints.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed

    /**
     * CPU 更新路径（仅 CPU 模式）：JS 每帧循环全部粒子重算位置，
     * 写完 position 后 needsUpdate = true——这一步把整块缓冲上传显存，
     * 是 CPU 模式与 GPU 模式的本质差别。GPU 模式下这段完全不执行
     */
    if ((comparePoints.material as THREE.ShaderMaterial).uniforms.uIsCpu.value === 1) {
      for (let i = 0; i < compareCount; i++) {
        const angle = compareAngles[i] + elapsed * COMPARE_SPEED
        comparePositions[i * 3] = Math.cos(angle) * compareRadii[i]
        comparePositions[i * 3 + 1] = compareHeights[i]
        comparePositions[i * 3 + 2] = Math.sin(angle) * compareRadii[i]
      }
      comparePoints.geometry.attributes.position.needsUpdate = true
    }

    /** 星空粒子绕 Y 轴缓慢旋转，增加星空流动感 */
    starField.rotation.y = elapsed * 0.02

    /** FPS 统计：0.5 秒窗口的平均帧率 */
    frameCount++
    fpsTimer += rawDelta
    if (fpsTimer >= 0.5) {
      fpsDisplay.textContent = `FPS: ${Math.round(frameCount / fpsTimer)}`
      frameCount = 0
      fpsTimer = 0
    }

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
