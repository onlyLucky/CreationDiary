/**
 * 第 12 课：噪声函数
 *
 * 学习目标：
 * 1. 理解 Perlin / Simplex / Value 三种噪声的异同
 * 2. 掌握 FBM（分形布朗运动）的原理和应用
 * 3. 学会用噪声做有机效果（云雾、地形、火焰）
 * 4. 理解噪声在顶点着色器中的变形应用
 *
 * 本节概览（五个并排的 ShaderMaterial 面板，从左到右）：
 * 1. Perlin Noise 面板：2D 梯度噪声基础 + 动画
 * 2. FBM 面板：分形布朗运动，可调 octaves/lacunarity/persistence
 * 3. 云雾与火焰面板：FBM 驱动的有机效果
 * 4. 顶点变形面板：3D 球体 + 噪声顶点偏移
 * 5. 噪声对比面板：Value / Perlin / Simplex 同屏三栏对照
 *
 * 核心思路：
 * - 噪声 = 连续的伪随机函数（相邻点值接近，整体随机）
 * - Value Noise：格点存随机「值」+ 平滑插值，最朴素的噪声，理解本质的教具
 * - Perlin Noise：网格梯度 + Hermite 插值 → 平滑连续
 * - Simplex Noise：三角形网格的梯度噪声，方向偏差更小、计算更快
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
 * - 观察五个 ShaderMaterial 面板的动态效果
 * - 使用控制面板切换效果和调整参数
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import gsap from 'gsap'

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
     * 颜色映射：纯灰度渐变（白 → 浅灰 → 中灰）
     *
     * 参考 demo.jpg 的第 1 栏：技术底层用灰度呈现，
     * 不赋予物理色彩，强调噪声本身的「连续明暗」。
     * - n = 0 → 中灰，n = 1 → 纯白
     * - 轻微扩展对比度，让浮雕感更明显
     */
    n = smoothstep(0.15, 0.85, n);
    vec3 color = vec3(mix(0.35, 1.0, n));

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

    /**
     * 颜色映射：高对比黑白（灰度密集纹理）
     *
     * 参考 demo.jpg 的第 2 栏：仍用灰度，但施加高对比
     * stretch，让多层细节（octaves 叠加的自相似纹理）清晰可辨。
     * 与第 1 栏的差异：这里已经看到了「分形细节」，
     * 但尚未赋予物理色彩。
     */
    n = smoothstep(0.2, 0.8, n);
    vec3 color = vec3(n);

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
      /* ========== 上半部分：冷灰白烟雾 ========== */
      vec2 cloudUV = vec2(uv.x, (uv.y - 0.5) * 2.0);
      float c = cloud(cloudUV, uTime);

      /**
       * 参考 demo.jpg 的第 3 栏：
       * 顶部是冷色的灰白烟雾（技术 → 应用的第一抹色彩，
       * 由下而上从火焰的橙红过渡到冷烟）。
       * - 深冷灰色天空 → 冷白烟雾
       */
      vec3 skyColor = vec3(0.22, 0.25, 0.32);
      vec3 cloudColor = vec3(0.9, 0.93, 0.97);
      vec3 color = mix(skyColor, cloudColor, c);

      /** 冷烟高光处偏亮白，配合烟雾边缘 */
      color += vec3(0.05) * smoothstep(0.85, 1.0, c);

      gl_FragColor = vec4(color, 1.0);
    } else {
      /* ========== 下半部分：火焰 ========== */
      vec2 fireUV = vec2(uv.x, uv.y * 2.0);
      float f = fire(fireUV, uTime);

      /**
       * 底部火焰：橙红 → 亮黄热芯
       * 与上方冷烟形成强烈的冷暖对比
       */
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

  uniform vec3 uBaseColor;
  uniform float uMetalness;
  uniform float uRoughness;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;

  /**
   * 伪环境贴图 — 用球谐近似一个冷色工作室环境
   *
   * 参考 demo.jpg 的第 4 栏：金属球需要环境反光才有金属感。
   * 这里不引入真正的 envMap，而是用 vNormal 方向采样一个
   * 上下渐变（上冷白天空、下深蓝）来近似反射。
   */
  vec3 envSample(vec3 n) {
    vec3 sky = vec3(0.85, 0.9, 1.0);
    vec3 ground = vec3(0.05, 0.08, 0.14);
    return mix(ground, sky, n.y * 0.5 + 0.5);
  }

  void main() {
    /** 基于噪声值做轻微的表面起伏反射扰动（模拟微观凹凸） */
    vec3 nrm = normalize(vNormal);
    float n = vNoise * 0.5 + 0.5;
    nrm = normalize(nrm + vec3(0.0, (n - 0.5) * 1.5, 0.0));

    /** 主方向光 + 弱补光 */
    vec3 lightDir = normalize(vec3(0.6, 1.0, 0.4));
    vec3 fillDir = normalize(vec3(-0.4, 0.2, 0.6));

    /** Blinn-Phong 高光 */
    vec3 viewDir = normalize(cameraPosition - vPosition);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(nrm, halfDir), 0.0), 64.0);

    float diffuse = max(dot(nrm, lightDir), 0.0);
    float fill = max(dot(nrm, fillDir), 0.0);

    /** 金属格调：基础色 = 冷蓝金属 + 环境反光 + 方向光 + 高光 */
    vec3 base = uBaseColor;
    vec3 env = envSample(nrm);

    /** 漫反射（仍保留，金属偏暗） */
    float kd = 1.0 - uMetalness;
    vec3 color = base * (vec3(0.15) + env * 0.25) * kd;

    /** 环境镜面反射 + 方向光高光混合 */
    color += env * 0.5 * uMetalness;
    color += base * diffuse * 0.5;
    color += base * fill * 0.15;
    color += vec3(0.9, 0.95, 1.0) * spec * (1.0 - uRoughness);

    /** 凹陷处轻微暗化（模拟 AO） */
    color *= mix(0.82, 1.0, smoothstep(0.3, 0.6, n));

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 6. 噪声对比面板着色器 ========== */

/**
 * 噪声对比面板 — Value / Perlin / Simplex 同屏三栏对照
 *
 * 视觉效果：
 * - 面板分成左中右三栏，三个噪声采样同一片坐标区域
 * - 左栏 Value（暖色）：格点存随机「值」，格点感最明显
 * - 中栏 Perlin（灰度）：格点存随机「梯度」，与第 1 栏同源
 * - 右栏 Simplex（冷色）：三角形网格的梯度噪声
 * - 三栏色调微差便于区分，亮度映射一致，只比「纹理性格」
 */
const compareVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const compareFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;

  varying vec2 vUv;

  ${noiseUtils}

  /**
   * Value Noise（值噪声）— 最朴素的噪声实现
   *
   * 和 Perlin 的唯一区别：格点上存的是「随机值」，
   * 而 Perlin 的格点上存的是「随机梯度向量」。
   *
   * 步骤：
   * 1. floor(p) → 格子坐标；fract(p) → 格内位置
   * 2. random(i + offset) → 四个角各自的随机值（[0, 1)）
   * 3. Hermite 插值 f*f*(3-2*f) 平滑混合四个值
   *
   * 十行就能写完——理解「噪声 = 插值过的随机」的最佳教具
   */
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    /** 四个格点的随机值（不是梯度！） */
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    /** 与 Perlin 用同一套平滑插值，保证对照公平 */
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  /**
   * 2D Simplex Noise（单纯形噪声）
   *
   * 采用 Ashima Arts / Ian McEwan 的标准开源实现（MIT），
   * 是 The Book of Shaders、Shadertoy 上流传最广的版本。
   *
   * 相比 Perlin 的改进：
   * 1. 网格从正方形换成三角形（单纯形）——正方形网格在 45°
   *    方向有轻微「网格感」，三角形各向同性更好
   * 2. 每个点只需评估 3 个角（正方形要 4 个）——计算更快
   * 3. 高维下插值项数不爆炸（Perlin 在 3D/4D 需要 16/32 个角）
   *
   * 核心步骤：
   * 1. 斜切变换把正方形网格扭成三角形网格
   * 2. 判断当前点落在哪个三角形里，取 3 个角
   * 3. 每个角：半径衰减（m 的四次方）× 梯度与距离向量的点积
   * 4. 三个角的影响求和 → 噪声值
   */
  vec3 permute(vec3 x) {
    return mod((34.0 * x + 1.0) * x, 289.0);
  }

  float simplexNoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,   // (3 - √3) / 6，斜切量的横向分量
      0.366025403784439,   // (√3 - 1) / 2，斜切量的纵向分量
      -0.577350269189626,  // -1 + 2 * C.x，反向斜切（扭回直角坐标）
      0.024390243902439    // 1 / 41，梯度哈希的缩放
    );

    /** 斜切变换：把点映射到单纯形（三角形）网格 */
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    /** 判断在三角形的左下半还是右上半，确定另外两个角 */
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);

    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);

    /** 三个角的伪随机排列（双重 permute 充分打散） */
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    /** 半径衰减：距角越远贡献越小（0.5 - 距离²，四次方收得更尖） */
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;

    /** 每个角的伪随机梯度方向 */
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    /** 修正项：消除网格伪影（Ashima 实现的经验系数） */
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    /** 梯度 × 距离向量，三个角求和 */
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    /**
     * 三栏同屏对照：左 Value / 中 Perlin / 右 Simplex
     *
     * 关键：三栏必须采样「同一片」坐标——
     * 用 fract(vUv.x * 3.0) 把每栏的 x 重新归一化到 [0, 1]
     * 再乘 uScale。这样三栏的差异全部来自噪声本身，
     * 而不是坐标范围不同（公平对照的前提）
     */
    float band = floor(vUv.x * 3.0);  // 0 / 1 / 2 → 属于哪一栏
    vec2 local = vec2(fract(vUv.x * 3.0), vUv.y);
    vec2 sampleUV = local * uScale + vec2(uTime * 0.08, uTime * 0.04);

    float n;
    if (band < 0.5) {
      n = valueNoise(sampleUV);              // Value 本身输出 [0, 1)
    } else if (band < 1.5) {
      n = perlinNoise(sampleUV) * 0.5 + 0.5; // Perlin 输出约 [-0.7, 0.7]
    } else {
      n = simplexNoise(sampleUV) * 0.5 + 0.5;
    }

    /** 三栏色调微差：暖（Value）/ 灰（Perlin）/ 冷（Simplex） */
    vec3 tint;
    if (band < 0.5) {
      tint = vec3(1.0, 0.92, 0.82);
    } else if (band < 1.5) {
      tint = vec3(1.0);
    } else {
      tint = vec3(0.82, 0.9, 1.0);
    }

    vec3 color = vec3(n) * tint;

    /** 栏间细分隔线（一条窄暗缝，帮助视觉分栏） */
    float fx = fract(vUv.x * 3.0);
    float seam = smoothstep(0.0, 0.004, fx) * smoothstep(0.0, 0.004, 1.0 - fx);
    color *= mix(0.35, 1.0, seam);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 7. 创建 ShaderMaterial 面板 ========== */

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
 * - 位置 x = 2：中间（第三栏）
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
 * - 位置 x = 6：右数第二个
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
      /** 冷色金属蓝（参考 demo.jpg 第 4 栏 #6b9dc7 ~ #a8d0f0） */
      uBaseColor: { value: new THREE.Color(0x6b9dc7) },
      uMetalness: { value: 1.0 },
      uRoughness: { value: 0.2 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(6, 0, 0)
  return mesh
}

/**
 * 创建噪声对比面板
 *
 * - 位置 x = 10：最右侧
 * - 一块面板上分三栏同屏对照：Value（暖）/ Perlin（灰）/ Simplex（冷）
 * - 三栏用同一坐标范围采样（公平对照），差异全部来自噪声本身
 * - uScale 控制三栏共用的噪声缩放
 */
function createComparePanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: compareVertexShader,
    fragmentShader: compareFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 3.0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(10, 0, 0)
  return mesh
}

/* ========== 8. 初始化场景 ========== */

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
 * ├── cloudPanel            (云雾/火焰面板，中间)
 * │   └── ShaderMaterial    (有机效果)
 * ├── deformPanel           (顶点变形面板，右二)
 * │   └── IcosahedronGeometry + ShaderMaterial (噪声地形)
 * └── comparePanel          (噪声对比面板，最右侧)
 *     └── ShaderMaterial    (Value / Perlin / Simplex 三栏对照)
 *
 * 五种 ShaderMaterial 分别演示：
 * 1. Perlin Noise：基础梯度噪声原理
 * 2. FBM：多层噪声叠加 → 分形细节
 * 3. 云雾/火焰：噪声驱动的有机效果
 * 4. 顶点变形：噪声在 3D 空间中的应用
 * 5. 噪声对比：同一坐标下三种噪声的纹理差异
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
   * 五个面板沿 X 轴排开（x = -6 ~ 10），中心在 x = 2，
   * 相机初始对准中心；z = 14 保证全景能装下五个面板
   */
  manager.camera.position.set(2, 0, 14)
  manager.camera.lookAt(2, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  /**
   * 各面板的相机聚焦点（all 回到全景）
   *
   * 面板在 X 轴上并排（间距 4），相机 z = 14。
   * 选中单个面板时相机平滑移动过去，让该面板居中显示。
   */
  const panelX: Record<string, number> = {
    all: 2,
    perlin: -6,
    fbm: -2,
    cloud: 2,
    deform: 6,
    compare: 10,
  }

  /** 切换面板时平滑移动相机，让选中面板居中 */
  const flyTo = (value: string) => {
    const x = panelX[value] ?? 0
    gsap.to(controls.target, { x, y: 0, z: 0, duration: 0.8, ease: 'power2.inOut' })
    gsap.to(manager.camera.position, { x, y: 0, z: 14, duration: 0.8, ease: 'power2.inOut', onUpdate: () => controls.update() })
  }

  /* ========== 灯光 ========== */
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
  manager.scene.add(ambientLight)

  /* ========== 创建五个 ShaderMaterial 面板 ========== */
  const perlinPanel = createPerlinPanel()
  const fbmPanel = createFBMPanel()
  const cloudPanel = createCloudPanel()
  const deformPanel = createDeformPanel()
  const comparePanel = createComparePanel()

  manager.scene.add(perlinPanel)
  manager.scene.add(fbmPanel)
  manager.scene.add(cloudPanel)
  manager.scene.add(deformPanel)
  manager.scene.add(comparePanel)

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
    const compareScale = panel.getControl('compare-scale')

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
    show(compareScale, isAll || panelValue === 'compare')
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
      { value: 'compare', label: '噪声对比' },
    ],
    defaultValue: 'all',
    onChange: (value: string) => {
      if (value === 'all') {
        perlinPanel.visible = true
        fbmPanel.visible = true
        cloudPanel.visible = true
        deformPanel.visible = true
        comparePanel.visible = true
      } else {
        perlinPanel.visible = value === 'perlin'
        fbmPanel.visible = value === 'fbm'
        cloudPanel.visible = value === 'cloud'
        deformPanel.visible = value === 'deform'
        comparePanel.visible = value === 'compare'
      }
      updateSliderVisibility(value)
      /** 相机平滑移动，让选中面板居中 */
      flyTo(value)
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

  /* ---- 噪声对比 参数 ---- */
  panel.addSlider({
    id: 'compare-scale',
    label: '噪声缩放',
    type: 'slider',
    min: 1,
    max: 10,
    step: 0.1,
    defaultValue: 3.0,
    onChange: (value: number) => {
      const material = comparePanel.material as THREE.ShaderMaterial
      material.uniforms.uScale.value = value
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
     * 五个面板共享同一个时钟，动画节奏一致
     */
    const perlinMaterial = perlinPanel.material as THREE.ShaderMaterial
    perlinMaterial.uniforms.uTime.value = elapsedTime

    const fbmMaterial = fbmPanel.material as THREE.ShaderMaterial
    fbmMaterial.uniforms.uTime.value = elapsedTime

    const cloudMaterial = cloudPanel.material as THREE.ShaderMaterial
    cloudMaterial.uniforms.uTime.value = elapsedTime

    const deformMaterial = deformPanel.material as THREE.ShaderMaterial
    deformMaterial.uniforms.uTime.value = elapsedTime

    const compareMaterial = comparePanel.material as THREE.ShaderMaterial
    compareMaterial.uniforms.uTime.value = elapsedTime

    /** 球体面板额外加自转，让变形效果更立体 */
    deformPanel.rotation.y = elapsedTime * 0.1

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }

  animate()
}

/* ========== 启动 ========== */
init()
