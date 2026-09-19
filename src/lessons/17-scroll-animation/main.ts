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
 * - pnpm dev 启动后，地址栏加 #lesson-17 选课
 * - 滚动页面观察 3D 场景变化（可滚动的页面结构由本课自行注入，见 injectScrollPage）
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ========== 滚动页面结构注入 ========== */

/**
 * 滚动结构是本课自己注入的，原因：
 * 共享的 index.html 只有单屏 canvas，没有 #section-1 到 #section-4
 * 这些 ScrollTrigger 需要的触发元素；而它是所有课共用的骨架，
 * 不该为了一门课改公共结构。所以由本课在运行时自己搭：
 *
 * - canvas 钉在背景（position: fixed），不随页面滚动
 * - 4 个 100vh 的 section 叠在上面提供可滚动的空间
 * - 每一屏对应一段 ScrollTrigger 动画（见下方四个 trigger）
 */
function injectScrollPage() {
  // style.css 把 html/body 锁成了 overflow: hidden（单屏演示用的全局样式），
  // 滚动课要先解锁，否则页面根本滚不动
  document.documentElement.style.overflowY = 'auto'
  document.body.style.overflowY = 'auto'

  // canvas 从「随文档流单屏铺满」改为「钉在背景」
  const canvas = document.getElementById('canvas')
  if (canvas) {
    canvas.style.position = 'fixed'
    canvas.style.inset = '0'
    canvas.style.zIndex = '0'
  }

  /** 每一屏的文案：标题说明这屏驱动什么动画，副标题点名对应的代码手段 */
  const sections = [
    { title: '第 1 屏 · 飞入', desc: '物体从 z=10 的远处飞回原位 — gsap.from 起点偏移 + scrub 同步' },
    { title: '第 2 屏 · 旋转', desc: '红色方块转一整圈 — rotation.y 从 0 到 2π' },
    { title: '第 3 屏 · 放大', desc: '所有物体放大到 1.5 倍 — scale 的线性插值' },
    { title: '第 4 屏 · 运镜', desc: '相机滑向 (5, 3, 8) 的新机位 — 换个角度看同一群物体' },
  ]

  const page = document.createElement('div')
  page.className = 'scroll-page'
  page.innerHTML = sections
    .map(
      (s, i) => `
      <section id="section-${i + 1}">
        <div class="scroll-copy">
          <h2>${s.title}</h2>
          <p>${s.desc}</p>
        </div>
      </section>`,
    )
    .join('')
  document.body.appendChild(page)

  // 本课专属样式跟着注入走，不进 style.css（别的课用不上）
  const style = document.createElement('style')
  style.textContent = `
    .scroll-page { position: relative; z-index: 1; }
    .scroll-page section {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .scroll-copy {
      text-align: center;
      pointer-events: none; /* 纯展示文案，别挡住底下的交互 */
      user-select: none;
    }
    .scroll-copy h2 { font-size: 2rem; font-weight: 600; opacity: 0.9; }
    .scroll-copy p { margin-top: 8px; font-size: 0.95rem; opacity: 0.55; }
  `
  document.head.appendChild(style)
}

/* ========== 初始化场景 ========== */

function init() {
  // 先注入滚动结构，后面 ScrollTrigger 的触发元素（#section-1 ~ #section-4）才有地方找
  injectScrollPage()

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
   * - "top center" → section 顶边到达视口中线时开始
   * - "bottom center" → section 底边到达视口中线时结束
   *
   * 为什么用四条独立 trigger 而不是一条 timeline？
   * 四段动画的触发时机由各自所在屏幕的滚动位置决定（进入哪屏触发哪段），
   * 用 timeline 串起来反而要手工对齐各段的时间轴偏移；
   * 「每屏各管各的，独立 scrub」正是滚动驱动页面的常见模式。
   */

  /** Section 1（#section-1）：物体从远处飞入 */
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

  /** Section 2（#section-2）：第一个物体旋转一整圈 */
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

  /** Section 3（#section-3）：所有物体放大到 1.5 倍 */
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

  /** Section 4（#section-4）：相机滑向新机位 */
  gsap.to(manager.camera.position, {
    x: 5, y: 3, z: 8,
    scrollTrigger: {
      trigger: '#section-4',
      start: 'top center',
      end: 'bottom center',
      scrub: 1,
    },
  })

  /* ========== 视差（Parallax） ========== */

  /**
   * 鼠标视差：改的是相机角度而不是位置——
   * position 被上面的 ScrollTrigger 动画接管了，两条动画同时写一个属性会打架；
   * 转头（rotation）和运镜（position）互不干扰，视差感照样有。
   */
  const tiltX = gsap.quickTo(manager.camera.rotation, 'x', { duration: 0.8, ease: 'power2.out' })
  const tiltY = gsap.quickTo(manager.camera.rotation, 'y', { duration: 0.8, ease: 'power2.out' })

  function onMouseMove(e: MouseEvent) {
    // 鼠标位置归一化到 [-1, 1]，再乘一个很小的最大偏转角（弧度）
    const nx = (e.clientX / window.innerWidth - 0.5) * 2
    const ny = (e.clientY / window.innerHeight - 0.5) * 2
    tiltY(-nx * 0.06)
    tiltX(ny * 0.06)
  }
  window.addEventListener('mousemove', onMouseMove)

  /* ========== 动画循环 ========== */
  function animate() {
    requestAnimationFrame(animate)
    /** GSAP ScrollTrigger 在 rAF 内自动更新进度，这里只需照常渲染 */
    controls.update()
    manager.renderer.render(manager.scene, manager.camera)
  }
  animate()
}

init()
