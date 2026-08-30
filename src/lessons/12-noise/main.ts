/**
 * 第 12 课：噪声函数
 *
 * 学习目标：
 * 1. 理解 Perlin Noise 和 Simplex Noise 的核心区别
 * 2. 掌握 FBM（分形布朗运动）的原理和应用
 * 3. 学会用噪声做有机效果（云雾、地形、火焰）
 * 4. 理解噪声在顶点着色器中的变形应用
 *
 * 本节概览（四个并排的 ShaderMaterial 面板，从左到右）：
 * 1. Perlin Noise 面板：2D 梯度噪声基础 + 动画
 * 2. FBM 面板：分形布朗运动，可调 octaves/lacunarity/persistence
 * 3. 云雾与火焰面板：FBM 驱动的有机效果
 * 4. 顶点变形面板：3D 球体 + 噪声顶点偏移
 *
 * 核心思路：
 * - 噪声 = 连续的伪随机函数（相邻点值接近，整体随机）
 * - Perlin Noise：网格梯度 + Hermite 插值 → 平滑连续
 * - FBM：叠加多频率噪声 → 自然界分形细节
 * - 顶点着色器用噪声偏移 position → 有机形变
 *
 * 参考案例：
 * - The Book of Shaders — Noise（https://thebookofshaders.com/11/）
 * - Inigo Quilez — Noise（https://iquilezles.org/articles/noiseonline/）
 * - Three.js Examples — webgl_shader_lava
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 观察四个 ShaderMaterial 面板的动态效果
 * - 使用控制面板切换效果和调整参数
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ========== 1. GLSL 噪声工具函数 ========== */

/**
 * 噪声工具函数块 — 包含 hash/random/perlin/fbm
 *
 * 所有面板的片元着色器都会引用这段代码，
 * 通过 #include 或直接拼接的方式注入。
 *
 * 核心函数：
 * - random(st)：伪随机数，基于 fract(sin(dot(...)))
 * - hash(p)：2D 哈希，返回 vec2 梯度向量
 * - perlinNoise(p)：2D Perlin 梯度噪声
 * - fbm(p, octaves)：分形布朗运动
 */
const noiseUtils = /* glsl */ `
  /**
   * 伪随机数生成器（Value Noise 基础）
   *
   * 原理：
   * 1. dot(st, vec2(12.9898, 78.233))：将 2D 坐标映射到 1D 标量
   * 2. sin(...)：正弦函数产生周期性波动
   * 3. * 43758.5453：放大让小数部分更"随机"
   * 4. fract(...)：只取小数部分，得到 [0, 1) 的伪随机数
   *
   * 缺点：不连续，相邻点差异大 → 看起来像雪花/杂讯
   */
  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  /**
   * 2D 哈希函数 — 返回 vec2 梯度向量
   *
   * Perlin Noise 需要每个格点有一个随机「方向」，
   * 这个函数把整数坐标映射到一个伪随机的 vec2。
   *
   * 技巧：用 sin + fract 组合，再用 dot 混合 x/y 分量
   * 让 x 和 y 的哈希互相独立（不同的 sin 频率）
   */
  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  /**
   * 2D Perlin 梯度噪声
   *
   * 算法步骤：
   * 1. floor(p) → 整数网格坐标 i（确定在哪个格子）
   * 2. fract(p) → 格子内的小数坐标 f（确定在格子内的位置）
   * 3. hash(i + offset) → 四个角的随机梯度向量
   * 4. dot(梯度, 距离向量) → 四个角对当前点的影响值
   * 5. Hermite 插值 f*f*(3-2*f) → 平滑混合四个影响值
   *
   * 返回值范围：约 [-0.7, 0.7]（2D Perlin 的理论最大值）
   */
  float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    /** 四个角的梯度向量 */
    vec2 a = hash(i);
    vec2 b = hash(i + vec2(1.0, 0.0));
    vec2 c = hash(i + vec2(0.0, 1.0));
    vec2 d = hash(i + vec2(1.0, 1.0));

    /** 距离向量与梯度的点积 → 影响值 */
    vec2 u = f;
    float va = dot(a, u);
    float vb = dot(b, u - vec2(1.0, 0.0));
    float vc = dot(c, u - vec2(0.0, 1.0));
    float vd = dot(d, u - vec2(1.0, 1.0));

    /** Hermite 平滑插值：f*f*(3.0-2.0*f) 比线性插值更平滑 */
    vec2 su = f * f * (3.0 - 2.0 * f);
    return mix(mix(va, vb, su.x), mix(vc, vd, su.x), su.y);
  }

  /**
   * 分形布朗运动（FBM）
   *
   * 核心思想：叠加多个不同频率和振幅的噪声
   * - 每一层（octave）频率翻倍（lacunarity），振幅减半（persistence）
   * - 低频 = 大轮廓，高频 = 细节纹理
   * - 模拟自然界分形结构（山脉、云雾、海岸线）
   *
   * @param p - 采样坐标
   * @param octaves - 叠加层数（通常 4~8）
   * @param lacunarity - 频率倍数（默认 2.0）
   * @param persistence - 振幅倍数（默认 0.5）
   */
  float fbm(vec2 p, int octaves, float lacunarity, float persistence) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amplitude * perlinNoise(p * frequency);
      frequency *= lacunarity;
      amplitude *= persistence;
    }
    return value;
  }
`

/* ========== 2. Perlin Noise 面板着色器 ========== */

/**
 * Perlin Noise 面板 — 展示基础梯度噪声
 *
 * 视觉效果：
 * - 噪声云图随时间缓慢流动
 * - 颜色映射：蓝色（低值）→ 白色（高值）
 * - 可调缩放（scale）控制噪声密度
 */
const perlinVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const perlinFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;

  varying vec2 vUv;

  ${noiseUtils}

  void main() {
    vec2 uv = vUv * uScale;

    /**
     * 用 uTime 驱动采样坐标的偏移
     * - uv + vec2(time * 0.1, time * 0.05)：向右上角缓慢流动
     * - 不同方向速度不同，产生斜向流动的效果
     */
    float n = perlinNoise(uv + vec2(uTime * 0.1, uTime * 0.05));

    /**
     * 将噪声值从 [-0.7, 0.7] 映射到 [0, 1]
     * - * 0.5 + 0.5 是标准的噪声值域映射
     */
    n = n * 0.5 + 0.5;

    /**
     * 颜色映射：蓝色 → 白色
     * - mix(vec3(0.1, 0.2, 0.8), vec3(1.0), n)
     * - n = 0 → 深蓝色，n = 1 → 白色
     */
    vec3 color = mix(vec3(0.1, 0.2, 0.8), vec3(1.0), n);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 3. FBM 面板着色器 ========== */

/**
 * FBM 面板 — 展示分形布朗运动
 *
 * 视觉效果：
 * - 多层噪声叠加，细节随 octaves 增加而丰富
 * - 可调 octaves（1~8）、lacunarity、persistence
 * - 暖色系：深棕 → 金黄
 */
const fbmVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fbmFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform int uOctaves;
  uniform float uLacunarity;
  uniform float uPersistence;

  varying vec2 vUv;

  ${noiseUtils}

  void main() {
    vec2 uv = vUv * 3.0;

    /**
     * FBM 采样
     * - octaves 越多，细节越丰富（但也越慢）
     * - lacunarity 控制每层频率翻倍的倍率
     * - persistence 控制每层振幅衰减的倍率
     */
    float n = fbm(uv + uTime * 0.05, uOctaves, uLacunarity, uPersistence);

    /** 映射到 [0, 1] */
    n = n * 0.5 + 0.5;

    /** 暖色系映射：深棕 → 金黄 */
    vec3 colorA = vec3(0.15, 0.08, 0.02);
    vec3 colorB = vec3(0.95, 0.75, 0.3);
    vec3 color = mix(colorA, colorB, n);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 4. 云雾与火焰面板着色器 ========== */

/**
 * 云雾与火焰面板 — 展示噪声的有机效果
 *
 * 视觉效果：
 * - 上半部分：漂浮的云雾（FBM + 时间动画）
 * - 下半部分：跳动的火焰（FBM + 燃烧衰减）
 * - 用 uv.y 做上下分区
 */
const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const cloudFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDensity;

  varying vec2 vUv;

  ${noiseUtils}

  /**
   * 云雾函数
   *
   * 原理：
   * 1. FBM 生成多层噪声 → 模拟云的密度分布
   * 2. uv 坐标加时间偏移 → 云缓慢漂移
   * 3. smoothstep 强化对比度 → 让云更"团状"
   */
  float cloud(vec2 uv, float time) {
    vec2 q = uv * uDensity + vec2(time * 0.03, time * 0.02);
    float n = fbm(q, 6, 2.0, 0.5);
    /** smoothstep 让云的边缘更清晰 */
    return smoothstep(-0.1, 0.6, n * 0.5 + 0.5);
  }

  /**
   * 火焰函数
   *
   * 原理：
   * 1. uv.y 轴翻转 → 火焰从底部向上燃烧
   * 2. q.y -= time → 火焰向上飘动（UV 向下滚动 = 图案向上移动）
   * 3. fbm 生成扰动 → 火焰边缘不规则
   * 4. (1.0 - uv.y) → 底部亮、顶部暗（火焰自然衰减）
   * 5. smoothstep 强化火焰形状
   */
  float fire(vec2 uv, float time) {
    vec2 q = uv;
    q.y -= time * 0.3;
    float n = fbm(q * uDensity, 5, 2.0, 0.6);
    return smoothstep(0.2, 0.9, (n * 0.5 + 0.5) * (1.0 - uv.y));
  }

  void main() {
    vec2 uv = vUv;

    if (uv.y > 0.5) {
      /* ========== 上半部分：云雾 ========== */
      vec2 cloudUV = vec2(uv.x, (uv.y - 0.5) * 2.0);
      float c = cloud(cloudUV, uTime);

      /** 天空背景 → 白色云雾 */
      vec3 skyColor = vec3(0.15, 0.25, 0.55);
      vec3 cloudColor = vec3(0.9, 0.95, 1.0);
      vec3 color = mix(skyColor, cloudColor, c);

      gl_FragColor = vec4(color, 1.0);
    } else {
      /* ========== 下半部分：火焰 ========== */
      vec2 fireUV = vec2(uv.x, uv.y * 2.0);
      float f = fire(fireUV, uTime);

      /** 黑色背景 → 橙红色火焰 */
      vec3 bgColor = vec3(0.02, 0.01, 0.0);
      vec3 fireColor = vec3(1.0, 0.4, 0.05);
      vec3 hotColor = vec3(1.0, 0.9, 0.3);
      vec3 color = mix(bgColor, mix(fireColor, hotColor, f * f), f);

      gl_FragColor = vec4(color, 1.0);
    }
  }
`

/* ========== 5. 顶点变形面板着色器 ========== */

/**
 * 顶点变形面板 — 3D 球体 + 噪声顶点偏移
 *
 * 视觉效果：
 * - 高面数球体，表面随噪声起伏
 * - 法线重算后光照正确
 * - 噪声频率和振幅可调
 *
 * 核心知识：
 * - 顶点着色器中用 noise 偏移 position
 * - 法线需要根据变形后的位置重算（或近似）
 * - varying 传 color 给片元着色器
 */
const deformVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;

  ${noiseUtils}

  void main() {
    /**
     * 在顶点着色器中用噪声偏移顶点位置
     *
     * 步骤：
     * 1. 取模型空间的 position
     * 2. 用 position 的 xy + time 作为 FBM 采样坐标
     * 3. 用噪声值沿法线方向偏移顶点
     * 4. 重算变形后的法线（有限差分法近似）
     */
    vec3 pos = position;

    /** 用顶点位置采样噪声，加时间让它动起来 */
    float n = fbm(pos.xy * uNoiseScale + uTime * 0.15, 4, 2.0, 0.5);
    vNoise = n;

    /**
     * 沿法线方向偏移
     * - n * uNoiseStrength：噪声值 × 强度
     * - normal 方向：让凸起和凹陷沿表面法线分布
     */
    pos += normal * n * uNoiseStrength;

    /**
     * 法线近似重算（有限差分法）
     *
     * 变形后的法线不能直接用原始 normal，
     * 需要根据相邻顶点的偏移量重新计算。
     * 这里用简化方法：对 pos 做微小偏移，算切线，再叉积。
     */
    float eps = 0.01;
    vec3 posU = position + vec3(eps, 0.0, 0.0);
    vec3 posV = position + vec3(0.0, eps, 0.0);

    float nU = fbm(posU.xy * uNoiseScale + uTime * 0.15, 4, 2.0, 0.5);
    float nV = fbm(posV.xy * uNoiseScale + uTime * 0.15, 4, 2.0, 0.5);

    posU += normal * nU * uNoiseStrength;
    posV += normal * nV * uNoiseStrength;

    vec3 tangent = normalize(posU - pos);
    vec3 bitangent = normalize(posV - pos);
    vNormal = normalize(cross(tangent, bitangent));

    vPosition = pos;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const deformFragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;

  void main() {
    /**
     * 简单光照计算
     *
     * - lightDir：从右上方打来的方向光
     * - diffuse：法线与光方向的点积（Lambert 漫反射）
     * - ambient：环境光，防止暗面全黑
     */
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    float ambient = 0.15;

    /**
     * 用噪声值映射颜色
     *
     * - 低噪声值（凹陷）→ 深蓝色（海洋）
     * - 中噪声值（平原）→ 绿色（草地）
     * - 高噪声值（凸起）→ 白色（雪山）
     *
     * smoothstep 实现平滑的颜色过渡
     */
    float n = vNoise * 0.5 + 0.5;
    vec3 deepColor = vec3(0.1, 0.2, 0.6);
    vec3 midColor = vec3(0.2, 0.6, 0.2);
    vec3 highColor = vec3(0.95, 0.95, 1.0);

    vec3 color;
    if (n < 0.45) {
      color = mix(deepColor, midColor, smoothstep(0.2, 0.45, n));
    } else {
      color = mix(midColor, highColor, smoothstep(0.45, 0.75, n));
    }

    /** 应用光照 */
    color *= (ambient + diffuse);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 6. 创建 ShaderMaterial 面板 ========== */

/**
 * 创建 Perlin Noise 面板
 *
 * - PlaneGeometry(4, 4)：4×4 的正方形平面
 * - 位置 x = -6：最左侧
 * - uScale 控制噪声缩放（密度）
 */
function createPerlinPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: perlinVertexShader,
    fragmentShader: perlinFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 3.0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-6, 0, 0)
  return mesh
}

/**
 * 创建 FBM 面板
 *
 * - 位置 x = -2：左数第二个
 * - uOctaves / uLacunarity / uPersistence 三个可调参数
 */
function createFBMPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: fbmVertexShader,
    fragmentShader: fbmFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uOctaves: { value: 4 },
      uLacunarity: { value: 2.0 },
      uPersistence: { value: 0.5 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-2, 0, 0)
  return mesh
}

/**
 * 创建云雾与火焰面板
 *
 * - 位置 x = 2：右数第二个
 * - 上半云雾、下半火焰
 * - uDensity 控制噪声密度
 */
function createCloudPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: 3.0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(2, 0, 0)
  return mesh
}

/**
 * 创建顶点变形面板
 *
 * - IcosahedronGeometry(1.5, 64)：高面数球体（64 细分 ≈ 40962 顶点）
 * - 位置 x = 6：最右侧
 * - uNoiseScale / uNoiseStrength 控制噪声密度和变形强度
 */
function createDeformPanel(): THREE.Mesh {
  const geometry = new THREE.IcosahedronGeometry(1.5, 64)
  const material = new THREE.ShaderMaterial({
    vertexShader: deformVertexShader,
    fragmentShader: deformFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uNoiseScale: { value: 2.0 },
      uNoiseStrength: { value: 0.3 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(6, 0, 0)
  return mesh
}

/* ========== 7. 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景图结构：
 * scene (根节点)
 * ├── ambientLight          (环境光)
 * ├── perlinPanel           (Perlin Noise 面板，最左侧)
 * │   └── ShaderMaterial    (梯度噪声)
 * ├── fbmPanel              (FBM 面板，左二)
 * │   └── ShaderMaterial    (分形布朗运动)
 * ├── cloudPanel            (云雾/火焰面板，右二)
 * │   └── ShaderMaterial    (有机效果)
 * └── deformPanel           (顶点变形面板，最右侧)
 *     └── IcosahedronGeometry + ShaderMaterial (噪声地形)
 *
 * 四种 ShaderMaterial 分别演示：
 * 1. Perlin Noise：基础梯度噪声原理
 * 2. FBM：多层噪声叠加 → 分形细节
 * 3. 云雾/火焰：噪声驱动的有机效果
 * 4. 顶点变形：噪声在 3D 空间中的应用
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a0a',
    fov: 50,
  })

  /**
   * 相机位置调整
   *
   * z = 14 比第 11 课（z = 12）稍远，
   * 因为右侧球体面板需要更多空间
   */
  manager.camera.position.set(0, 0, 14)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  /* ========== 灯光 ========== */
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
  manager.scene.add(ambientLight)

  /* ========== 创建四个 ShaderMaterial 面板 ========== */
  const perlinPanel = createPerlinPanel()
  const fbmPanel = createFBMPanel()
  const cloudPanel = createCloudPanel()
  const deformPanel = createDeformPanel()

  manager.scene.add(perlinPanel)
  manager.scene.add(fbmPanel)
  manager.scene.add(cloudPanel)
  manager.scene.add(deformPanel)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  /**
   * 面板选择器 + 滑块可见性联动
   *
   * 选择「全部」时所有滑块可见，
   * 选择单个面板时只显示对应的滑块
   */
  const updateSliderVisibility = (panelValue: string) => {
    const perlinScale = panel.getControl('perlin-scale')
    const fbmOctaves = panel.getControl('fbm-octaves')
    const fbmLacunarity = panel.getControl('fbm-lacunarity')
    const fbmPersistence = panel.getControl('fbm-persistence')
    const cloudDensity = panel.getControl('cloud-density')
    const deformScale = panel.getControl('deform-scale')
    const deformStrength = panel.getControl('deform-strength')

    const show = (el: HTMLElement | undefined, visible: boolean) => {
      if (el?.parentElement) {
        el.parentElement.style.display = visible ? '' : 'none'
      }
    }

    const isAll = panelValue === 'all'
    show(perlinScale, isAll || panelValue === 'perlin')
    show(fbmOctaves, isAll || panelValue === 'fbm')
    show(fbmLacunarity, isAll || panelValue === 'fbm')
    show(fbmPersistence, isAll || panelValue === 'fbm')
    show(cloudDensity, isAll || panelValue === 'cloud')
    show(deformScale, isAll || panelValue === 'deform')
    show(deformStrength, isAll || panelValue === 'deform')
  }

  /** 面板选择器 */
  panel.addSelect({
    id: 'panel-selector',
    label: '当前面板',
    type: 'select',
    options: [
      { value: 'all', label: '全部' },
      { value: 'perlin', label: 'Perlin Noise' },
      { value: 'fbm', label: 'FBM' },
      { value: 'cloud', label: '云雾/火焰' },
      { value: 'deform', label: '顶点变形' },
    ],
    defaultValue: 'all',
    onChange: (value: string) => {
      if (value === 'all') {
        perlinPanel.visible = true
        fbmPanel.visible = true
        cloudPanel.visible = true
        deformPanel.visible = true
      } else {
        perlinPanel.visible = value === 'perlin'
        fbmPanel.visible = value === 'fbm'
        cloudPanel.visible = value === 'cloud'
        deformPanel.visible = value === 'deform'
      }
      updateSliderVisibility(value)
    },
  })

  /* ---- Perlin Noise 参数 ---- */
  panel.addSlider({
    id: 'perlin-scale',
    label: '噪声缩放',
    type: 'slider',
    min: 1,
    max: 10,
    step: 0.1,
    defaultValue: 3.0,
    onChange: (value: number) => {
      const material = perlinPanel.material as THREE.ShaderMaterial
      material.uniforms.uScale.value = value
    },
  })

  /* ---- FBM 参数 ---- */
  panel.addSlider({
    id: 'fbm-octaves',
    label: 'FBM 层数',
    type: 'slider',
    min: 1,
    max: 8,
    step: 1,
    defaultValue: 4,
    onChange: (value: number) => {
      const material = fbmPanel.material as THREE.ShaderMaterial
      material.uniforms.uOctaves.value = Math.round(value)
    },
  })

  panel.addSlider({
    id: 'fbm-lacunarity',
    label: '频率倍数',
    type: 'slider',
    min: 1.5,
    max: 3.0,
    step: 0.1,
    defaultValue: 2.0,
    onChange: (value: number) => {
      const material = fbmPanel.material as THREE.ShaderMaterial
      material.uniforms.uLacunarity.value = value
    },
  })

  panel.addSlider({
    id: 'fbm-persistence',
    label: '振幅衰减',
    type: 'slider',
    min: 0.2,
    max: 0.8,
    step: 0.05,
    defaultValue: 0.5,
    onChange: (value: number) => {
      const material = fbmPanel.material as THREE.ShaderMaterial
      material.uniforms.uPersistence.value = value
    },
  })

  /* ---- 云雾/火焰 参数 ---- */
  panel.addSlider({
    id: 'cloud-density',
    label: '密度',
    type: 'slider',
    min: 1,
    max: 8,
    step: 0.1,
    defaultValue: 3.0,
    onChange: (value: number) => {
      const material = cloudPanel.material as THREE.ShaderMaterial
      material.uniforms.uDensity.value = value
    },
  })

  /* ---- 顶点变形 参数 ---- */
  panel.addSlider({
    id: 'deform-scale',
    label: '噪声频率',
    type: 'slider',
    min: 0.5,
    max: 6,
    step: 0.1,
    defaultValue: 2.0,
    onChange: (value: number) => {
      const material = deformPanel.material as THREE.ShaderMaterial
      material.uniforms.uNoiseScale.value = value
    },
  })

  panel.addSlider({
    id: 'deform-strength',
    label: '变形强度',
    type: 'slider',
    min: 0,
    max: 1.0,
    step: 0.01,
    defaultValue: 0.3,
    onChange: (value: number) => {
      const material = deformPanel.material as THREE.ShaderMaterial
      material.uniforms.uNoiseStrength.value = value
    },
  })

  /** 动画速度 */
  let animationSpeed = 1.0
  panel.addSlider({
    id: 'animation-speed',
    label: '动画速度',
    type: 'slider',
    min: 0.1,
    max: 3.0,
    step: 0.1,
    defaultValue: 1.0,
    onChange: (value: number) => {
      animationSpeed = value
    },
  })

  /** 初始化滑块可见性（默认全部显示） */
  updateSliderVisibility('all')

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)

    const elapsedTime = clock.getElapsedTime() * animationSpeed

    /**
     * 每帧更新所有面板的 uTime uniform
     * 四个面板共享同一个时钟，动画节奏一致
     */
    const perlinMaterial = perlinPanel.material as THREE.ShaderMaterial
    perlinMaterial.uniforms.uTime.value = elapsedTime

    const fbmMaterial = fbmPanel.material as THREE.ShaderMaterial
    fbmMaterial.uniforms.uTime.value = elapsedTime

    const cloudMaterial = cloudPanel.material as THREE.ShaderMaterial
    cloudMaterial.uniforms.uTime.value = elapsedTime

    const deformMaterial = deformPanel.material as THREE.ShaderMaterial
    deformMaterial.uniforms.uTime.value = elapsedTime

    /** 球体面板额外加自转，让变形效果更立体 */
    deformPanel.rotation.y = elapsedTime * 0.1

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }

  animate()
}

/* ========== 启动 ========== */
init()
