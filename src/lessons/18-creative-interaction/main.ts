/**
 * 第 18 课：创意交互
 *
 * 学习目标：
 * 1. 掌握 Raycaster 鼠标拾取
 * 2. 学会鼠标跟随效果（cursor-driven）
 * 3. 理解涟漪/扭曲交互效果
 * 4. 掌握物理引擎（Rapier）与渲染循环的同步模式
 *
 * 本节概览（交互式 3D 场景）：
 * - 鼠标移动 → 相机/物体跟随鼠标
 * - 点击交互平面 → 涟漪扩散效果
 * - 点击地面平台 → 生成新小球，由 Rapier 物理引擎模拟掉落与碰撞
 *
 * 核心思路：
 * - Raycaster 从相机向鼠标位置发射射线，检测交叉物体
 * - 鼠标坐标归一化到 [-1, 1]
 * - lerp 平滑跟随避免抖动
 * - Rapier 维护物理世界（world.step 推进模拟），渲染层每帧把刚体位置抄写回 Mesh
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
import RAPIER from '@dimforge/rapier3d-compat'
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
 * ├── ambientLight / directionalLight (灯光)
 * ├── 5 个交互平面  (PlaneGeometry + ShaderMaterial，带涟漪/hover 效果)
 * ├── 地面平台      (BoxGeometry + Rapier fixed 刚体)
 * └── 掉落小球      (SphereGeometry + Rapier dynamic 刚体，点击地面可生成)
 *
 * 交互流程：
 * - mousemove：把鼠标坐标归一化到 [-1, 1]，Raycaster 检测悬停
 * - 悬停：把鼠标的 UV 传给着色器 → 平面跟随鼠标微微凸起
 * - 点击交互平面：记录时间触发涟漪（sin 波纹随时间扩散衰减）
 * - 点击地面平台：Rapier 创建 dynamic 刚体小球，掉落、弹跳、堆积
 * - 相机位置随鼠标轻微偏移 → 视差效果
 */
async function init() {
  /**
   * 初始化 Rapier 物理引擎
   * - 选 compat 版：wasm 以 base64 内嵌进 JS，Vite 无需额外配置 wasm 资源
   * - init() 异步解码并编译 wasm，必须 await 之后才能调用其他 Rapier API
   */
  await RAPIER.init()

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
  /** 方向光：给 MeshStandardMaterial 的球体提供立体光照（涟漪平面用 ShaderMaterial 自算漫反射，不受灯光影响） */
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
  dirLight.position.set(5, 8, 5)
  manager.scene.add(dirLight)

  /* ========== Rapier 物理世界 ========== */
  /**
   * 物理世界与渲染世界是两套独立的数据：
   * - Rapier 在自己的 world 里维护刚体（位置/速度/碰撞），world.step() 每次推进一段模拟
   * - Three.js 的 Mesh 只负责「画」，我们把刚体算出的位置抄写给 mesh
   * 这就是「物理 + 渲染」协同的基本模式：物理不管画，渲染不算物理
   */
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  /**
   * 固定时间步长 1/60s：每渲染帧调用一次 step，物理就按固定步长推进。
   * 简单做法（本课）：一帧一步，60Hz 屏幕上物理时间 = 真实时间。
   * 更严谨的做法是「累加器」：按真实流逝时间攒 dt，攒够一个固定步长才 step
   * （可能一帧多步或零步），保证不同刷新率下物理表现一致，本课从简不展开。
   */
  world.timestep = 1 / 60

  /** 地面平台：视觉上是一块半透明板子，物理上是一个静止（fixed）的长方体碰撞体 */
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.3, 5),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.9, transparent: true, opacity: 0.85 }),
  )
  ground.position.set(0, -1.65, 3.2)
  manager.scene.add(ground)
  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1.65, 3.2),
  )
  /** ColliderDesc.cuboid(hx, hy, hz) 用的是「半尺寸」，BoxGeometry(10,0.3,5) 对应 (5, 0.15, 2.5) */
  world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.15, 2.5), groundBody)

  /** 球体的 mesh 与刚体配对列表；物理模拟结果每帧同步回 mesh */
  const ballEntries: Array<{ mesh: THREE.Mesh; body: RAPIER.RigidBody }> = []
  const ballColors = [0xff6644, 0x44ff66, 0x4466ff, 0xff44ff, 0xffff44, 0x66ffff]

  /** 生成一颗掉落小球：Three.js 建 mesh，Rapier 建 dynamic 刚体 + 球形碰撞体 */
  function spawnBall(x: number, y: number, z: number, color: number) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 }),
    )
    manager.scene.add(mesh)

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z),
    )
    /** restitution 弹性（0~1，越大越弹）、friction 摩擦，作用在碰撞体上 */
    world.createCollider(
      RAPIER.ColliderDesc.ball(0.3).setRestitution(0.6).setFriction(0.5),
      body,
    )

    mesh.position.set(x, y, z)
    ballEntries.push({ mesh, body })
  }

  /** 初始从空中掉落 6 个球 */
  ballColors.forEach((color, i) => {
    spawnBall((i - 2.5) * 0.8 + (Math.random() - 0.5) * 0.4, 4 + i * 0.8, 3.2, color)
  })

  /* ========== 鼠标交互 ========== */
  /** 当前被悬停的平面；clickTime 记录最近一次点击的时间（负值表示从未点击） */
  let hoveredMesh: THREE.Mesh | null = null
  let clickTime = -10

  /** 把鼠标屏幕坐标归一化到 NDC（[-1, 1]），供 Raycaster 使用 */
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  })

  /**
   * 点击分两类，与拾取逻辑自然共存：
   * - 悬停在交互平面上点击 → 触发该平面的涟漪（原有行为）
   * - 否则用点击坐标再检测一次地面平台 → 命中则从点击处上方生成一颗掉落球
   *   （生成之后的运动完全交给 Rapier：掉落、弹跳、与其他球碰撞堆积）
   */
  canvas.addEventListener('click', (e) => {
    if (hoveredMesh) {
      clickTime = clock.getElapsedTime()
      const material = hoveredMesh.material as THREE.ShaderMaterial
      material.uniforms.uRippleTime.value = clickTime
      return
    }

    /** mousemove 维护的 mouse 只反映「悬停」，这里用点击事件自身的坐标更准确 */
    const clickNdc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    )
    raycaster.setFromCamera(clickNdc, manager.camera)
    const groundHit = raycaster.intersectObject(ground)[0]
    if (groundHit) {
      spawnBall(
        THREE.MathUtils.clamp(groundHit.point.x, -4, 4),
        4,
        THREE.MathUtils.clamp(groundHit.point.z, 1.5, 4.8),
        ballColors[Math.floor(Math.random() * ballColors.length)],
      )
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

    /**
     * 物理模拟推进一步，然后把刚体的位置/旋转抄写回 mesh（物理 → 渲染的同步）。
     * Rapier 的 translation()/rotation() 返回的是它自己的 {x,y,z} / {x,y,z,w} 对象，
     * 不能直接 THREE 的 copy()（类型不同），用 set 逐分量赋值最稳。
     */
    world.step()
    for (const { mesh, body } of ballEntries) {
      const p = body.translation()
      const r = body.rotation()
      mesh.position.set(p.x, p.y, p.z)
      mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }

    /** 掉出平台的球直接回收（移除刚体 + 释放几何体/材质），防止列表与场景无限增长 */
    for (let i = ballEntries.length - 1; i >= 0; i--) {
      if (ballEntries[i].mesh.position.y < -12) {
        world.removeRigidBody(ballEntries[i].body)
        manager.scene.remove(ballEntries[i].mesh)
        ballEntries[i].mesh.geometry.dispose()
        ;(ballEntries[i].mesh.material as THREE.Material).dispose()
        ballEntries.splice(i, 1)
      }
    }

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
