/**
 * 第 11 课：GLSL 数学函数
 *
 * 学习目标：
 * 1. 掌握 GLSL 内置数学函数（mix/step/smoothstep/sin/cos/pow）
 * 2. 理解向量运算（dot/cross/normalize/length/distance）
 * 3. 学会用数学函数画基本形状（圆形/矩形/六边形）
 * 4. 理解坐标系变换和 UV 映射
 * 5. 掌握 fract/mod 等周期函数
 *
 * 本节概览（四个并排的 ShaderMaterial 面板，从左到右）：
 * 1. 形状面板：distance/step/smoothstep 画圆形、矩形、六边形
 * 2. 渐变面板：mix/smoothstep 制作水平/垂直/对角/径向四种渐变
 * 3. 波浪面板：sin/cos 叠加多频率正弦波 + 径向扩散波
 * 4. 图案面板：fract/random 生成重复网格与伪随机颜色
 *
 * 核心思路：
 * - 所有效果都在片元着色器中基于 UV 坐标逐像素计算，顶点着色器只做透传
 * - 用数学「函数」组合出「图形」，再叠加时间 uniform 让图形动起来
 * - 控制面板提供滑块/选择器，交互式调节 shader 参数
 *
 * 参考案例：
 * - The Book of Shaders — Shaping Functions（https://thebookofshaders.com/05/）
 * - Inigo Quilez — 2D SDF 函数（https://iquilezles.org/articles/distfunctions2d/）
 * - Shadertoy 学习社区
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
import gsap from 'gsap'

/* ========== 1. 形状函数 — 2D SDF 基础 ========== */

/**
 * 2D 形状着色器 — 展示用数学函数画基本形状
 *
 * 核心概念：
 * - distance()：计算两点之间的欧几里得距离
 * - step()：硬边界阈值函数，x < edge → 0.0，x >= edge → 1.0
 * - smoothstep()：平滑边界阈值函数，在 edge0 和 edge1 之间做 Hermite 插值
 * - length()：计算向量长度，length(v) = sqrt(v.x² + v.y²)
 * - abs()：绝对值，常用于对称化坐标
 */
/**
 * 顶点着色器（透传）
 *
 * 四个面板的顶点着色器完全相同，本课所有效果都在片元着色器里实现：
 * - 只做两件事：把 UV 坐标传给片元着色器、计算顶点的裁剪空间位置
 * - 三维坐标变换链：模型 → 世界 → 观察 → 裁剪
 *   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0)
 *   其中 modelViewMatrix = viewMatrix × modelMatrix（Three.js 预计算）
 * - varying vUv 会在三角形的三个顶点之间线性插值，片元拿到的是插值结果
 */
const shapesVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const shapesFragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;

  /**
   * 圆形 SDF（有符号距离场）
   *
   * 原理：
   * - distance(uv, center) 计算当前像素到圆心的距离
   * - smoothstep(radius, radius - softness, d)：
   *   - d > radius → 返回 0.0（圆外）
   *   - d < radius - softness → 返回 1.0（圆内）
   *   - 中间区域 → 平滑过渡
   *
   * softness 控制边缘的柔和程度：
   * - softness 小 → 边缘锐利
   * - softness 大 → 边缘模糊
   */
  float circle(vec2 uv, vec2 center, float radius, float softness) {
    float d = distance(uv, center);
    return smoothstep(radius, radius - softness, d);
  }

  /**
   * 矩形 SDF
   *
   * 原理：
   * - abs(uv - center) 将坐标对称到第一象限（利用矩形的对称性）
   * - step(d.x, halfWidth) * step(d.y, halfHeight)：
   *   - 两个条件同时满足时返回 1.0
   *   - 任一条件不满足时返回 0.0
   */
  float rectangle(vec2 uv, vec2 center, vec2 size) {
    vec2 d = abs(uv - center);
    return step(d.x, size.x * 0.5) * step(d.y, size.y * 0.5);
  }

  /**
   * 六边形 SDF（简化版，思路来自 Inigo Quilez 的 2D SDF）
   *
   * 原理：
   * - abs() 利用六边形的中心对称性，把坐标折叠到第一象限再处理
   * - vec2(1.0, 1.73) 的方向角为 atan(1.73 / 1.0) = 60°（1.73 ≈ √3）
   *   normalize 后得到单位向量 vec2(0.5, 0.866)，即 (cos60°, sin60°)
   * - dot(d, normalize(vec2(1.0, 1.73))) 是 d 在 60° 方向上的投影，
   *   衡量「到 60° 斜边边界的距离」
   * - max(投影, d.x) 取两个边界距离中较大的，共同围出六边形的轮廓
   * - 最后用 smoothstep 做柔边
   */
  float hexagon(vec2 uv, vec2 center, float radius) {
    vec2 d = abs(uv - center);
    float result = max(dot(d, normalize(vec2(1.0, 1.73))), d.x);
    return smoothstep(radius, radius - 0.01, result);
  }

  void main() {
    /**
     * 将 UV 坐标中心化
     * - 原始 UV 范围 [0, 1]，原点在左下角
     * - 减去 0.5 后范围 [-0.5, 0.5]，原点在中心
     * - 这样画形状时更方便（圆形在中心）
     */
    vec2 uv = vUv - 0.5;

    /**
     * 动态圆形 — 使用 sin() 让半径随时间脉动
     *
     * sin(uTime) 返回 [-1, 1]，乘以 0.1 后变为 [-0.1, 0.1]
     * 加到基础半径 0.3 上，得到 [0.2, 0.4] 的脉动范围
     */
    float pulseRadius = 0.3 + sin(uTime) * 0.1;
    float c = circle(uv, vec2(0.0), pulseRadius, 0.02);

    /**
     * 静态矩形 — 放在右侧
     *
     * size = vec2(0.3, 0.2) 表示宽 0.3、高 0.2
     * 中心在 (0.25, 0.0)
     */
    float r = rectangle(uv, vec2(0.25, 0.0), vec2(0.3, 0.2));

    /**
     * 六边形 — 放在左侧
     */
    float h = hexagon(uv, vec2(-0.25, 0.0), 0.2);

    /**
     * 混合三种形状的颜色
     *
     * vec3(1.0, 0.4, 0.4) = 红色（圆形）
     * vec3(0.4, 1.0, 0.4) = 绿色（矩形）
     * vec3(0.4, 0.4, 1.0) = 蓝色（六边形）
     *
     * max() 用于叠加：多个形状重叠时取最亮的颜色
     */
    vec3 color = vec3(0.0);
    color = max(color, vec3(1.0, 0.4, 0.4) * c);
    color = max(color, vec3(0.4, 1.0, 0.4) * r);
    color = max(color, vec3(0.4, 0.4, 1.0) * h);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 2. 渐变效果 — mix + smoothstep ========== */

/**
 * 渐变效果着色器 — 展示不同类型的渐变
 *
 * 核心概念：
 * - mix(a, b, t)：线性插值，返回 a * (1-t) + b * t
 * - smoothstep(edge0, edge1, x)：平滑阶跃，在 edge0 和 edge1 之间做 Hermite 插值
 * - length()：向量长度，用于径向渐变
 */
const gradientVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const gradientFragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    /**
     * 四种渐变效果随时间循环切换
     *
     * 1. 水平渐变：mix(0.0, 1.0, uv.x)
     *    - uv.x 从 0 到 1，mix 从黑色渐变到白色
     *
     * 2. 垂直渐变：mix(0.0, 1.0, uv.y)
     *    - uv.y 从 0 到 1，mix 从黑色渐变到白色
     *
     * 3. 对角渐变：mix(0.0, 1.0, (uv.x + uv.y) * 0.5)
     *    - x 和 y 的平均值，形成 45° 对角线渐变
     *
     * 4. 径向渐变：length(uv - 0.5) * 2.0
     *    - 到中心的距离，从中心向外渐变
     *
     * selector：用 mod() 把不断递增的时间 uTime 映射到 [0, 4) 区间
     * - 每经过 1.0 / 0.2 = 5 秒循环一次（mod 取模实现周期性）
     * - 再通过 if/else 把当前周期分派到四种渐变
     */
    float gradient = 0.0;
    float selector = mod(uTime * 0.2, 4.0);

    if (selector < 1.0) {
      /* 水平渐变 */
      gradient = mix(0.0, 1.0, uv.x);
    } else if (selector < 2.0) {
      /* 垂直渐变 */
      gradient = mix(0.0, 1.0, uv.y);
    } else if (selector < 3.0) {
      /* 对角渐变 */
      gradient = mix(0.0, 1.0, (uv.x + uv.y) * 0.5);
    } else {
      /* 径向渐变 */
      vec2 centeredUV = uv - 0.5;
      gradient = length(centeredUV) * 2.0;
    }

    /**
     * 使用 smoothstep 让渐变更柔和
     *
     * smoothstep(0.0, 1.0, gradient) 保持原样
     * 但如果用 smoothstep(0.2, 0.8, gradient)，会压缩中间的过渡区域
     */
    gradient = smoothstep(0.0, 1.0, gradient);

    /**
     * 用 mix 混合两种颜色
     *
     * uColorA（蓝色）和 uColorB（橙色）
     * gradient 作为插值系数：0.0 → 蓝色，1.0 → 橙色
     */
    vec3 colorA = vec3(0.2, 0.4, 0.8);
    vec3 colorB = vec3(0.9, 0.5, 0.2);
    vec3 color = mix(colorA, colorB, gradient);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 3. 波浪效果 — sin/cos ========== */

/**
 * 波浪效果着色器 — 展示 sin/cos 的周期性
 *
 * 核心概念：
 * - sin(x) / cos(x)：周期函数，周期为 2π
 * - 叠加多个频率的正弦波可以形成复杂的波形
 * - 时间驱动：uTime 让波浪动起来
 */
const waveVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const waveFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFrequency;
  uniform float uAmplitude;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;

    /**
     * 基础正弦波
     *
     * sin(uv.x * freq + time) * amplitude：
     * - uv.x * freq：控制波的密度（频率）
     * - + time：让波向右移动（相位）
     * - * amplitude：控制波的高度（振幅）
     * - * 0.5 + 0.5：将 [-1, 1] 映射到 [0, 1]
     */
    float wave1 = sin(uv.x * uFrequency + uTime) * uAmplitude * 0.5 + 0.5;

    /**
     * 叠加多个频率（傅里叶级数的思想）
     *
     * 第二层：频率翻倍，振幅减半，速度稍快
     * 第三层：频率再翻倍，振幅再减半，速度再快
     *
     * 结果：波形更复杂，不再是简单的正弦波
     */
    float wave2 = sin(uv.x * uFrequency * 2.0 + uTime * 1.3) * uAmplitude * 0.25;
    float wave3 = sin(uv.x * uFrequency * 4.0 + uTime * 0.7) * uAmplitude * 0.125;

    /**
     * 径向波浪（从中心向外扩散）
     *
     * length(uv) 是到中心的距离
     * - uTime * 3.0 让波浪向外扩散
     */
    float radialWave = sin(length(uv) * 20.0 - uTime * 3.0) * 0.3 + 0.5;

    /**
     * 选择显示哪种波浪
     *
     * uv.y > 0.0 时显示水平波浪（上半部分）
     * uv.y <= 0.0 时显示径向波浪（下半部分）
     */
    float wave = 0.0;
    if (uv.y > 0.0) {
      wave = wave1 + wave2 + wave3;
    } else {
      wave = radialWave;
    }

    /**
     * 用波浪值映射颜色
     *
     * wave 的范围大约在 [0, 1]
     * 直接用作灰度值
     */
    vec3 color = vec3(wave);

    /**
     * 添加一些颜色变化
     *
     * sin/cos 叠加不同相位，生成彩色
     */
    color.r += sin(wave * 3.14 + uTime) * 0.3;
    color.g += sin(wave * 3.14 + uTime + 2.094) * 0.3;
    color.b += sin(wave * 3.14 + uTime + 4.188) * 0.3;

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 4. 图案重复 — fract + mod ========== */

/**
 * 图案重复着色器 — 展示 fract 和 mod 的用法
 *
 * 核心概念：
 * - fract(x)：取小数部分，返回 x - floor(x)
 * - mod(x, y)：取模，返回 x - y * floor(x/y)
 * - 两者都可以用于创建重复图案
 */
const patternVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const patternFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uGridSize;

  varying vec2 vUv;

  /**
   * 伪随机数生成器
   *
   * 原理：
   * 1. dot(st, vec2(12.9898, 78.233))：将 2D 坐标映射到 1D
   * 2. sin(...)：正弦函数，产生周期性
   * 3. * 43758.5453：放大，让小数部分更"随机"
   * 4. fract(...)：只取小数部分，得到 [0, 1) 的伪随机数
   *
   * 注意：这不是真正的随机，是确定性的（相同输入 = 相同输出）
   */
  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;

    /**
     * fract(uv * gridSize) 实现图案重复
     *
     * uv * 5.0 将坐标放大 5 倍：[0, 1] → [0, 5]
     * fract(...) 取小数部分：每个整数区间都映射回 [0, 1]
     * 结果：5x5 的重复网格，每个格子都是 [0, 1]
     */
    vec2 gridUV = fract(uv * uGridSize);

    /**
     * 在每个格子内画一个圆形
     *
     * 圆心在格子中心 (0.5, 0.5)
     * 半径 0.3，柔和度 0.02
     */
    float d = distance(gridUV, vec2(0.5));
    float circle = smoothstep(0.3, 0.28, d);

    /**
     * 使用伪随机数给每个格子不同的颜色
     *
     * floor(uv * gridSize) 获取格子索引
     * random() 根据格子索引生成随机数
     * 结果：每个格子的颜色都不同
     */
    vec2 gridIndex = floor(uv * uGridSize);
    float rand = random(gridIndex);

    /**
     * 动态颜色映射
     *
     * sin(uTime + rand * 6.28) 让颜色随时间变化
     * 每个格子的变化相位不同（因为 rand 不同）
     */
    vec3 color = vec3(0.0);
    color.r = sin(uTime + rand * 6.28) * 0.5 + 0.5;
    color.g = sin(uTime + rand * 6.28 + 2.094) * 0.5 + 0.5;
    color.b = sin(uTime + rand * 6.28 + 4.188) * 0.5 + 0.5;

    /**
     * 应用圆形遮罩
     *
     * 只在圆内显示颜色，圆外为黑色
     */
    color *= circle;

    /**
     * 添加网格线（可选，用于可视化网格结构）
     *
     * step(0.98, gridUV.x) + step(0.98, gridUV.y)：
     * - 当 gridUV.x > 0.98 时返回 1.0（右侧边缘）
     * - 当 gridUV.y > 0.98 时返回 1.0（上侧边缘）
     * - 结果：格子的边缘显示为白色
     */
    float gridLine = step(0.98, gridUV.x) + step(0.98, gridUV.y);
    color = max(color, vec3(0.3) * gridLine);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 5. 创建 ShaderMaterial 面板 ========== */

/**
 * 创建形状展示面板
 *
 * - PlaneGeometry(4, 4)：4×4 的正方形平面，UV 范围 [0, 1]
 * - ShaderMaterial：纯片元着色，不依赖灯光/纹理，颜色全部由 shader 计算
 * - side: DoubleSide：双面渲染，旋转视角时背面也能看到内容
 * - 位置 x = -6：位于四个面板的最左侧
 */
function createShapesPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: shapesVertexShader,
    fragmentShader: shapesFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-6, 0, 0)
  return mesh
}

/**
 * 创建渐变展示面板
 *
 * 位置 x = -2：位于左数第二个
 * 结构与形状面板一致，只是替换了 fragmentShader（mix/smoothstep）
 */
function createGradientPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: gradientVertexShader,
    fragmentShader: gradientFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-2, 0, 0)
  return mesh
}

/**
 * 创建波浪展示面板
 *
 * 位置 x = 2：位于右数第二个
 * 比基础面板多出 uFrequency / uAmplitude 两个可调 uniform，
 * 由控制面板的「波浪频率」「波浪振幅」滑块实时更新
 */
function createWavePanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: waveVertexShader,
    fragmentShader: waveFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFrequency: { value: 10.0 },
      uAmplitude: { value: 0.3 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(2, 0, 0)
  return mesh
}

/**
 * 创建图案展示面板
 *
 * 位置 x = 6：位于四个面板的最右侧
 * uGridSize 控制网格的密度（每行/列的格子数），
 * 由控制面板的「网格大小」滑块实时更新
 */
function createPatternPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: patternVertexShader,
    fragmentShader: patternFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uGridSize: { value: 5.0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(6, 0, 0)
  return mesh
}

/* ========== 6. 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景图结构：
 * scene (根节点)
 * ├── ambientLight          (环境光)
 * ├── shapesPanel           (形状面板，最左侧)
 * │   └── ShaderMaterial    (圆形/矩形/六边形)
 * ├── gradientPanel         (渐变面板，左二)
 * │   └── ShaderMaterial    (mix + smoothstep)
 * ├── wavePanel             (波浪面板，右二)
 * │   └── ShaderMaterial    (sin/cos 叠加)
 * └── patternPanel          (图案面板，最右侧)
 *     └── ShaderMaterial    (fract + random)
 *
 * 四种 ShaderMaterial 分别演示：
 * 1. 形状面板：distance/step/smoothstep 画基本形状
 * 2. 渐变面板：mix/smoothstep 创建渐变效果
 * 3. 波浪面板：sin/cos 叠加和径向波浪
 * 4. 图案面板：fract/random 实现图案重复
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
   * z = 12 让相机离平面更远，可以看到四个面板
   * lookAt(0, 0, 0) 看向场景中心
   */
  manager.camera.position.set(0, 0, 12)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  /**
   * 各面板的相机聚焦点（all 回到全景）
   *
   * 面板在 X 轴上并排（间距 4），相机 z = 12。
   * 选中单个面板时相机平滑移动过去，让该面板居中显示。
   */
  const panelX: Record<string, number> = {
    all: 0,
    shapes: -6,
    gradient: -2,
    wave: 2,
    pattern: 6,
  }

  /** 切换面板时平滑移动相机，让选中面板居中 */
  const flyTo = (value: string) => {
    const x = panelX[value] ?? 0
    gsap.to(controls.target, { x, y: 0, z: 0, duration: 0.8, ease: 'power2.inOut' })
    gsap.to(manager.camera.position, { x, y: 0, z: 12, duration: 0.8, ease: 'power2.inOut', onUpdate: () => controls.update() })
  }

  /* ========== 灯光 ========== */
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
  manager.scene.add(ambientLight)

  /* ========== 创建四个 ShaderMaterial 面板 ========== */
  /**
   * 四个面板在 X 轴上并排排列（面板宽 4、间距 4）：
   *   x：-6     -2     2     6
   *       形状   渐变   波浪   图案
   * 相机放在 z = 12、fov = 50 处，可完整看到四个面板
   */
  const shapesPanel = createShapesPanel()
  const gradientPanel = createGradientPanel()
  const wavePanel = createWavePanel()
  const patternPanel = createPatternPanel()

  manager.scene.add(shapesPanel)
  manager.scene.add(gradientPanel)
  manager.scene.add(wavePanel)
  manager.scene.add(patternPanel)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  /**
   * 根据当前面板选择，显示/隐藏对应的滑块控件
   *
   * 映射关系：
   * - wave-frequency / wave-amplitude → 波浪面板
   * - grid-size → 图案面板
   * - animation-speed → 全局（始终显示）
   */
  const updateSliderVisibility = (panelValue: string) => {
    const waveFreq = panel.getControl('wave-frequency')
    const waveAmp = panel.getControl('wave-amplitude')
    const gridSize = panel.getControl('grid-size')

    /** 获取滑块的 wrapper 元素（.control-item） */
    const show = (el: HTMLElement | undefined, visible: boolean) => {
      if (el?.parentElement) {
        el.parentElement.style.display = visible ? '' : 'none'
      }
    }

    if (panelValue === 'all') {
      show(waveFreq, true)
      show(waveAmp, true)
      show(gridSize, true)
    } else {
      show(waveFreq, panelValue === 'wave')
      show(waveAmp, panelValue === 'wave')
      show(gridSize, panelValue === 'pattern')
    }
  }

  /** 面板选择器 */
  panel.addSelect({
    id: 'panel-selector',
    label: '当前面板',
    type: 'select',
    options: [
      { value: 'all', label: '全部' },
      { value: 'shapes', label: '形状' },
      { value: 'gradient', label: '渐变' },
      { value: 'wave', label: '波浪' },
      { value: 'pattern', label: '图案' },
    ],
    defaultValue: 'all',
    onChange: (value: string) => {
      /** 切换面板时显示/隐藏对应的 Mesh */
      if (value === 'all') {
        shapesPanel.visible = true
        gradientPanel.visible = true
        wavePanel.visible = true
        patternPanel.visible = true
      } else {
        shapesPanel.visible = value === 'shapes'
        gradientPanel.visible = value === 'gradient'
        wavePanel.visible = value === 'wave'
        patternPanel.visible = value === 'pattern'
      }
      /** 同步显示/隐藏对应的滑块控件 */
      updateSliderVisibility(value)
      /** 相机平滑移动，让选中面板居中 */
      flyTo(value)
    },
  })

  /** 波浪参数 */
  panel.addSlider({
    id: 'wave-frequency',
    label: '波浪频率',
    type: 'slider',
    min: 1,
    max: 20,
    step: 0.1,
    defaultValue: 10,
    onChange: (value: number) => {
      const material = wavePanel.material as THREE.ShaderMaterial
      material.uniforms.uFrequency.value = value
    },
  })

  panel.addSlider({
    id: 'wave-amplitude',
    label: '波浪振幅',
    type: 'slider',
    min: 0.1,
    max: 0.5,
    step: 0.01,
    defaultValue: 0.3,
    onChange: (value: number) => {
      const material = wavePanel.material as THREE.ShaderMaterial
      material.uniforms.uAmplitude.value = value
    },
  })

  /** 图案网格大小 */
  panel.addSlider({
    id: 'grid-size',
    label: '网格大小',
    type: 'slider',
    min: 2,
    max: 20,
    step: 1,
    defaultValue: 5,
    onChange: (value: number) => {
      const material = patternPanel.material as THREE.ShaderMaterial
      material.uniforms.uGridSize.value = value
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

    /**
     * elapsedTime：从动画开始累计的总时间（秒）
     * - 乘以 animationSpeed 实现全局变速（「动画速度」滑块控制）
     * - 用累计时间而非每帧增量 delta，是因为 shader 里的
     *   sin()/mod()/fract() 都需要连续递增的时间来驱动动画
     */
    const elapsedTime = clock.getElapsedTime() * animationSpeed

    /**
     * 每帧把同一时间写入四个面板的 uTime uniform
     * 这样四个面板共享同一个时钟，动画节奏保持一致
     */
    const shapesMaterial = shapesPanel.material as THREE.ShaderMaterial
    shapesMaterial.uniforms.uTime.value = elapsedTime

    const gradientMaterial = gradientPanel.material as THREE.ShaderMaterial
    gradientMaterial.uniforms.uTime.value = elapsedTime

    const waveMaterial = wavePanel.material as THREE.ShaderMaterial
    waveMaterial.uniforms.uTime.value = elapsedTime

    const patternMaterial = patternPanel.material as THREE.ShaderMaterial
    patternMaterial.uniforms.uTime.value = elapsedTime

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }

  animate()
}

/* ========== 启动 ========== */
init()
