/**
 * 第 17 课：滚动驱动动画
 *
 * 学习目标：
 * 1. 掌握 GSAP ScrollTrigger 的配置
 * 2. 理解 scrub 参数与滚动同步
 * 3. 学会实现视差效果（Parallax）
 * 4. 理解 3D 场景与 HTML 内容同步滚动
 *
 * 本节概览：
 * - 长页面 + Three.js canvas 固定在背景
 * - 滚动页面时，3D 场景随滚动变化
 * - 多个 section 触发不同的 3D 动画
 *
 * 核心思路：
 * - canvas 固定（position: fixed），HTML 内容滚动覆盖在上面
 * - ScrollTrigger 监听滚动位置，scrub 参数让动画与滚动同步
 * - 每个 section 有独立的 scroll trigger，驱动相机/物体变化
 *
 * 参考案例：
 * - GSAP ScrollTrigger 文档
 * - Awwwards 获奖网站的滚动驱动效果
 *
 * 运行方式：
 * - 在浏览器中打开此文件对应的 HTML
 * - 滚动页面观察 3D 场景变化
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ========== 初始化场景 ========== */

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const manager = new SceneManager({ canvas, bgColor: '#0a0a0a', fov: 60 })

  manager.camera.position.set(0, 0, 5)

  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.enabled = false

  /* ========== 场景物体 ========== */
  /** 创建多个几何体，每个对应一个滚动 section */
  const objects: THREE.Mesh[] = []

  const geometries = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.SphereGeometry(0.7, 32, 32),
    new THREE.TorusGeometry(0.6, 0.25, 16, 32),
    new THREE.ConeGeometry(0.6, 1.2, 32),
  ]

  const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44]

  geometries.forEach((geo, i) => {
    const material = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3, metalness: 0.7 })
    const mesh = new THREE.Mesh(geo, material)
    mesh.position.set((i - 1.5) * 3, 0, 0)
    manager.scene.add(mesh)
    objects.push(mesh)
  })

  /** 灯光 */
  manager.scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
  dirLight.position.set(5, 5, 5)
  manager.scene.add(dirLight)

  /* ========== ScrollTrigger 动画 ========== */

  /**
   * scrub: true — 动画进度与滚动位置完全同步
   * scrub: 0.5 — 动画有 0.5 秒的延迟跟随（更平滑）
   *
   * start / end 定义触发区域：
   * - "top top" → section 顶部到达视口顶部时开始
   * - "bottom top" → section 底部到达视口顶部时结束
   */

  /** Section 1：物体从远处飞入 */
  objects.forEach((obj) => {
    gsap.from(obj.position, {
      z: 10,
      scrollTrigger: {
        trigger: '#section-1',
        start: 'top center',
        end: 'bottom center',
        scrub: 0.5,
      },
    })
  })

  /** Section 2：物体旋转 */
  if (objects[0]) {
    gsap.to(objects[0].rotation, {
      y: Math.PI * 2,
      scrollTrigger: {
        trigger: '#section-2',
        start: 'top center',
        end: 'bottom center',
        scrub: 1,
      },
    })
  }

  /** Section 3：物体缩放 */
  objects.forEach((obj) => {
    gsap.to(obj.scale, {
      x: 1.5, y: 1.5, z: 1.5,
      scrollTrigger: {
        trigger: '#section-3',
        start: 'top center',
        end: 'bottom center',
        scrub: 0.5,
      },
    })
  })

  /** Section 4：相机移动 */
  gsap.to(manager.camera.position, {
    x: 5, y: 3, z: 8,
    scrollTrigger: {
      trigger: '#section-4',
      start: 'top center',
      end: 'bottom center',
      scrub: 1,
    },
  })

  /* ========== 动画循环 ========== */
  function animate() {
    requestAnimationFrame(animate)
    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
