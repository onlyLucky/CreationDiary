/**
 * 第 14 课：后处理效果
 *
 * 学习目标：
 * 1. 理解 EffectComposer 的工作原理（多 Pass 链式处理）
 * 2. 掌握 RenderPass / ShaderPass / UnrealBloomPass
 * 3. 学会配置 Bloom（辉光）效果的参数调优
 * 4. 理解自定义后处理 Pass 的编写方法
 *
 * 本节概览（一个 3D 场景 + 后处理链）：
 * - 场景：多个发光球体 + 网格地面
 * - 后处理：Bloom 辉光 + 色彩校正 + Vignette 暗角
 * - 控制面板：可调 Bloom 阈值/强度/半径、Vignette 强度
 *
 * 核心思路：
 * - EffectComposer 把渲染结果像"滤镜链"一样逐个处理
 * - RenderPass：渲染 3D 场景到帧缓冲
 * - UnrealBloomPass：提取高亮区域做高斯模糊叠加
 * - ShaderPass：自定义片元着色器做色彩校正/Vignette
 *
 * 参考案例：
 * - Three.js Examples — webgl_postprocessing_unreal_bloom
 * - Three.js Examples — webgl_postprocessing_dof
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 使用控制面板调整后处理参数
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/* ========== 1. Vignette Shader ========== */

/**
 * Vignette（暗角）效果
 *
 * 原理：
 * - 计算每个像素到画面中心的距离
 * - 距离越远，乘以越暗的系数
 * - 形成"中间亮、四周暗"的效果
 */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.4 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      /** 到中心的距离（归一化） */
      float dist = distance(vUv, vec2(0.5));
      /** smoothstep 让暗角从中心向外渐变 */
      float vignette = smoothstep(0.8, 0.3, dist * uIntensity * 2.0);
      color.rgb *= vignette;
      gl_FragColor = color;
    }
  `,
}

/* ========== 2. Color Correction Shader ========== */

/**
 * 色彩校正 Shader
 *
 * 调整亮度、对比度、饱和度
 * - brightness：加减常数
 * - contrast：围绕 0.5 缩放
 * - saturation：基于亮度的灰度混合
 */
const ColorCorrectionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uBrightness: { value: 0.0 },
    uContrast: { value: 1.0 },
    uSaturation: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uBrightness;
    uniform float uContrast;
    uniform float uSaturation;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      /** 亮度 */
      color.rgb += uBrightness;

      /** 对比度：围绕 0.5 缩放 */
      color.rgb = (color.rgb - 0.5) * uContrast + 0.5;

      /** 饱和度：基于亮度的灰度混合 */
      float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luminance), color.rgb, uSaturation);

      gl_FragColor = color;
    }
  `,
}

/* ========== 3. 初始化场景 ========== */

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#000000', fov: 60 })

  manager.camera.position.set(0, 3, 10)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true

  /* ========== 场景物体 ========== */
  /** 网格地面 */
  const gridHelper = new THREE.GridHelper(20, 20, 0x333333, 0x222222)
  manager.scene.add(gridHelper)

  /** 发光球体 */
  const emissiveMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xff6600,
    emissiveIntensity: 2.0,
  })

  const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32)
  const positions = [
    [-3, 1, 0], [0, 1.5, 0], [3, 1, 0],
    [-1.5, 0.8, 2], [1.5, 0.8, -2],
  ]

  positions.forEach(([x, y, z]) => {
    const sphere = new THREE.Mesh(sphereGeo, emissiveMaterial.clone())
    sphere.position.set(x, y, z)
    const hue = (x + 3) / 6
    sphere.material.emissive.setHSL(hue, 1.0, 0.5)
    sphere.material.emissiveIntensity = 2.0
    manager.scene.add(sphere)
  })

  /** 灯光 */
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
  manager.scene.add(ambientLight)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(5, 10, 5)
  manager.scene.add(directionalLight)

  /* ========== 后处理链 ========== */
  const composer = new EffectComposer(manager.renderer)

  /** Pass 1：渲染 3D 场景 */
  const renderPass = new RenderPass(manager.scene, manager.camera)
  composer.addPass(renderPass)

  /** Pass 2：Bloom 辉光 */
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,  /** strength */
    0.4,  /** radius */
    0.85  /** threshold */
  )
  composer.addPass(bloomPass)

  /** Pass 3：色彩校正 */
  const colorPass = new ShaderPass(ColorCorrectionShader)
  composer.addPass(colorPass)

  /** Pass 4：Vignette 暗角 */
  const vignettePass = new ShaderPass(VignetteShader)
  composer.addPass(vignettePass)

  /** 窗口自适应 */
  window.addEventListener('resize', () => {
    composer.setSize(window.innerWidth, window.innerHeight)
  })

  /* ========== 控制面板 ========== */
  const panel = new ControlPanel('controls')

  panel.addSlider({ id: 'bloom-strength', label: 'Bloom 强度', type: 'slider', min: 0, max: 3, step: 0.05, defaultValue: 1.5,
    onChange: (v: number) => { bloomPass.strength = v } })
  panel.addSlider({ id: 'bloom-radius', label: 'Bloom 半径', type: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0.4,
    onChange: (v: number) => { bloomPass.radius = v } })
  panel.addSlider({ id: 'bloom-threshold', label: 'Bloom 阈值', type: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0.85,
    onChange: (v: number) => { bloomPass.threshold = v } })
  panel.addSlider({ id: 'brightness', label: '亮度', type: 'slider', min: -0.5, max: 0.5, step: 0.01, defaultValue: 0,
    onChange: (v: number) => { colorPass.uniforms.uBrightness.value = v } })
  panel.addSlider({ id: 'contrast', label: '对比度', type: 'slider', min: 0.5, max: 2, step: 0.05, defaultValue: 1.0,
    onChange: (v: number) => { colorPass.uniforms.uContrast.value = v } })
  panel.addSlider({ id: 'saturation', label: '饱和度', type: 'slider', min: 0, max: 2, step: 0.05, defaultValue: 1.0,
    onChange: (v: number) => { colorPass.uniforms.uSaturation.value = v } })
  panel.addSlider({ id: 'vignette', label: '暗角强度', type: 'slider', min: 0, max: 2, step: 0.05, defaultValue: 0.4,
    onChange: (v: number) => { vignettePass.uniforms.uIntensity.value = v } })

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    const t = clock.getElapsedTime()

    /** 球体浮动动画 */
    manager.scene.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        child.position.y = positions[i]?.[1] ?? 1 + Math.sin(t * 2 + i) * 0.3
      }
    })

    controls.update()
    composer.render()
  }

  animate()
}

init()
