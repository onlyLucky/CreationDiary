/**
 * 第 12 课课后作业：噪声函数三大经典问题修复 + 附加思考题
 *
 * 作业目标（三个实践案例 + 两个思考题，从左到右）：
 * 1. 风吹草地：sin(time) 同频摆动太机械 → 用「位置 + 时间」采样连续噪声，
 *    让每根草有自己的相位、相邻草连绵成风浪
 * 2. FBM 云朵：整片均匀灰色 → 值域被压扁 + smoothstep 区间过宽，
 *    修复归一化与映射区间，并提供「原始值可视化」调试模式
 * 3. 噪声地形：Math.random() 逐顶点随机高度 → 尖刺 + 逐帧抖动，
 *    修复为 fbm(pos.xz) 连续高度场 + 有限差分法线
 * 4. 体素地形（思考题一）：Perlin 3D vs Simplex 3D 采样噪声，
 *    对照轴向伪影差异 + 体素化块状效果
 * 5. 冰面材质（思考题二）：法线扰动的噪声频率固定 → 拉近后变「糊」，
 *    对照单频 / FBM 多倍频 / Voronoi 冰晶三种方案
 *
 * 每个案例都保留「错误示范」开关，方便对照修复前后的差异。
 *
 * 运行方式：
 * 1. 修改 src/main.ts 的 MODE 为 'homework'
 * 2. 运行 pnpm dev 启动开发服务器
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import gsap from 'gsap'

/* ========== 1. GLSL 噪声工具函数（与课程代码保持一致） ========== */

/**
 * 噪声工具函数块 — 三个案例的着色器共用
 *
 * 核心函数：
 * - random(st)：伪随机数（不连续，用于「错误示范」和草叶配色扰动）
 * - hash(p)：2D 哈希，返回 vec2 梯度向量
 * - perlinNoise(p)：2D Perlin 梯度噪声（连续，一切修复的基础）
 * - fbm(p, octaves, lacunarity, persistence)：分形布朗运动
 */
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

    vec2 u = f;
    float va = dot(a, u);
    float vb = dot(b, u - vec2(1.0, 0.0));
    float vc = dot(c, u - vec2(0.0, 1.0));
    float vd = dot(d, u - vec2(1.0, 1.0));

    vec2 su = f * f * (3.0 - 2.0 * f);
    return mix(mix(va, vb, su.x), mix(vc, vd, su.x), su.y);
  }

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

/* ========== 1b. 3D 噪声工具函数（体素案例专用） ========== */

/**
 * 3D 噪声工具块 — 思考题一「体素地形」的着色器共用
 *
 * 核心函数：
 * - hash3(p)：3D 哈希，返回 vec3 梯度向量
 * - perlinNoise3D(p)：3D Perlin 梯度噪声（8 个角点，有轴向伪影）
 * - snoise(v)：3D Simplex 噪声（4 个单纯形顶点，各向同性）
 * - voronoiEdge(p)：2D Voronoi 晶界距离（思考题二「冰面」用）
 */
const noise3DUtils = /* glsl */ `
  vec3 hash3(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  /**
   * 3D Perlin 梯度噪声 — 8 个角点插值
   *
   * 特征：格点整数坐标处值恰好为 0 → 轴向方向出现隐约的网格感
   * 这就是思考题一中说的「方向性伪影」
   */
  float perlinNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    vec3 u = f * f * (3.0 - 2.0 * f);

    float n000 = dot(hash3(i), f);
    float n100 = dot(hash3(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
    float n010 = dot(hash3(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
    float n110 = dot(hash3(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
    float n001 = dot(hash3(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
    float n101 = dot(hash3(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
    float n011 = dot(hash3(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
    float n111 = dot(hash3(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));

    return mix(
      mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
      mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
      u.z
    );
  }

  /**
   * 3D Simplex 噪声 — 标准实现（Ashima Arts / Ian McEwan）
   *
   * 特征：只用 4 个单纯形顶点（Perlin 是 8 个），
   * 偏斜的单纯形网格消除了轴向伪影，更各向同性
   */
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289((x * 34.0 + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  /**
   * 2D Voronoi 晶界距离 — 思考题二「冰面」的冰晶特征层
   *
   * 返回值：到最近两个细胞边界距离之差
   * 细胞边界处值接近 0 → 形成锐利的「晶界」线条
   */
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float voronoiEdge(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float minDist1 = 8.0;
    float minDist2 = 8.0;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = hash2(i + neighbor);
        vec2 diff = neighbor + point - f;
        float dist = dot(diff, diff);

        if (dist < minDist1) {
          minDist2 = minDist1;
          minDist1 = dist;
        } else if (dist < minDist2) {
          minDist2 = dist;
        }
      }
    }

    return sqrt(minDist2) - sqrt(minDist1);
  }
`

/* ========== 2. 案例一：风吹草地 ========== */

/**
 * 风吹草地 — InstancedMesh 草叶 + 顶点着色器风场
 *
 * 两种模式对比：
 * - 错误示范（sin）：bend = sin(time)，输出只依赖时间 → 所有草同频同相，像被同一根线牵动
 * - 噪声修复：bend = noise(草根位置 + 时间·风向)，输入含每根草的空间坐标 →
 *   相邻草相位相近（连绵风浪）、远处各自独立（无机械感）、时间连续（不跳变）
 *
 * 关键技巧：
 * - 用 instanceMatrix[3].xz 取每根草的根部世界坐标作为噪声输入（草的「身份」）
 * - 摆动量乘 pow(uv.y, 1.5)：根部固定、叶尖摆动最大
 * - 叠两层噪声：低频阵风（大片起伏）+ 高频抖动（细碎颤动）
 */
const grassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindSpeed;
  uniform float uWindScale;
  uniform float uUseNoise;   // 0 = sin 错误示范，1 = 噪声修复

  varying vec2 vUv;
  varying float vSway;       // 当前摆动量（片元里做明暗，强化风浪可读性）
  varying float vTint;       // 每根草的随机色差

  ${noiseUtils}

  void main() {
    vUv = uv;

    /** 草叶局部坐标 → 实例世界坐标 */
    vec4 world = instanceMatrix * vec4(position, 1.0);

    /** 根部世界坐标（instanceMatrix 第 4 列 = 实例平移量）→ 草的「身份」 */
    vec2 base = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
    vTint = random(base * 7.31);

    float phase;
    if (uUseNoise < 0.5) {
      /**
       * 错误示范：只依赖时间的全局 sin
       * 所有草同频同相，整片整齐划一 → 机械、假
       */
      phase = sin(uTime * 2.0);
    } else {
      /**
       * 噪声修复：坐标 + 时间一起进噪声
       * - base * uWindScale：空间频率 → 风团大小
       * - + vec2(uTime * uWindSpeed, 0)：沿风向平移采样窗 → 阵风扫过草地
       *
       * 两层复合：低频阵风（大片起伏）+ 高频抖动（细碎颤动）
       */
      float gust = perlinNoise(base * uWindScale + vec2(uTime * uWindSpeed, 0.0));
      float flutter = perlinNoise(base * uWindScale * 4.0 + vec2(uTime * uWindSpeed * 2.5, 0.0));
      phase = gust * 0.8 + flutter * 0.25;
    }

    /**
     * 根部固定、叶尖摆动最大：
     * pow(uv.y, 1.5) 高度权重，uv.y = 0 是根部、1 是叶尖
     */
    float w = pow(uv.y, 1.5);
    world.x += phase * uWindStrength * w;
    world.z += phase * uWindStrength * 0.35 * w;

    vSway = phase * w;

    gl_Position = projectionMatrix * modelViewMatrix * world;
  }
`

const grassFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying float vSway;
  varying float vTint;

  void main() {
    /** 深绿根部 → 亮绿叶尖 */
    vec3 deepColor = vec3(0.05, 0.22, 0.06);
    vec3 tipColor = vec3(0.42, 0.72, 0.22);
    vec3 color = mix(deepColor, tipColor, vUv.y);

    /** 每根草轻微色差，避免整片颜色过于均一 */
    color *= 0.82 + vTint * 0.36;

    /** 顺风亮、背风暗：把摆动量转成明暗，风浪更容易看见 */
    color *= 0.88 + vSway * 0.22;

    gl_FragColor = vec4(color, 1.0);
  }
`

/**
 * 创建草地：InstancedMesh + 锥形草叶
 *
 * - 草叶几何：窄平面（1×3 段），底边在 y=0
 * - 2200 个实例撒在 6×3.2 的场地上，随机旋转/缩放
 */
function createGrassField(): THREE.InstancedMesh {
  const bladeGeometry = new THREE.PlaneGeometry(0.06, 0.9, 1, 3)
  bladeGeometry.translate(0, 0.45, 0)

  const material = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.35 },
      uWindSpeed: { value: 0.8 },
      uWindScale: { value: 0.5 },
      uUseNoise: { value: 1 },
    },
    side: THREE.DoubleSide,
  })

  const COUNT = 2200
  const FIELD_W = 6.0
  const FIELD_D = 3.2
  const grass = new THREE.InstancedMesh(bladeGeometry, material, COUNT)

  const dummy = new THREE.Object3D()
  for (let i = 0; i < COUNT; i++) {
    dummy.position.set(
      (Math.random() - 0.5) * FIELD_W,
      0,
      (Math.random() - 0.5) * FIELD_D,
    )
    dummy.rotation.y = Math.random() * Math.PI
    const s = 0.7 + Math.random() * 0.6
    dummy.scale.set(s, 0.6 + Math.random() * 0.8, s)
    dummy.updateMatrix()
    grass.setMatrixAt(i, dummy.matrix)
  }

  return grass
}

/* ========== 3. 案例二：FBM 云朵（均匀灰色问题） ========== */

/**
 * FBM 云朵 — 三种模式演示「均匀灰色」的病因与修复
 *
 * - 错误示范：persistence = 1.0（各层等幅叠加，正负抵消 → 值域坍缩在 0.5 附近），
 *   再用 smoothstep(0.0, 1.0) 宽区间映射 → 全屏落在同一个中间灰阶
 * - 修复后：persistence = 0.5（幅度快速衰减）+ 按理论满量程归一化 +
 *   smoothstep(coverage ± 0.1) 窄区间 → 云的形状层次分明
 * - 原始值：直接输出 FBM 值的灰度图（排查手段：用取色器量出实际 min/max，
 *   再据此设置映射区间）
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
  uniform float uMode;      // 0 = 错误示范，1 = 修复后，2 = 原始值可视化
  uniform float uCoverage;  // 云覆盖率（阈值）

  varying vec2 vUv;

  ${noiseUtils}

  /**
   * 可调 persistence 的 6 层 FBM
   *
   * persistence = 1.0 → 各层幅度不衰减，多层正负值互相抵消，
   * 输出向 0 收敛（值域坍缩）；0.5 → 幅度减半，低频主导 + 高频补细节
   */
  float fbm6(vec2 p, float persistence) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      value += amplitude * perlinNoise(p * frequency);
      frequency *= 2.0;
      amplitude *= persistence;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv * 3.0;

    /** 云缓慢向右上漂移 */
    vec2 drift = vec2(uTime * 0.04, uTime * 0.015);

    float raw;
    float totalAmp;
    if (uMode < 0.5) {
      /** 病因 1：等幅叠加 → 多层互相抵消，值域被压扁 */
      raw = fbm6(uv + drift, 1.0);
      totalAmp = 0.5 * 6.0;
    } else {
      raw = fbm6(uv + drift, 0.5);
      /** 理论满量程：0.5 * (1 - 0.5^6) / (1 - 0.5) */
      totalAmp = 0.5 * (1.0 - pow(0.5, 6.0)) / 0.5;
    }

    /** 归一化 + remap 到 [0, 1] */
    float n = raw / totalAmp * 0.5 + 0.5;

    if (uMode > 1.5) {
      /**
       * 排查模式：直接把 FBM 值当颜色输出
       * 用取色器量最亮/最暗像素，就能确认值域是否被压扁
       */
      gl_FragColor = vec4(vec3(n), 1.0);
      return;
    }

    float d;
    if (uMode < 0.5) {
      /**
       * 病因 2：smoothstep 区间远宽于实际值域（n 只在 0.5 附近小幅波动）
       * → 输出恒为中间值 → 整片均匀灰色
       */
      d = smoothstep(0.0, 1.0, n);
    } else {
      /** 修复：窄区间贴着实际值域扫，云边缘对比立刻出来 */
      d = smoothstep(uCoverage - 0.1, uCoverage + 0.1, n);
    }

    /** 天空渐变（上深下浅）+ 白云 */
    vec3 skyColor = mix(vec3(0.32, 0.5, 0.78), vec3(0.55, 0.7, 0.92), vUv.y);
    vec3 cloudColor = vec3(0.98, 0.99, 1.0);
    vec3 color = mix(skyColor, cloudColor, d);

    gl_FragColor = vec4(color, 1.0);
  }
`

/** 创建云朵面板：竖直平面，可切换错误/修复/调试三种模式 */
function createCloudPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: 1 },
      uCoverage: { value: 0.5 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-5.6, 1.6, 0)
  return mesh
}

/* ========== 4. 案例三：噪声地形（random vs noise） ========== */

/**
 * 噪声地形 — 顶点着色器高度场，三种模式对照
 *
 * - 噪声修复：h = fbm(pos.xz)，高度是位置的连续函数 →
 *   相邻顶点高度相近（连绵山脉）+ 同一顶点每帧结果相同（画面稳定）
 * - 随机·静态：h = random(gl_VertexID)，与位置无关 → 相邻顶点高度毫无关系，全是尖刺
 * - 随机·逐帧：把时间混进 random 的输入 → 前后帧毫无关联，地形疯狂抖动
 *
 * 法线：噪声模式用有限差分重算（山脉光影正确）；
 * 随机模式直接用平面朝上法线（光照随之崩坏，也是问题的一部分）
 */
const terrainVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMode;      // 0 = 噪声修复，1 = 随机静态，2 = 随机逐帧抖动
  uniform float uHeight;
  uniform float uNoiseScale;

  varying vec3 vNormal;
  varying float vHeight01;

  ${noiseUtils}

  /** 高度场：位置 → 高度的连续函数（山脉的核心） */
  float terrainHeight(vec2 p) {
    return fbm(p * uNoiseScale, 5, 2.0, 0.5);
  }

  void main() {
    vec3 pos = position;  // 几何体已在 CPU 侧 rotateX(-PI/2)，顶点位于 XZ 平面

    float h;
    if (uMode < 0.5) {
      /**
       * 噪声修复：高度由坐标决定
       * 相邻顶点坐标只差一点 → 输入相近 → 输出相近 → 平滑连续
       */
      h = terrainHeight(pos.xz);

      /** 有限差分法线：对高度场四邻域采样，叉积得真实坡向 */
      float eps = 0.06;
      float hL = terrainHeight(pos.xz - vec2(eps, 0.0));
      float hR = terrainHeight(pos.xz + vec2(eps, 0.0));
      float hD = terrainHeight(pos.xz - vec2(0.0, eps));
      float hU = terrainHeight(pos.xz + vec2(0.0, eps));
      vNormal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));
    } else {
      /**
       * 错误示范：Math.random() 的 GPU 等价物
       * 输入是顶点编号（与空间位置无关）→ 相邻顶点高度毫无关系 → 尖刺
       * mode = 2 再把时间混进输入 → 每帧全新一组数 → 逐帧抽搐
       */
      float seed = uMode < 1.5 ? 0.0 : uTime;
      h = random(vec2(float(gl_VertexID) * 0.371, seed)) - 0.5;
      vNormal = vec3(0.0, 1.0, 0.0);
    }

    float y = h * uHeight;
    vHeight01 = clamp(h * 0.5 + 0.5, 0.0, 1.0);

    vec3 newPos = vec3(pos.x, y, pos.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`

const terrainFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying float vHeight01;

  void main() {
    /** 方向光 Lambert 漫反射 + 环境光 */
    vec3 lightDir = normalize(vec3(0.6, 1.0, 0.4));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    float ambient = 0.3;

    /** 按高度分层配色：低谷草绿 → 山腰岩灰 → 山顶雪白 */
    vec3 lowColor = vec3(0.18, 0.42, 0.16);
    vec3 midColor = vec3(0.45, 0.4, 0.36);
    vec3 highColor = vec3(0.95, 0.95, 0.98);

    float n = vHeight01;
    vec3 color;
    if (n < 0.55) {
      color = mix(lowColor, midColor, smoothstep(0.3, 0.55, n));
    } else {
      color = mix(midColor, highColor, smoothstep(0.55, 0.8, n));
    }

    color *= (ambient + diffuse * 0.7);

    gl_FragColor = vec4(color, 1.0);
  }
`

/** 创建地形面板：CPU 侧旋转到水平的细分平面，顶点着色器顶起高度 */
function createTerrainPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(5, 5, 96, 96)
  geometry.rotateX(-Math.PI / 2)

  const material = new THREE.ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: 0 },
      uHeight: { value: 1.4 },
      uNoiseScale: { value: 0.45 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(5.6, -0.3, 0)
  return mesh
}

/* ========== 5. 思考题一：体素地形（Perlin vs Simplex） ========== */

/**
 * 体素地形 — 3D 噪声采样决定体素材质，四种模式对照
 *
 * 场景：类 Minecraft 体素沙盒游戏，逐体素采样 3D 噪声
 * 决定该处放石头、泥土还是空气
 *
 * - Perlin 3D：8 个角点插值。格点整数坐标处值恰好为 0，
 *   轴向方向出现隐约的网格感（方向性伪影）
 * - Simplex 3D：4 个单纯形顶点。偏斜网格消除了轴向伪影，
 *   更各向同性。3D 下格点数只有 Perlin 一半，性能更好
 * - 体素化模式：把采样坐标吸附到体素中心，
 *   模拟真实体素游戏的「每个方块采样一次」
 *
 * 观察要点：
 * - Perlin 的图案隐约沿水平/垂直方向排列（轴向伪影）
 * - Simplex 的图案更「有机」，没有明显的方向偏好
 * - 体素化后差异被部分掩盖（方块本身就是轴对齐的），
 *   但仍能从块状过渡的走向看出区别
 */
const voxelVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const voxelFragmentShader = /* glsl */ `
  uniform float uMode;       // 0 = Perlin 原始，1 = Simplex 原始，2 = Perlin 体素化，3 = Simplex 体素化
  uniform float uNoiseScale; // 噪声空间频率
  uniform float uVoxelSize;  // 体素格边长（体素化模式用）
  uniform float uDepth;      // z 切片位置（缓慢扫描 3D 噪声场）

  varying vec2 vUv;

  ${noise3DUtils}

  void main() {
    /** 把平面 UV 映射到 3D 噪声空间的 (x, y)，z 由 uDepth 提供 */
    vec3 p = vec3(vUv * uNoiseScale, uDepth);

    /**
     * 体素化：把采样坐标吸附到体素格中心
     * 模拟真实体素游戏「每个方块只在自己的中心采样一次」
     * 块内所有像素共享同一次采样结果 → 方块感
     */
    bool voxelize = uMode > 1.5;
    if (voxelize) {
      vec3 cell = floor(p / uVoxelSize);
      p = (cell + 0.5) * uVoxelSize;
    }

    /** 采样 3D 噪声：Perlin 或 Simplex */
    float n;
    bool useSimplex = mod(uMode, 2.0) > 0.5;
    if (useSimplex) {
      n = snoise(p);
    } else {
      n = perlinNoise3D(p);
    }

    /** 归一化到 [0, 1] */
    float v = n * 0.5 + 0.5;

    /** 按阈值分层配色：空气 → 泥土 → 石头 → 高处（模拟体素游戏的材质选择） */
    vec3 color;
    if (v < 0.32) {
      color = vec3(0.08, 0.09, 0.14);  // 空气（深色背景）
    } else if (v < 0.48) {
      color = vec3(0.42, 0.32, 0.18);  // 泥土（棕色）
    } else if (v < 0.68) {
      color = vec3(0.48, 0.48, 0.52);  // 石头（灰色）
    } else {
      color = vec3(0.88, 0.9, 0.94);   // 高处（亮色）
    }

    /**
     * 体素化模式的块边缘高亮：让「方块」的边界更清晰可读
     * 用 fract 检测当前像素在体素格内的位置，接近格边界时加暗
     */
    if (voxelize) {
      vec2 cellCoord = vUv * uNoiseScale / uVoxelSize;
      vec2 cellFrac = abs(fract(cellCoord) - 0.5);
      float edge = step(0.42, max(cellFrac.x, cellFrac.y));
      color = mix(color, color * 0.55, edge * 0.5);
    } else {
      /**
       * 原始模式加一层微弱的网格参考线（噪声空间整数格），
       * 帮助观察 Perlin 的零交叉是否与格线对齐
       */
      vec2 grid = abs(fract(vUv * uNoiseScale) - 0.5);
      float gridLine = 1.0 - step(0.02, min(grid.x, grid.y));
      color = mix(color, vec3(0.6, 0.6, 0.65), gridLine * 0.12);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

/** 创建体素地形面板：竖直平面展示 3D 噪声横截面 */
function createVoxelPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4.2, 4.2)

  const material = new THREE.ShaderMaterial({
    vertexShader: voxelVertexShader,
    fragmentShader: voxelFragmentShader,
    uniforms: {
      uMode: { value: 0 },
      uNoiseScale: { value: 4.0 },
      uVoxelSize: { value: 0.25 },
      uDepth: { value: 0.5 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-4.0, 0.9, -7.0)
  return mesh
}

/* ========== 6. 思考题二：冰面材质（拉近变糊） ========== */

/**
 * 冰面材质 — 法线扰动的噪声频率问题，三种方案对照
 *
 * 场景：用噪声给法线加扰动，制造凹凸不平的冰晶效果
 * 问题：摄像机拉近后凹凸变「糊」——像被磨砂过
 *
 * 病因：噪声频率固定，没有多尺度细节储备
 * - 单频噪声的凹凸有固定特征尺度
 * - 拉近 = 在越来越小的窗口里看同一批坡
 * - 坡被放大、梯度变平缓 → specular 变成大片缓慢渐变 → 「磨砂感」
 *
 * 三种方案：
 * - 单频（错误）：固定频率的 Perlin → 拉近后坡被放大 → 糊
 * - FBM（修复）：多倍频叠加，频率逐级翻倍、幅度逐级衰减
 *   → 不管多近都有更细的起伏
 * - Voronoi 冰晶（推荐）：细胞噪声的晶界天然像冰的裂纹结构
 *   → 锐利感比连续噪声好得多
 *
 * 观察方式：用 OrbitControls 拉近冰面（滚轮缩放），
 * 切换三种模式对比近距离下的细节差异
 */
const iceVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const iceFragmentShader = /* glsl */ `
  uniform float uMode;       // 0 = 单频（错误），1 = FBM（修复），2 = Voronoi 冰晶
  uniform float uNoiseScale; // 噪声基础频率
  uniform float uBumpStrength; // 凹凸强度

  varying vec2 vUv;
  varying vec3 vWorldPos;

  ${noiseUtils}

  /**
   * Voronoi 特征点哈希 — 返回 [0, 1] 的 vec2
   * 每个格子的特征点位置由格子坐标决定（确定性）
   */
  vec2 voronoiHash(vec2 p) {
    return fract(sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
  }

  /**
   * Voronoi 晶界高度 — 冰晶特征层
   * 晶界处值接近 0 → 形成锐利的凹槽，像冰的裂纹
   */
  float voronoiHeight(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float minDist1 = 8.0;
    float minDist2 = 8.0;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = voronoiHash(i + neighbor);
        vec2 diff = neighbor + point - f;
        float dist = dot(diff, diff);

        if (dist < minDist1) {
          minDist2 = minDist1;
          minDist1 = dist;
        } else if (dist < minDist2) {
          minDist2 = dist;
        }
      }
    }

    /** 晶界 = 两个最近距离之差接近 0 的地方 → 凹槽 */
    return sqrt(minDist2) - sqrt(minDist1);
  }

  /**
   * 高度场：根据模式选择噪声方案
   *
   * 关键区别：
   * - 单频：只有一种特征尺度 → 拉近后坡被放大 → 糊
   * - FBM：频率逐级翻倍、幅度逐级衰减 → 多尺度细节储备
   * - Voronoi：晶界本身就是锐利的凹槽 → 近距离有结构感
   */
  float iceHeight(vec2 p) {
    if (uMode < 0.5) {
      /** 错误示范：单一频率，特征尺度固定 */
      return perlinNoise(p) * 0.6;
    } else if (uMode < 1.5) {
      /** 修复：5 层 FBM，频率翻倍、幅度减半 */
      return fbm(p, 5, 2.0, 0.5);
    } else {
      /** 冰晶：Voronoi 晶界做凹槽 + 低频 Perlin 做大起伏 */
      float crystal = voronoiHeight(p * 3.0);
      float base = perlinNoise(p * 0.5) * 0.3;
      return base + (0.5 - crystal) * 0.4;
    }
  }

  void main() {
    vec2 uv = vUv * uNoiseScale;

    /** 有限差分法线：对高度场四邻域采样 */
    float eps = 0.015;
    float hL = iceHeight(uv - vec2(eps, 0.0));
    float hR = iceHeight(uv + vec2(eps, 0.0));
    float hD = iceHeight(uv - vec2(0.0, eps));
    float hU = iceHeight(uv + vec2(0.0, eps));

    vec3 normal = normalize(vec3(
      (hL - hR) * uBumpStrength,
      2.0 * eps,
      (hD - hU) * uBumpStrength
    ));

    /** Blinn-Phong 高光：高 specular power 让凹凸细节清晰可见 */
    vec3 lightDir = normalize(vec3(0.4, 0.9, 0.3));
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(lightDir + viewDir);

    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(normal, halfDir), 0.0), 80.0);

    /** 冰面基色：淡蓝 + 微弱菲涅尔感（简化处理） */
    vec3 baseColor = vec3(0.68, 0.82, 0.92);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);

    vec3 color = baseColor * (0.35 + 0.45 * diffuse);
    color += vec3(0.9, 0.95, 1.0) * specular * 0.8;
    color += baseColor * fresnel * 0.25;

    gl_FragColor = vec4(color, 1.0);
  }
`

/** 创建冰面面板：水平平面（可拉近观察法线扰动的细节差异） */
function createIcePanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4.2, 4.2)
  geometry.rotateX(-Math.PI / 2)

  const material = new THREE.ShaderMaterial({
    vertexShader: iceVertexShader,
    fragmentShader: iceFragmentShader,
    uniforms: {
      uMode: { value: 1 },
      uNoiseScale: { value: 5.0 },
      uBumpStrength: { value: 8.0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(4.0, -0.6, -7.0)
  return mesh
}

/* ========== 7. 初始化场景 ========== */

/**
 * 场景图结构：
 * scene (根节点)
 * ├── cloudPanel    (FBM 云朵面板，左前，竖直平面)
 * ├── grassField    (风吹草地，中央前，InstancedMesh × 2200)
 * ├── terrainPanel  (噪声地形面板，右前，水平细分平面)
 * ├── voxelPanel    (体素地形面板，左后，竖直平面)
 * └── icePanel      (冰面材质面板，右后，水平平面)
 */
function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a0a',
    fov: 50,
  })

  /** 相机略抬高俯视：草地风浪和地形起伏都能看清 */
  manager.camera.position.set(0, 3.2, 12)
  manager.camera.lookAt(0, 0.6, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0.6, 0)

  /**
   * 各案例的相机聚焦点（target + camera 位置）
   *
   * 选中某个案例时相机平滑移动过去，让该案例居中显示（all 回到全景）。
   * - target：案例中心被看向的点
   * - position：相机停靠位置（保持从前方偏上一点斜看，便于观察）
   */
  const focusPoints: Record<string, { target: THREE.Vector3; position: THREE.Vector3 }> = {
    all: {
      target: new THREE.Vector3(0, 0.6, 0),
      position: new THREE.Vector3(0, 3.2, 12),
    },
    grass: {
      target: new THREE.Vector3(0, 0.3, 0),
      position: new THREE.Vector3(0, 1.5, 5.5),
    },
    cloud: {
      target: new THREE.Vector3(-5.6, 1.6, 0),
      position: new THREE.Vector3(-5.6, 3.2, 6.5),
    },
    terrain: {
      target: new THREE.Vector3(5.6, 0.4, 0),
      position: new THREE.Vector3(5.6, 2.8, 6.5),
    },
    voxel: {
      target: new THREE.Vector3(-4.0, 0.9, -7.0),
      position: new THREE.Vector3(-4.0, 2.6, -2.5),
    },
    ice: {
      target: new THREE.Vector3(4.0, 0.1, -7.0),
      position: new THREE.Vector3(4.0, 2.2, -2.8),
    },
  }

  /** 切换案例时平滑移动相机到目标点 */
  const flyTo = (value: string) => {
    const fp = focusPoints[value] ?? focusPoints.all
    gsap.to(controls.target, { x: fp.target.x, y: fp.target.y, z: fp.target.z, duration: 1.0, ease: 'power2.inOut' })
    gsap.to(manager.camera.position, { x: fp.position.x, y: fp.position.y, z: fp.position.z, duration: 1.0, ease: 'power2.inOut', onUpdate: () => controls.update() })
  }

  /* ========== 创建五个案例 ========== */
  const cloudPanel = createCloudPanel()
  const grassField = createGrassField()
  const terrainPanel = createTerrainPanel()
  const voxelPanel = createVoxelPanel()
  const icePanel = createIcePanel()

  manager.scene.add(cloudPanel)
  manager.scene.add(grassField)
  manager.scene.add(terrainPanel)
  manager.scene.add(voxelPanel)
  manager.scene.add(icePanel)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  /** 模式选择器 + 滑块可见性联动（与课程代码同款交互） */
  const updateSliderVisibility = (panelValue: string) => {
    const show = (id: string, visible: boolean) => {
      const el = panel.getControl(id)
      if (el?.parentElement) {
        el.parentElement.style.display = visible ? '' : 'none'
      }
    }

    const isAll = panelValue === 'all'
    show('grass-mode', isAll || panelValue === 'grass')
    show('grass-strength', isAll || panelValue === 'grass')
    show('grass-speed', isAll || panelValue === 'grass')
    show('grass-scale', isAll || panelValue === 'grass')
    show('cloud-mode', isAll || panelValue === 'cloud')
    show('cloud-coverage', isAll || panelValue === 'cloud')
    show('terrain-mode', isAll || panelValue === 'terrain')
    show('terrain-height', isAll || panelValue === 'terrain')
    show('terrain-scale', isAll || panelValue === 'terrain')
    show('voxel-mode', isAll || panelValue === 'voxel')
    show('voxel-scale', isAll || panelValue === 'voxel')
    show('voxel-size', isAll || panelValue === 'voxel')
    show('ice-mode', isAll || panelValue === 'ice')
    show('ice-scale', isAll || panelValue === 'ice')
    show('ice-bump', isAll || panelValue === 'ice')
  }

  /** 案例选择器 */
  panel.addSelect({
    id: 'panel-selector',
    label: '当前案例',
    type: 'select',
    options: [
      { value: 'all', label: '全部' },
      { value: 'grass', label: '风吹草地' },
      { value: 'cloud', label: 'FBM 云朵' },
      { value: 'terrain', label: '噪声地形' },
      { value: 'voxel', label: '体素地形（思考题一）' },
      { value: 'ice', label: '冰面材质（思考题二）' },
    ],
    defaultValue: 'all',
    onChange: (value: string) => {
      cloudPanel.visible = value === 'all' || value === 'cloud'
      grassField.visible = value === 'all' || value === 'grass'
      terrainPanel.visible = value === 'all' || value === 'terrain'
      voxelPanel.visible = value === 'all' || value === 'voxel'
      icePanel.visible = value === 'all' || value === 'ice'
      updateSliderVisibility(value)
      flyTo(value)
    },
  })

  /* ---- 案例一：风吹草地 ---- */
  panel.addSelect({
    id: 'grass-mode',
    label: '草地模式',
    type: 'select',
    options: [
      { value: 'sin', label: 'sin 同频（错误）' },
      { value: 'noise', label: '噪声风场（修复）' },
    ],
    defaultValue: 'noise',
    onChange: (value: string) => {
      const material = grassField.material as THREE.ShaderMaterial
      material.uniforms.uUseNoise.value = value === 'noise' ? 1 : 0
    },
  })

  panel.addSlider({
    id: 'grass-strength',
    label: '风力',
    type: 'slider',
    min: 0,
    max: 0.8,
    step: 0.01,
    defaultValue: 0.35,
    onChange: (value: number) => {
      const material = grassField.material as THREE.ShaderMaterial
      material.uniforms.uWindStrength.value = value
    },
  })

  panel.addSlider({
    id: 'grass-speed',
    label: '风速',
    type: 'slider',
    min: 0.1,
    max: 2.5,
    step: 0.1,
    defaultValue: 0.8,
    onChange: (value: number) => {
      const material = grassField.material as THREE.ShaderMaterial
      material.uniforms.uWindSpeed.value = value
    },
  })

  panel.addSlider({
    id: 'grass-scale',
    label: '风团大小',
    type: 'slider',
    min: 0.1,
    max: 1.5,
    step: 0.05,
    defaultValue: 0.5,
    onChange: (value: number) => {
      const material = grassField.material as THREE.ShaderMaterial
      material.uniforms.uWindScale.value = value
    },
  })

  /* ---- 案例二：FBM 云朵 ---- */
  panel.addSelect({
    id: 'cloud-mode',
    label: '云朵模式',
    type: 'select',
    options: [
      { value: 'bug', label: '均匀灰色（错误）' },
      { value: 'fixed', label: '层次云朵（修复）' },
      { value: 'raw', label: '原始值可视化（调试）' },
    ],
    defaultValue: 'fixed',
    onChange: (value: string) => {
      const material = cloudPanel.material as THREE.ShaderMaterial
      material.uniforms.uMode.value = value === 'bug' ? 0 : value === 'fixed' ? 1 : 2
    },
  })

  panel.addSlider({
    id: 'cloud-coverage',
    label: '云覆盖率',
    type: 'slider',
    min: 0.2,
    max: 0.8,
    step: 0.01,
    defaultValue: 0.5,
    onChange: (value: number) => {
      const material = cloudPanel.material as THREE.ShaderMaterial
      material.uniforms.uCoverage.value = value
    },
  })

  /* ---- 案例三：噪声地形 ---- */
  panel.addSelect({
    id: 'terrain-mode',
    label: '地形模式',
    type: 'select',
    options: [
      { value: 'noise', label: '噪声山脉（修复）' },
      { value: 'random', label: '随机尖刺（错误）' },
      { value: 'flicker', label: '随机逐帧抖动（错误）' },
    ],
    defaultValue: 'noise',
    onChange: (value: string) => {
      const material = terrainPanel.material as THREE.ShaderMaterial
      material.uniforms.uMode.value = value === 'noise' ? 0 : value === 'random' ? 1 : 2
    },
  })

  panel.addSlider({
    id: 'terrain-height',
    label: '山体高度',
    type: 'slider',
    min: 0.2,
    max: 3,
    step: 0.1,
    defaultValue: 1.4,
    onChange: (value: number) => {
      const material = terrainPanel.material as THREE.ShaderMaterial
      material.uniforms.uHeight.value = value
    },
  })

  panel.addSlider({
    id: 'terrain-scale',
    label: '噪声频率',
    type: 'slider',
    min: 0.1,
    max: 1.2,
    step: 0.05,
    defaultValue: 0.45,
    onChange: (value: number) => {
      const material = terrainPanel.material as THREE.ShaderMaterial
      material.uniforms.uNoiseScale.value = value
    },
  })

  /* ---- 思考题一：体素地形 ---- */
  panel.addSelect({
    id: 'voxel-mode',
    label: '体素模式',
    type: 'select',
    options: [
      { value: 'perlin-raw', label: 'Perlin 3D 原始（轴向伪影）' },
      { value: 'simplex-raw', label: 'Simplex 3D 原始（各向同性）' },
      { value: 'perlin-voxel', label: 'Perlin 3D 体素化' },
      { value: 'simplex-voxel', label: 'Simplex 3D 体素化' },
    ],
    defaultValue: 'perlin-raw',
    onChange: (value: string) => {
      const material = voxelPanel.material as THREE.ShaderMaterial
      const modeMap: Record<string, number> = {
        'perlin-raw': 0,
        'simplex-raw': 1,
        'perlin-voxel': 2,
        'simplex-voxel': 3,
      }
      material.uniforms.uMode.value = modeMap[value] ?? 0
    },
  })

  panel.addSlider({
    id: 'voxel-scale',
    label: '噪声频率',
    type: 'slider',
    min: 1.0,
    max: 8.0,
    step: 0.5,
    defaultValue: 4.0,
    onChange: (value: number) => {
      const material = voxelPanel.material as THREE.ShaderMaterial
      material.uniforms.uNoiseScale.value = value
    },
  })

  panel.addSlider({
    id: 'voxel-size',
    label: '体素格大小',
    type: 'slider',
    min: 0.1,
    max: 0.5,
    step: 0.05,
    defaultValue: 0.25,
    onChange: (value: number) => {
      const material = voxelPanel.material as THREE.ShaderMaterial
      material.uniforms.uVoxelSize.value = value
    },
  })

  /* ---- 思考题二：冰面材质 ---- */
  panel.addSelect({
    id: 'ice-mode',
    label: '冰面模式',
    type: 'select',
    options: [
      { value: 'single', label: '单频噪声（错误：拉近变糊）' },
      { value: 'fbm', label: 'FBM 多倍频（修复）' },
      { value: 'voronoi', label: 'Voronoi 冰晶（推荐）' },
    ],
    defaultValue: 'fbm',
    onChange: (value: string) => {
      const material = icePanel.material as THREE.ShaderMaterial
      material.uniforms.uMode.value = value === 'single' ? 0 : value === 'fbm' ? 1 : 2
    },
  })

  panel.addSlider({
    id: 'ice-scale',
    label: '噪声频率',
    type: 'slider',
    min: 1.0,
    max: 12.0,
    step: 0.5,
    defaultValue: 5.0,
    onChange: (value: number) => {
      const material = icePanel.material as THREE.ShaderMaterial
      material.uniforms.uNoiseScale.value = value
    },
  })

  panel.addSlider({
    id: 'ice-bump',
    label: '凹凸强度',
    type: 'slider',
    min: 1.0,
    max: 20.0,
    step: 0.5,
    defaultValue: 8.0,
    onChange: (value: number) => {
      const material = icePanel.material as THREE.ShaderMaterial
      material.uniforms.uBumpStrength.value = value
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

  updateSliderVisibility('all')

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)

    const elapsedTime = clock.getElapsedTime() * animationSpeed

    const grassMaterial = grassField.material as THREE.ShaderMaterial
    grassMaterial.uniforms.uTime.value = elapsedTime

    const cloudMaterial = cloudPanel.material as THREE.ShaderMaterial
    cloudMaterial.uniforms.uTime.value = elapsedTime

    const terrainMaterial = terrainPanel.material as THREE.ShaderMaterial
    terrainMaterial.uniforms.uTime.value = elapsedTime

    /**
     * 体素地形：缓慢扫描 3D 噪声场的 z 轴切片
     * 效果像「CT 扫描」逐层剖开体素世界，展示 3D 噪声内部结构
     */
    const voxelMaterial = voxelPanel.material as THREE.ShaderMaterial
    voxelMaterial.uniforms.uDepth.value = 0.5 + Math.sin(elapsedTime * 0.15) * 1.2

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }

  animate()
}

/* ========== 启动 ========== */
init()
