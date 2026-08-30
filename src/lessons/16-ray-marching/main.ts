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
 * - 展示 SDF 形状组合 + 光照 + 阴影 + AO
 *
 * 核心思路：
 * - SDF = 到最近表面的距离（正=外部，负=内部，零=表面上）
 * - Ray Marching = 从相机发射光线，每次步进 SDF 距离
 * - 当步进距离 < epsilon 时，认为光线"击中"了表面
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
    /** 球体：随时间上下浮动 */
    float sphere = sdSphere(p - vec3(0.0, sin(uTime) * 0.3, 0.0), uSphereRadius);

    /** 盒子：随时间旋转 */
    vec3 rotP = p - vec3(2.5, 0.0, 0.0);
    float c = cos(uTime * 0.5), s = sin(uTime * 0.5);
    rotP.xz = mat2(c, -s, s, c) * rotP.xz;
    float box = sdBox(rotP, vec3(uBoxSize));

    /** 圆环：固定位置 */
    float torus = sdTorus(p - vec3(-2.5, 0.0, 0.0), vec2(0.8, 0.25));

    /** 平滑并集：球和盒子之间平滑过渡 */
    float result = opSmoothUnion(sphere, box, uSmoothFactor);

    /** 再和圆环做并集 */
    result = opUnion(result, torus);

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
    material.uniforms.uTime.value = clock.getElapsedTime()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
