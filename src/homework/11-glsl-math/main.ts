/**
 * 第 11 课课后作业：GLSL 数学函数
 *
 * 作业目标：
 * 1. 用 mix/step/smoothstep/length 实现径向渐变
 * 2. 用 fract 实现 5×5 网格重复并绘制圆形
 * 3. 用 atan/length 做极坐标，用 sin 实现 8 条光束的太阳光芒
 * 4. 用 dot(normal, viewDir) 反相实现 Fresnel 边缘发光
 *
 * 效果展示（三个 ShaderMaterial 面板 + 一个球体）：
 * 1. 径向渐变：中心白色 → 边缘黑色
 * 2. 网格圆点：5×5 重复网格，每个格子内部一个圆形
 * 3. 太阳光芒：从中心向外发出 8 条均匀光束（极坐标）
 * 4. Fresnel 边缘发光：球体正面暗、边缘亮（dot 反相）
 *
 * 运行方式：在 main.ts 中把 MODE 改为 'homework' 后运行
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ========== 1. 径向渐变 — length + smoothstep + mix ========== */

/**
 * 顶点着色器（三个面板完全一致）：透传 UV，计算裁剪空间位置
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * 径向渐变：中心白色 → 边缘黑色
 *
 * 核心：length(vUv - 0.5) 计算像素到 UV 中心 (0.5, 0.5) 的距离
 * - 中心距离 = 0 → 白
 * - 到角的最大距离 = √2/2 ≈ 0.7071 → 黑
 */
const radialGradientFragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    /**
     * 到 UV 中心的距离：
     * vUv - 0.5 把原点从 (0,0) 平移到中心 (0.5,0.5)
     * length() 求向量长度，得到像素到中心的欧几里得距离
     */
    float dist = length(vUv - 0.5);

    /**
     * 最大距离 0.7071（正方形一个角到中心）
     * smoothstep(0.0, 0.7071, dist) 把距离平滑映射到 [0, 1]
     * dist=0 → 0（白），dist=0.7071 → 1（黑）
     */
    float t = smoothstep(0.0, 0.7071, dist);

    /**
     * 让白晕随时间轻微呼吸扩展，增加动感
     * 以 0.4 为中心，±0.1 波段（掩码只在 t 内生效，由 smoothstep 区间控制）
     */
    float radius = 0.6 + sin(uTime * 0.8) * 0.15;
    radius = clamp(radius, 0.1, 0.8);
    float t2 = smoothstep(0.0, radius, dist);

    /** mix 白 → 黑，系数越大越黑 */
    vec3 white = vec3(1.0);
    vec3 black = vec3(0.0);
    vec3 color = mix(white, black, t2);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 2. 网格圆点 — fract ========== */

/**
 * 5×5 网格重复，每个格子内部画一个圆形
 *
 * 核心：fract(uv * 5.0) 把 UV 放大 5 倍后取小数部分
 * - uv * 5.0：坐标范围 [0, 1] → [0, 5]
 * - fract()：取小数部分，每个整数区间都卷回 [0, 1]
 * - 结果：得到 5×5 个彼此独立的局部坐标，每个格子都能独立画形状
 */
const gridCirclesFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uGridSize;

  varying vec2 vUv;

  void main() {
    /**
     * 网格局部坐标：
     * fract(uv * grid) 产生 grid×grid 的重复格子，
     * 每个格子内部坐标都是 [0, 1]
     */
    vec2 gridUV = fract(vUv * uGridSize);

    /**
     * 到格子中心的距离：
     * 圆心在格子内部中心 (0.5, 0.5)
     * 半径 0.3（< 0.5，圆不会贴边被切）
     */
    float dist = distance(gridUV, vec2(0.5));

    /** 柔边圆：smoothstep(半径, 半径-柔和度, 距离) */
    float circle = smoothstep(0.32, 0.28, dist);

    /**
     * 颜色渐变：格子的局部 y 坐标决定色相，让圆点有垂直渐变
     */
    vec3 color = vec3(0.12);
    color += vec3(0.5, 0.8, 1.0) * circle;
    /** 加点点时间变化，让圆点轻微明暗呼吸 */
    color *= (0.85 + 0.15 * sin(uTime * 2.0));

    /** 网格线（可选）：格子在上下边缘处勾一道浅色，便于看清 5×5 结构 */
    float gridLine = step(0.97, gridUV.x) + step(0.97, gridUV.y);
    color = max(color, vec3(0.35) * gridLine);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 3. 太阳光芒 — 极坐标 + sin ========== */

/**
 * 8 条均匀光束的太阳光芒
 *
 * 核心：
 * 1. p = vUv - 0.5 平移到中心
 * 2. 极坐标：angle = atan(p.y, p.x) 求方向角，radius = length(p) 求到中心距离
 * 3. sin(angle * 8.0)：角度每转一圈振荡 8 次，产生 8 段交替正负瓣
 *    max(0.0, ...) 只取正瓣 → 恰好 8 条光束
 * 4. pow(·, 指数) 把柔和波峰压成尖锐光束
 */
const sunRaysFragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    /** 1. 平移到中心，得到以 (0,0) 为中心的相对坐标 */
    vec2 p = vUv - 0.5;

    /** 2. 转极坐标：角度 + 径向距离 */
    float angle = atan(p.y, p.x); // 方向角，范围 [-π, π]
    float radius = length(p);     // 到中心距离

    /** 3. 8 条光束：sin(角度 × 8) 产生 8 段正负瓣，取正瓣 */
    float rays = max(0.0, sin(angle * 8.0 + uTime * 0.5));

    /** 幂次放大：把柔和正弦压成锐利光束（指数越大越窄越亮） */
    rays = pow(rays, 20.0);

    /** 4. 径向衰减：半径越大光束越暗，避免延伸到整屏 */
    float fade = 1.0 - smoothstep(0.1, 0.5, radius);

    /** 5. 组合：光芒暖黄，底色深暗，叠加强弱 */
    vec3 sun = vec3(1.0, 0.85, 0.4);
    vec3 base = vec3(0.04, 0.03, 0.08);
    vec3 color = mix(base, sun, rays * fade);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 4. Fresnel 边缘发光 — dot + 反相 ========== */

/**
 * Fresnel 边缘发光
 *
 * 核心：dot(normal, viewDir) 衡量"视线正对表面的程度"
 * - 正面看：夹角 0° → dot = 1
 * - 边缘看：夹角 90° → dot ≈ 0
 *
 * 我们想要"边缘亮、正面暗"，与 dot 的分布相反，
 * 所以用 1.0 - dot 反转成正对的"斜对程度"：
 * - 正面 dot=1 → 1-dot=0 → 暗
 * - 边缘 dot≈0 → 1-dot≈1 → 亮
 *
 * 顶点着色器比面板多算两样东西：
 * - vWorldNormal：世界空间法线（normalMatrix 处理模型旋转/缩放）
 * - vWorldPosition：世界空间位置（modelMatrix 变换）
 */
const fresnelVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    /** 世界空间法线：normalMatrix 是模型矩阵的逆转置，保证旋转/缩放下法线仍垂直表面 */
    vWorldNormal = normalize(normalMatrix * normal);

    /** 世界空间位置：拼接模型变换后得到片元的世界坐标 */
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fresnelFragmentShader = /* glsl */ `
  uniform vec3 uEdgeColor;
  uniform vec3 uBaseColor;
  uniform float uPower;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    /** 视线方向：从片元指向相机（内置 uniform cameraPosition 是世界坐标相机位置） */
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    /** 反相 dot：0（正面）→ 1（边缘），再夹到 [0,1] 防背面负值 */
    float fresnel = 1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0);

    /** 幂次加权：让边缘发光的衰减更锐利、更集中在轮廓处 */
    fresnel = pow(fresnel, uPower);

    /** mix 底色 → 边缘色，越靠边缘越亮 */
    vec3 color = mix(uBaseColor, uEdgeColor, fresnel);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 5. 创建 ShaderMaterial 面板 ========== */

function createRadialGradientPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: radialGradientFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(-5, 2.5, 0)
  return mesh
}

function createGridCirclesPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: gridCirclesFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uGridSize: { value: 5.0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, 2.5, 0)
  return mesh
}

function createSunRaysPanel(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4, 4)
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: sunRaysFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(5, 2.5, 0)
  return mesh
}

/**
 * Fresnel 边缘发光球体
 *
 * 用球体而非平面，是因为 Fresnel 需要"视线与表面法线的夹角"，
 * 球体表面法线朝四面八方，正面（朝向相机）和边缘（切线方向）
 * 的 dot 差异显著，能清晰看到明暗边缘效果。
 * - SphereGeometry(1.8) 半径 1.8，与 4×4 面板视觉大小接近
 * - 放在 x = 8，与前面面板错开，便于单独观察
 * - 无 uTime，Fresnel 静态依赖视角；变换视角时 OrbitControls 驱动
 */
function createFresnelSphere(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.8, 64, 64)
  const material = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
      uEdgeColor: { value: new THREE.Color(0x66ccff) }, // 边缘亮青色
      uBaseColor: { value: new THREE.Color(0x111122) }, // 正面暗蓝
      uPower: { value: 2.0 },
    },
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, -2.5, 0)
  return mesh
}

/* ========== 5. 初始化场景 ========== */

function init() {
  const canvas = document.getElementById('homework_canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#0a0a0a',
    fov: 50,
  })

  /** 相机视线覆盖三个面板 + Fresnel 球体（x = 8） */
  manager.camera.position.set(0, 0, 14)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
  manager.scene.add(ambientLight)

  /* ========== 创建三个面板 ========== */
  const radialPanel = createRadialGradientPanel()
  const gridPanel = createGridCirclesPanel()
  const sunPanel = createSunRaysPanel()
  const fresnelSphere = createFresnelSphere()

  manager.scene.add(radialPanel)
  manager.scene.add(gridPanel)
  manager.scene.add(sunPanel)
  manager.scene.add(fresnelSphere)

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  /** 面板选择器：切换显示哪一个效果 */
  panel.addSelect({
    id: 'panel-selector',
    label: '当前面板',
    type: 'select',
    options: [
      { value: 'all', label: '全部' },
      { value: 'radial', label: '径向渐变' },
      { value: 'grid', label: '网格圆点' },
      { value: 'sun', label: '太阳光芒' },
      { value: 'fresnel', label: 'Fresnel 边缘发光' },
    ],
    defaultValue: 'all',
    onChange: (value: string) => {
      /** 并排位置（全部模式） */
      const rowPositions = {
        radial: [-5, 2.5, 0] as [number, number, number],
        grid: [0, 2.5, 0] as [number, number, number],
        sun: [5, 2.5, 0] as [number, number, number],
        fresnel: [0, -2.5, 0] as [number, number, number],
      }

      if (value === 'all') {
        /** 全部：恢复并排位置，全部显示 */
        radialPanel.visible = true
        radialPanel.position.set(...rowPositions.radial)
        gridPanel.visible = true
        gridPanel.position.set(...rowPositions.grid)
        sunPanel.visible = true
        sunPanel.position.set(...rowPositions.sun)
        fresnelSphere.visible = true
        fresnelSphere.position.set(...rowPositions.fresnel)
      } else {
        /** 单个：选中的居中 (0,0,0)，其他隐藏 */
        radialPanel.visible = value === 'radial'
        radialPanel.position.set(0, 0, 0)
        gridPanel.visible = value === 'grid'
        gridPanel.position.set(0, 0, 0)
        sunPanel.visible = value === 'sun'
        sunPanel.position.set(0, 0, 0)
        fresnelSphere.visible = value === 'fresnel'
        fresnelSphere.position.set(0, 0, 0)
      }
    },
  })

  /** 网格密度滑块（仅网格面板） */
  panel.addSlider({
    id: 'grid-size',
    label: '网格大小',
    type: 'slider',
    min: 2,
    max: 20,
    step: 1,
    defaultValue: 5,
    onChange: (value: number) => {
      const material = gridPanel.material as THREE.ShaderMaterial
      material.uniforms.uGridSize.value = value
    },
  })

  /** 动画速度滑块 */
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

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)

    const elapsedTime = clock.getElapsedTime() * animationSpeed

    const radialMaterial = radialPanel.material as THREE.ShaderMaterial
    radialMaterial.uniforms.uTime.value = elapsedTime

    const gridMaterial = gridPanel.material as THREE.ShaderMaterial
    gridMaterial.uniforms.uTime.value = elapsedTime

    const sunMaterial = sunPanel.material as THREE.ShaderMaterial
    sunMaterial.uniforms.uTime.value = elapsedTime

    /** Fresnel 球体自转：让不同区域依次朝向相机，展示边缘发光随视角的变化 */
    fresnelSphere.rotation.y = elapsedTime * 0.6

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }

  animate()
}

/* ========== 启动 ========== */
init()