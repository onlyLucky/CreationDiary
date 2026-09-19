/**
 * 第 16 课：Ray Marching & SDF
 *
 * 学习目标：
 * 1. 理解 SDF（有符号距离场）的概念
 * 2. 掌握 Ray Marching 的基本原理
 * 3. 学会 SDF 基本形状（球、盒、圆环）
 * 4. 理解 SDF 布尔运算（并集、交集、差集）
 *
 * 本节概览：
 * - 一个全屏 ShaderMaterial 面板
 * - 用纯 shader 实现 3D 场景渲染（不使用 Three.js 几何体）
 * - 展示 SDF 形状组合 + 布尔运算（四种形态面板切换）+ 光照 + 阴影 + AO
 *
 * 核心思路：
 * - SDF = 到最近表面的距离（正=外部，负=内部，零=表面上）
 * - Ray Marching = 从相机发射光线，每次步进 SDF 距离
 * - 当步进距离 < epsilon 时，认为光线"击中"了表面
 * - 布尔运算只是对两个 SDF 值做 min/max：并集 min、交集 max、差集 max(-a, b)
 *   （负值 = 在内部 → min 只要有一个在内部就在并集内部；
 *    max 要求两个都在内部 → 交集；-a 把挖具内外翻转 → 从 b 里挖掉 a）
 *
 * 参考案例：
 * - Inigo Quilez — SDF 函数大全（https://iquilezles.org/articles/distfunctions/）
 * - Shadertoy — Ray Marching 教程
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用控制面板调整场景参数
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'

/* ========== Ray Marching Fragment Shader ========== */

const rayMarchFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uSphereRadius;
  uniform float uBoxSize;
  uniform float uSmoothFactor;
  uniform float uShapeMode;   // 形态模式：0 并集 / 1 平滑并集 / 2 交集 / 3 差集

  /**
   * SDF 基本形状
   *
   * sdSphere：球体 SDF — 到球心的距离减去半径
   * sdBox：盒子 SDF — Inigo Quilez 的经典公式
   * sdTorus：圆环 SDF
   */
  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }

  float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }

  /**
   * SDF 布尔运算
   *
   * opUnion：并集（取最小值）
   * opIntersection：交集（取最大值）
   * opSubtraction：差集（A 减 B）
   * opSmoothUnion：平滑并集（smin，让交界处圆滑过渡）
   */
  float opUnion(float d1, float d2) {
    return min(d1, d2);
  }

  float opIntersection(float d1, float d2) {
    return max(d1, d2);
  }

  float opSubtraction(float d1, float d2) {
    return max(-d1, d2);
  }

  float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
  }

  /**
   * 场景 SDF — 定义整个 3D 场景
   *
   * 由多个基本形状通过布尔运算组合而成
   * 返回值 = 到最近表面的距离
   */
  float map(vec3 p) {
    /** 盒子：随时间旋转（rotP 是盒子的局部坐标，交集/差集时挖具球也定义在这个空间里） */
    vec3 rotP = p - vec3(2.5, 0.0, 0.0);
    float c = cos(uTime * 0.5), s = sin(uTime * 0.5);
    rotP.xz = mat2(c, -s, s, c) * rotP.xz;
    float box = sdBox(rotP, vec3(uBoxSize));

    /**
     * 球：位置随布尔模式变化
     * - 并集/平滑并集（0/1）：球独立在左侧浮动（uSphereRadius 控制大小），与盒子分离，
     *   用来观察两物体「拼接」与「平滑融合」的效果
     * - 交集/差集（2/3）：挖具球定义在盒子局部空间（跟随旋转）、半径取盒半边长的
     *   0.6 倍并嵌在盒面上——布尔运算必须有两形状重叠的部分，否则交集是空集
     *   （max 结果处处为正，物体直接消失）；此时 uSphereRadius 只影响并集模式的独立球
     */
    float sphere;
    if (uShapeMode < 1.5) {
      sphere = sdSphere(p - vec3(0.0, sin(uTime) * 0.3, 0.0), uSphereRadius);
    } else {
      sphere = sdSphere(rotP - vec3(uBoxSize * 0.8, 0.0, 0.0), uBoxSize * 0.6);
    }

    /**
     * 四种布尔运算对照（面板切换 uShapeMode）：
     * 0 并集 opUnion(min)：两个物体硬拼接
     * 1 平滑并集 opSmoothUnion：交界处圆滑过渡（smin，默认模式）
     * 2 交集 opIntersection(max)：只留球与盒重叠的部分（透镜状嵌块）
     * 3 差集 opSubtraction(max(-a,b))：从盒子（第二个参数）里挖掉球（第一个参数）
     */
    float body;
    if (uShapeMode < 0.5) {
      body = opUnion(sphere, box);
    } else if (uShapeMode < 1.5) {
      body = opSmoothUnion(sphere, box, uSmoothFactor);
    } else if (uShapeMode < 2.5) {
      body = opIntersection(sphere, box);
    } else {
      body = opSubtraction(sphere, box);
    }

    /** 圆环：固定位置，始终以普通并集加入场景 */
    float torus = sdTorus(p - vec3(-2.5, 0.0, 0.0), vec2(0.8, 0.25));
    float result = opUnion(body, torus);

    /** 地面平面 */
    float ground = p.y + 1.5;
    result = opUnion(result, ground);

    return result;
  }

  /**
   * 计算法线
   *
   * 原理：在击中点附近采样 4 次 SDF，用有限差分法算梯度
   * 梯度方向 = 法线方向
   */
  vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      map(p + e.xyy) - map(p - e.xyy),
      map(p + e.yxy) - map(p - e.yxy),
      map(p + e.yyx) - map(p - e.yyx)
    ));
  }

  /**
   * Ray Marching 主循环
   *
   * 从相机位置沿光线方向步进：
   * 1. 计算当前位置到最近表面的距离 d
   * 2. 如果 d < epsilon → 击中，返回总距离
   * 3. 如果总距离 > maxDist → 未击中（背景）
   * 4. 否则前进步进 d 的距离
   */
  float rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
      vec3 p = ro + rd * t;
      float d = map(p);
      if (d < 0.001) break;
      t += d;
      if (t > 50.0) break;
    }
    return t;
  }

  /**
   * 软阴影（Inigo Quilez 方法）
   *
   * 从击中点向光源方向步进，检查是否被遮挡
   * k 控制阴影的柔和程度
   */
  float softShadow(vec3 ro, vec3 rd, float k) {
    float res = 1.0;
    float t = 0.02;
    for (int i = 0; i < 32; i++) {
      float d = map(ro + rd * t);
      if (d < 0.001) return 0.0;
      res = min(res, k * d / t);
      t += d;
      if (t > 20.0) break;
    }
    return clamp(res, 0.0, 1.0);
  }

  /**
   * 环境光遮蔽（AO）
   *
   * 近似：在击中点附近采样几次 SDF
   * 距离越近 → 被遮挡越多 → AO 越暗
   */
  float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float weight = 1.0;
    for (int i = 0; i < 5; i++) {
      float d = float(i) * 0.15;
      occ += (d - map(p + n * d)) * weight;
      weight *= 0.5;
    }
    return 1.0 - clamp(occ * 2.0, 0.0, 1.0);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

    /** 相机设置 */
    vec3 ro = vec3(0.0, 1.0, 5.0);
    vec3 rd = normalize(vec3(uv, -1.5));

    /** Ray March */
    float t = rayMarch(ro, rd);

    vec3 color = vec3(0.05, 0.05, 0.1);

    if (t < 50.0) {
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p);

      /** 光照 */
      vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
      float diff = max(dot(n, lightDir), 0.0);
      float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);

      /** 阴影和 AO */
      float shadow = softShadow(p + n * 0.01, lightDir, 8.0);
      float ao = calcAO(p, n);

      /** 材质颜色 */
      vec3 matColor = vec3(0.6, 0.4, 0.3);
      if (p.y < -1.4) matColor = vec3(0.3, 0.3, 0.35);

      /** 合成 */
      color = matColor * (0.1 * ao + diff * shadow * 0.8) + spec * shadow * 0.3;
      /** 雾效 */
      color = mix(color, vec3(0.05, 0.05, 0.1), 1.0 - exp(-0.02 * t * t));
    }

    /** Gamma 校正 */
    color = pow(color, vec3(0.4545));

    gl_FragColor = vec4(color, 1.0);
  }
`

/**
 * 顶点着色器 — 全屏三角形
 *
 * 这是全屏 shader 的经典写法：
 * - 传入的 PlaneGeometry(2, 2) 顶点坐标恰好覆盖整个裁剪空间（[-1, 1]）
 * - 直接输出 gl_Position = vec4(position, 1.0)，不做任何矩阵变换
 * - 于是三角形铺满整个屏幕，片元着色器对每个像素执行一次
 */
const rayMarchVertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`

/* ========== 初始化场景 ========== */

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#000000', fov: 50 })

  /** 全屏 ShaderMaterial 面板 */
  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    vertexShader: rayMarchVertexShader,
    fragmentShader: rayMarchFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uSphereRadius: { value: 1.0 },
      uBoxSize: { value: 0.6 },
      uSmoothFactor: { value: 0.5 },
      uShapeMode: { value: 1.0 },
    },
  })

  const quad = new THREE.Mesh(geometry, material)
  manager.scene.add(quad)

  /** 禁用 OrbitControls（全屏 shader 不需要） */
  manager.camera.position.set(0, 0, 0)

  /** 窗口自适应 */
  window.addEventListener('resize', () => {
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
  })

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  /** 场景参数：实时修改 shader uniform，Ray March 结果随之变化 */

  /** 布尔运算形态切换：观察同一个球 + 盒在四种 op 下的形状差异 */
  panel.addSelect({ id: 'shape-mode', label: '布尔运算形态', type: 'select',
    options: [
      { value: '0', label: '并集 min（硬拼接）' },
      { value: '1', label: '平滑并集（圆滑过渡）' },
      { value: '2', label: '交集 max（只留重叠）' },
      { value: '3', label: '差集 max(-a,b)（球挖盒）' },
    ],
    defaultValue: '1',
    onChange: (v: string) => { material.uniforms.uShapeMode.value = parseFloat(v) } })

  panel.addSlider({ id: 'sphere-radius', label: '球体半径', type: 'slider', min: 0.3, max: 2, step: 0.05, defaultValue: 1.0,
    onChange: (v: number) => { material.uniforms.uSphereRadius.value = v } })
  panel.addSlider({ id: 'box-size', label: '盒子大小', type: 'slider', min: 0.2, max: 1.5, step: 0.05, defaultValue: 0.6,
    onChange: (v: number) => { material.uniforms.uBoxSize.value = v } })
  panel.addSlider({ id: 'smooth-factor', label: '平滑系数', type: 'slider', min: 0, max: 2, step: 0.05, defaultValue: 0.5,
    onChange: (v: number) => { material.uniforms.uSmoothFactor.value = v } })

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    /** 每帧更新时间 uniform（驱动球体浮动、盒子旋转等动画） */
    material.uniforms.uTime.value = clock.getElapsedTime()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
