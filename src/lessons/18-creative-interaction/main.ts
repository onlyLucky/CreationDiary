/**
 * 第 18 课：创意交互
 *
 * 学习目标：
 * 1. 掌握 Raycaster 鼠标拾取
 * 2. 学会鼠标跟随效果（cursor-driven）
 * 3. 理解涟漪/扭曲交互效果
 * 4. 了解物理引擎基础概念
 *
 * 本节概览（交互式 3D 场景）：
 * - 鼠标移动 → 相机/物体跟随鼠标
 * - 点击物体 → 涟漪扩散效果
 * - 物体间有简单的物理弹力
 *
 * 核心思路：
 * - Raycaster 从相机向鼠标位置发射射线，检测交叉物体
 * - 鼠标坐标归一化到 [-1, 1]
 * - lerp 平滑跟随避免抖动
 *
 * 参考案例：
 * - Three.js Examples — webgl_raycast
 * - Awwwards 获奖网站的鼠标交互
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 移动鼠标观察交互效果
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ========== 涟漪 Shader ========== */

const rippleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uRippleTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vRipple;

  void main() {
    vec3 pos = position;

    /**
     * 涟漪效果
     * - 计算顶点到鼠标位置的距离
     * - 用 sin 生成环形波纹
     * - 波纹随时间向外扩散并衰减
     */
    float dist = distance(uv, uMouse);
    float age = uTime - uRippleTime;
    float ripple = sin(dist * 30.0 - age * 8.0) * exp(-age * 3.0) * exp(-dist * 5.0);
    pos.z += ripple * 0.5;

    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vRipple = ripple;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const rippleFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uHover;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vRipple;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);

    /** 基础颜色 + 高亮 */
    vec3 color = uColor * (0.3 + diffuse * 0.7);

    /** 涟漪高亮 */
    color += vec3(0.2, 0.5, 1.0) * abs(vRipple) * 2.0;

    /** hover 高亮 */
    color += vec3(0.15) * uHover;

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ========== 初始化场景 ========== */

/**
 * 初始化场景
 *
 * 场景结构：
 * scene (根节点)
 * ├── ambientLight  (环境光)
 * └── 5 个交互平面  (PlaneGeometry + ShaderMaterial，带涟漪/hover 效果)
 *
 * 交互流程：
 * - mousemove：把鼠标坐标归一化到 [-1, 1]，Raycaster 检测悬停
 * - 悬停：把鼠标的 UV 传给着色器 → 平面跟随鼠标微微凸起
 * - 点击：记录时间触发涟漪（sin 波纹随时间扩散衰减）
 * - 相机位置随鼠标轻微偏移 → 视差效果
 */
function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#080808', fov: 60 })

  manager.camera.position.set(0, 2, 8)
  manager.camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true

  /* ========== 场景物体 ========== */
  /** mouse 初始化为 (‑999, ‑999)，确保页面刚加载时不会误触发拾取 */
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2(-999, -999)

  const meshes: THREE.Mesh[] = []
  const colors = [0xff6644, 0x44ff66, 0x4466ff, 0xff44ff, 0xffff44]
  const originalPositions: THREE.Vector3[] = []

  /**
   * 创建 5 个可交互的平面
   * - PlaneGeometry(3, 3, 64, 64)：高细分平面，顶点够多，涟漪形变更平滑
   * - uMouse：鼠标在平面上的 UV 坐标（由 Raycaster 的 hit.uv 更新）
   * - uRippleTime：点击触发涟漪的时刻；uHover：悬停高亮强度
   * - 沿 X 轴均匀排列：(i - 2) * 3.5 → x = -7, -3.5, 0, 3.5, 7
   */
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.PlaneGeometry(3, 3, 64, 64)
    const mat = new THREE.ShaderMaterial({
      vertexShader: rippleVertexShader,
      fragmentShader: rippleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uRippleTime: { value: -10 },
        uColor: { value: new THREE.Color(colors[i]) },
        uHover: { value: 0 },
      },
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set((i - 2) * 3.5, 0, 0)
    mesh.userData.index = i
    manager.scene.add(mesh)
    meshes.push(mesh)
    originalPositions.push(mesh.position.clone())
  }

  /** 灯光 */
  manager.scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  /* ========== 鼠标交互 ========== */
  /** 当前被悬停的平面；clickTime 记录最近一次点击的时间（负值表示从未点击） */
  let hoveredMesh: THREE.Mesh | null = null
  let clickTime = -10

  /** 把鼠标屏幕坐标归一化到 NDC（[-1, 1]），供 Raycaster 使用 */
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  })

  /** 点击当前悬停的平面时，记录触发时刻并传给着色器生成涟漪 */
  canvas.addEventListener('click', () => {
    if (hoveredMesh) {
      clickTime = clock.getElapsedTime()
      const material = hoveredMesh.material as THREE.ShaderMaterial
      material.uniforms.uRippleTime.value = clickTime
    }
  })

  /* ========== 控制面板 ========== */
  // ControlPanel not needed for this lesson - pure mouse interaction

  /* ========== 动画循环 ========== */
  const clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    const t = clock.getElapsedTime()

    /** Raycaster 检测 */
    raycaster.setFromCamera(mouse, manager.camera)
    const intersects = raycaster.intersectObjects(meshes)

    /** 重置所有 hover 状态 */
    meshes.forEach((mesh) => {
      const mat = mesh.material as THREE.ShaderMaterial
      mat.uniforms.uHover.value *= 0.95
    })

    if (intersects.length > 0) {
      const hit = intersects[0]
      const mesh = hit.object as THREE.Mesh
      hoveredMesh = mesh
      const mat = mesh.material as THREE.ShaderMaterial

      /** 更新鼠标 UV 到着色器 */
      if (hit.uv) {
        mat.uniforms.uMouse.value.copy(hit.uv)
      }
      mat.uniforms.uHover.value = 1.0
    } else {
      hoveredMesh = null
    }

    /** 更新所有材质的时间 */
    meshes.forEach((mesh) => {
      const mat = mesh.material as THREE.ShaderMaterial
      mat.uniforms.uTime.value = t
    })

    /** 鼠标驱动的相机微偏移（视差效果） */
    manager.camera.position.x += (mouse.x * 0.5 - manager.camera.position.x) * 0.02
    manager.camera.position.y += (mouse.y * 0.3 + 2 - manager.camera.position.y) * 0.02
    manager.camera.lookAt(0, 0, 0)

    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
