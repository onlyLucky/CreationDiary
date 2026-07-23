/**
 * 第 6 课：纹理与贴图
 *
 * 学习目标：
 * 1. 掌握 TextureLoader 加载图片纹理
 * 2. 理解 UV 坐标和纹理映射
 * 3. 学会控制纹理的 repeat、offset、wrap
 * 4. 掌握 CubeTextureLoader 加载天空盒
 * 5. 掌握环境贴图（envMap）与反射
 *
 * 核心概念：
 * - UV 坐标：决定纹理如何映射到几何体表面
 * - repeat：纹理重复次数
 * - offset：纹理偏移量
 * - wrapS/wrapT：纹理环绕模式（RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping）
 * - CubeTextureLoader：6面立方体纹理加载器（天空盒）
 * - 环境贴图：让物体反射周围环境
 */

import * as THREE from 'three'
import { SceneManager } from '@/core/SceneManager'
import { ControlPanel } from '@/core/ControlPanel'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
// RGBELoader：加载 .hdr 格式的高动态范围环境贴图
// .hdr 文件包含比普通图片更多的光照信息（亮度值可以 >1.0）
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

function init() {
  // 获取 HTML 中的 canvas 元素，Three.js 在这里渲染场景
  const canvas = document.getElementById('canvas') as HTMLCanvasElement

  const manager = new SceneManager({
    canvas,
    bgColor: '#1a1a2e',
    fov: 50,
  })

  // 相机位置
  manager.camera.position.set(5, 5, 10)
  manager.camera.lookAt(0, 0, 0)

  // OrbitControls
  const controls = new OrbitControls(manager.camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0, 0)

  // ========== 纹理加载器 ==========
  // TextureLoader 是 Three.js 内置的纹理加载器，支持 jpg/png/webp 等图片格式
  // 一个 TextureLoader 实例可以反复调用 .load() 加载多张纹理
  const textureLoader = new THREE.TextureLoader()

  // ========== 1. 棋盘格纹理（程序生成） ==========

  /**
   * 棋盘格纹理 — 程序生成
   *
   * 使用 Canvas 2D 生成棋盘格纹理，用于 UV 可视化
   * 优点：不需要外部文件，可以动态生成
   */
  // CanvasTexture vs TextureLoader：Canvas 纹理是程序生成的，不需要外部文件
  // 适合动态内容（数据可视化、实时更新）、占位纹理、UV 调试
  function createCheckerTexture(size = 512, squares = 8): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const squareSize = size / squares

    for (let i = 0; i < squares; i++) {
      for (let j = 0; j < squares; j++) {
        // 交替颜色：白色和浅灰色，方便观察 UV 映射方向
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#cccccc'
        ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize)
      }
    }

    // 添加 UV 标记
    ctx.fillStyle = '#ff0000'
    ctx.font = 'bold 48px monospace'
    ctx.fillText('U', size * 0.1, size * 0.5)
    ctx.fillStyle = '#00ff00'
    ctx.fillText('V', size * 0.5, size * 0.9)

    const texture = new THREE.CanvasTexture(canvas)
    // RepeatWrapping：纹理坐标超出 0-1 范围时重复平铺
    // ClampToEdgeWrapping：边缘像素拉伸（默认值）
    // MirroredRepeatWrapping：镜像重复，避免接缝
    texture.wrapS = THREE.RepeatWrapping // 水平方向（U 轴）
    texture.wrapT = THREE.RepeatWrapping // 垂直方向（V 轴）
    return texture
  }

  const checkerTexture = createCheckerTexture()

  // ========== 2. TextureLoader 加载外部纹理 ==========

  /**
   * TextureLoader — 加载图片纹理
   *
   * TextureLoader.load(url, onLoad, onProgress, onError)
   *   url — 图片路径（相对于 public 目录）
   *   onLoad — 加载完成回调，参数是 Texture 对象
   *   onProgress — 加载进度回调（可选）
   *   onError — 加载失败回调（可选）
   *
   * 注意：TextureLoader.load() 是异步的！
   */

  // 地球日间纹理
  // map 属性：漫反射贴图，决定物体表面的颜色/图案
  textureLoader.load(
    '/textures/earth-day.jpg',
    (texture) => {
      if (earthMesh) {
        (earthMesh.material as THREE.MeshStandardMaterial).map = texture
        // needsUpdate = true：告诉 Three.js 材质参数已改变，需要重新编译 shader
        ;(earthMesh.material as THREE.MeshStandardMaterial).needsUpdate = true
      }
      console.log('✅ 地球日间纹理加载成功')
    },
    undefined,
    (error) => console.warn('❌ 地球日间纹理加载失败:', error)
  )

  // 地球凹凸贴图
  // bumpMap：凹凸贴图，用灰度值模拟表面凹凸（不改变几何体，只是视觉效果）
  //   白色 = 凸起，黑色 = 凹陷
  // bumpScale：凹凸强度，值越大凹凸越明显（0.01-0.1 比较自然）
  // 注意：bumpMap 只是法线偏移，不会真的改变模型形状
  textureLoader.load(
    '/textures/earth-bump.jpg',
    (texture) => {
      if (earthMesh) {
        (earthMesh.material as THREE.MeshStandardMaterial).bumpMap = texture
        ;(earthMesh.material as THREE.MeshStandardMaterial).bumpScale = 0.05
        ;(earthMesh.material as THREE.MeshStandardMaterial).needsUpdate = true
      }
      console.log('✅ 地球凹凸贴图加载成功')
    },
    (progress) => {
      // 加载进度
      if (progress.total > 0) {
        console.log(`📡 地球凹凸贴图加载中: ${Math.round(progress.loaded / progress.total * 100)}%`)
      }
    },
    (error) => {
      // 详细错误信息
      console.warn('❌ 地球凹凸贴图加载失败:', error)
      console.warn('尝试直接访问: http://localhost:3300/textures/earth-bump.jpg')
    }
  )

  // 地球高光贴图（实际映射到 roughnessMap）
  // roughnessMap：粗糙度贴图，控制表面不同区域的粗糙/光滑程度
  //   白色 = 粗糙（漫反射强），黑色 = 光滑（镜面反射强）
  // 地球上：海洋光滑（黑色），陆地粗糙（白色）
  textureLoader.load(
    '/textures/earth-specular.jpg',
    (texture) => {
      if (earthMesh) {
        (earthMesh.material as THREE.MeshStandardMaterial).roughnessMap = texture
        ;(earthMesh.material as THREE.MeshStandardMaterial).needsUpdate = true
      }
      console.log('✅ 地球高光贴图加载成功')
    },
    undefined,
    (error) => console.warn('❌ 地球高光贴图加载失败:', error)
  )

  // 金属锈蚀纹理（用于金属球）
  // 锈蚀纹理叠加在高金属度材质上，展示"金属 + 纹理"的效果
  // 锈蚀区域颜色来自纹理，非锈蚀区域保持金属色
  textureLoader.load(
    '/textures/rust-metal.jpg',
    (texture) => {
      // 为锈蚀纹理设置 RepeatWrapping，确保 UV 超出 0-1 时不会出现黑边
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      if (metalSphere) {
        (metalSphere.material as THREE.MeshStandardMaterial).map = texture
        ;(metalSphere.material as THREE.MeshStandardMaterial).needsUpdate = true
      }
      console.log('✅ 金属锈蚀纹理加载成功')
    },
    undefined,
    (error) => console.warn('❌ 金属锈蚀纹理加载失败:', error)
  )

  // 木地板纹理（用于地面）
  // repeat.set(4, 4)：水平和垂直方向各重复 4 次
  // 配合 RepeatWrapping 实现"瓷砖"效果
  textureLoader.load(
    '/textures/wood-floor.jpg',
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(4, 4) // 4x4 平铺，让地板纹理更细腻
      if (ground) {
        (ground.material as THREE.MeshStandardMaterial).map = texture
        ;(ground.material as THREE.MeshStandardMaterial).needsUpdate = true
      }
      console.log('✅ 木地板纹理加载成功')
    },
    undefined,
    (error) => console.warn('❌ 木地板纹理加载失败:', error)
  )

  // ========== 3. CubeTextureLoader 加载天空盒 ==========

  /**
   * CubeTextureLoader — 加载立方体纹理（天空盒）
   *
   * 需要 6 张图片，分别对应立方体的 6 个面：
   *   px.jpg — 右（+X）   nx.jpg — 左（-X）
   *   py.jpg — 上（+Y）   ny.jpg — 下（-Y）
   *   pz.jpg — 前（+Z）   nz.jpg — 后（-Z）
   *
   * 使用场景：
   *   1. scene.background — 设置为场景背景（天空盒）
   *   2. scene.environment — 设置为环境光照（PBR 材质会自动采样）
   *   3. material.envMap — 单独给某个材质设置环境反射
   *
   * 与 HDRI 的区别：
   *   - CubeTexture：6 张图片，性能好，适合移动端
   *   - HDRI：单张 .hdr 文件，光照信息更丰富，适合高品质渲染
   */
  const cubeTextureLoader = new THREE.CubeTextureLoader()

  cubeTextureLoader.load(
    [
      '/textures/skybox/px.jpg',
      '/textures/skybox/nx.jpg',
      '/textures/skybox/py.jpg',
      '/textures/skybox/ny.jpg',
      '/textures/skybox/pz.jpg',
      '/textures/skybox/nz.jpg',
    ],
    (envMap) => {
      // 设置天空盒为场景背景
      manager.scene.background = envMap

      // 设置环境贴图，让金属物体反射天空盒
      // manager.scene.environment = envMap

      console.log('✅ 天空盒加载成功')
    },
    undefined,
    (error) => console.warn('❌ 天空盒加载失败:', error)
  )

  // ========== 4. RGBELoader 加载 HDRI 环境贴图 ==========

  /**
   * RGBELoader — 加载 HDR 环境贴图
   *
   * HDRI（High Dynamic Range Image）提供更真实的环境光照
   * 加载后需要设置 texture.mapping = THREE.EquirectangularReflectionMapping
   *
   * 注意：如果天空盒加载成功，HDRI 会覆盖天空盒作为背景
   */
  const rgbeLoader = new RGBELoader()

  rgbeLoader.load(
    '/textures/venice-sunset.hdr',
    (texture) => {
      // EquirectangularReflectionMapping：等距柱状投影映射
      // 告诉 Three.js 这张 HDRI 是用"经纬度"方式拍摄的全景图
      // GPU 会自动把它当作一个球面环境来采样
      texture.mapping = THREE.EquirectangularReflectionMapping

      // HDRI 作为环境光照（不影响背景）
      manager.scene.environment = texture

      console.log('✅ HDRI 环境贴图加载成功')
    },
    undefined,
    (error) => console.warn('❌ HDRI 环境贴图加载失败:', error)
  )

  // ========== 5. 创建场景物体 ==========

  // 地面（镜面反射，呼应宇宙天空盒）
  // PlaneGeometry 默认在 XY 平面，旋转 -90° 放到 XZ 平面
  const groundGeo = new THREE.PlaneGeometry(20, 20)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x111122, // 深蓝黑色，呼应宇宙主题
    roughness: 0.15, // 接近镜面（0 = 完美镜面，1 = 完全粗糙）
    metalness: 0.95, // 高金属度，反射天空盒（0 = 非金属，1 = 纯金属）
  })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2 // 绕 X 轴旋转 -90°，让平面水平放置
  ground.position.y = -2
  manager.scene.add(ground)

  // 立方体（使用棋盘格纹理，展示 UV 映射）
  // BoxGeometry 的 UV 坐标：每个面独立映射完整纹理（0,0 到 1,1）
  const cubeGeo = new THREE.BoxGeometry(2, 2, 2)
  const cubeMat = new THREE.MeshStandardMaterial({
    map: checkerTexture, // 棋盘格纹理，方便观察 UV 方向
    roughness: 0.5,
    metalness: 0.2,
  })
  const cube = new THREE.Mesh(cubeGeo, cubeMat)
  cube.position.set(-4, 0, 0) // 放在左侧
  manager.scene.add(cube)

  // 地球（使用地球纹理 + 环境贴图反射）
  // SphereGeometry：球体几何体
  //   1.5 = 半径，64 = 水平分段数，32 = 垂直分段数
  //   分段数越高越平滑，64/32 是高品质球体的标准配置
  const earthGeo = new THREE.SphereGeometry(1.5, 64, 32)
  // 初始颜色：浅蓝色，纹理加载后会被覆盖
  const earthMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // 纹理加载前的占位颜色
    roughness: 0.7,  // 纹理加载后会被 roughnessMap 覆盖
    metalness: 0.1,  // 地球是非金属材质
  })
  const earthMesh = new THREE.Mesh(earthGeo, earthMat)
  earthMesh.position.set(0, 0, 0) // 放在场景中心
  manager.scene.add(earthMesh)

  // 金属球（展示环境贴图反射效果）
  // 重点：metalness=1.0 + roughness=0.2 = 镜面金属反射
  //   环境贴图（envMap）会自动被 PBR 材质采样
  //   roughness 越低，反射越清晰；roughness 越高，反射越模糊
  const metalSphereGeo = new THREE.SphereGeometry(1, 64, 32)
  const metalSphereMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc, // 浅灰色，作为金属反射的基色
    roughness: 0.2,  // 较光滑，反射清晰
    metalness: 1.0,  // 纯金属材质，完全反射环境光
  })
  const metalSphere = new THREE.Mesh(metalSphereGeo, metalSphereMat)
  metalSphere.position.set(4, 0, 0) // 放在右侧
  manager.scene.add(metalSphere)

  // 圆柱体（使用棋盘格纹理，展示纹理平铺）
  // CylinderGeometry：圆柱体，参数是 上半径、下半径、高度、分段数
  // 圆柱的 UV 映射：侧面会环绕展开，顶面和底面是圆形投影
  const cylinderGeo = new THREE.CylinderGeometry(0.8, 0.8, 2, 32)
  const cylinderMat = new THREE.MeshStandardMaterial({
    map: checkerTexture, // 棋盘格在圆柱上会展示 UV 环绕效果
    roughness: 0.6,
    metalness: 0.2,
  })
  const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat)
  cylinder.position.set(-4, 0, -4) // 左后方
  manager.scene.add(cylinder)

  // 圆环（使用棋盘格纹理，展示 UV 映射）
  // TorusGeometry：甜甜圈形状
  //   0.8 = 圆环半径（中心到管中心），0.3 = 管的半径
  //   16 = 管的分段数，32 = 圆环的分段数
  // UV 映射：棋盘格会沿着圆环"卷"起来，方便观察扭曲效果
  const torusGeo = new THREE.TorusGeometry(0.8, 0.3, 16, 32)
  const torusMat = new THREE.MeshStandardMaterial({
    map: checkerTexture,
    roughness: 0.5,
    metalness: 0.3,
  })
  const torus = new THREE.Mesh(torusGeo, torusMat)
  torus.position.set(0, 0, -4) // 正后方
  manager.scene.add(torus)

  // 玻璃球（展示折射/透明效果）
  // MeshPhysicalMaterial 是 MeshStandardMaterial 的扩展版
  // 新增 transmission、thickness、ior 等物理属性，用于模拟透明材质
  const glassSphereGeo = new THREE.SphereGeometry(0.8, 64, 32)
  const glassSphereMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0,       // 完全光滑，透明材质不需要粗糙度
    metalness: 0,       // 非金属
    transmission: 0.9,  // 透光率 90%（0 = 不透明，1 = 完全透明）
    thickness: 0.5,     // 厚度，影响光线在材质内部的折射路径
    ior: 1.5,           // 折射率（Index of Refraction）
                        // 常见值：水 1.33，玻璃 1.5，钻石 2.42
  })
  const glassSphere = new THREE.Mesh(glassSphereGeo, glassSphereMat)
  glassSphere.position.set(4, 0, -4) // 右后方
  manager.scene.add(glassSphere)

  // ========== 6. 灯光 ==========
  // 三点照明法：环境光 + 主光源 + 补光
  //   环境光：照亮所有物体的基础亮度，避免全黑区域
  //   主光源（Key Light）：主要光照方向，产生阴影
  //   补光（Fill Light）：补充阴影区域的亮度，减少明暗对比
  manager.scene.add(new THREE.AmbientLight(0xffffff, 0.4)) // 环境光，强度 0.4
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8) // 主光源，强度 0.8
  directionalLight.position.set(5, 8, 5) // 右上前方，模拟太阳光
  manager.scene.add(directionalLight)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3) // 补光，强度 0.3
  fillLight.position.set(-5, 3, -5) // 左下后方，补充阴影
  manager.scene.add(fillLight)

  // ========== 7. 网格和坐标轴 ==========
  // GridHelper：网格辅助线，方便观察空间位置
  //   20 = 网格大小，20 = 分割数，后面两个是中心线和网格线颜色
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333)
  gridHelper.position.y = -1.99 // 略高于地面，避免 Z-fighting（闪烁）
  manager.scene.add(gridHelper)

  // AxesHelper：坐标轴辅助线
  //   红色 = X 轴，绿色 = Y 轴，蓝色 = Z 轴
  const axesHelper = new THREE.AxesHelper(8)
  manager.scene.add(axesHelper)

  // ========== 8. 控制面板 ==========
  // ControlPanel 是项目封装的 UI 组件，用于快速创建参数调节面板
  const panel = new ControlPanel()

  // 纹理重复次数
  // repeat：控制纹理在 U/V 方向的重复次数
  //   (1,1) = 原始大小，(2,2) = 重复 2x2，(4,4) = 重复 4x4
  // 需要配合 RepeatWrapping 使用，否则 repeat > 1 时边缘会出现拉伸
  panel.addSlider({
    id: 'repeat',
    label: '纹理重复：',
    type: 'slider',
    min: 1,
    max: 10,
    step: 1,
    defaultValue: 1,
    onChange: (value) => {
      checkerTexture.repeat.set(value, value)
      checkerTexture.needsUpdate = true // 修改纹理属性后必须设为 true
    },
  })

  // 纹理偏移 U（水平方向）
  // offset：移动纹理坐标，(0,0) = 原始位置，(0.5,0) = 水平移动半个纹理
  // 常用于：滚动背景、序列帧动画、视差贴图
  panel.addSlider({
    id: 'offset-u',
    label: '偏移 U：',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    onChange: (value) => {
      checkerTexture.offset.x = value
      checkerTexture.needsUpdate = true
    },
  })

  // 纹理偏移 V（垂直方向）
  panel.addSlider({
    id: 'offset-v',
    label: '偏移 V：',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    onChange: (value) => {
      checkerTexture.offset.y = value
      checkerTexture.needsUpdate = true
    },
  })

  // 纹理旋转
  // rotation：绕纹理中心旋转（弧度制）
  //   0 = 不旋转，Math.PI/2 = 90°，Math.PI = 180°
  // 注意：旋转中心在纹理中心 (0.5, 0.5)，不是左下角
  panel.addSlider({
    id: 'rotation',
    label: '纹理旋转：',
    type: 'slider',
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 0,
    onChange: (value) => {
      checkerTexture.rotation = (value * Math.PI) / 180
      checkerTexture.needsUpdate = true
    },
  })

  // 环绕模式
  // wrapS/wrapT：纹理坐标超出 0-1 范围时的处理方式
  //   S = 水平（U），T = 垂直（V）
  // 注意：需要 repeat > 1 才能看到环绕模式的效果！
  panel.addSelect({
    id: 'wrap-mode',
    label: '环绕模式：',
    type: 'select',
    options: [
      { value: 'repeat', label: 'Repeat（重复）' },   // 平铺重复，最常用
      { value: 'clamp', label: 'Clamp（边缘拉伸）' },   // 边缘像素拉伸，适合单张贴图
      { value: 'mirror', label: 'Mirror（镜像重复）' }, // 镜像重复，避免接缝
    ],
    defaultValue: 'repeat',
    onChange: (value) => {
      switch (value) {
        case 'repeat':
          checkerTexture.wrapS = THREE.RepeatWrapping
          checkerTexture.wrapT = THREE.RepeatWrapping
          break
        case 'clamp':
          checkerTexture.wrapS = THREE.ClampToEdgeWrapping
          checkerTexture.wrapT = THREE.ClampToEdgeWrapping
          break
        case 'mirror':
          checkerTexture.wrapS = THREE.MirroredRepeatWrapping
          checkerTexture.wrapT = THREE.MirroredRepeatWrapping
          break
      }

      // 切换环绕模式时，自动设置 repeat 为 3，方便观察效果差异
      // 如果 repeat = (1,1)，纹理只显示一次，看不到环绕模式的区别
      checkerTexture.repeat.set(3, 3)
      checkerTexture.needsUpdate = true

      console.log(`🔄 环绕模式切换为: ${value}, repeat 已设为 (3,3)`)
    },
  })

  // 金属度（展示环境贴图反射效果）
  // metalness：控制材质是金属还是非金属
  //   0 = 非金属（塑料、木头、石头），1 = 金属（铁、金、铜）
  // 金属材质会反射环境光，非金属材质主要显示 diffuse 颜色
  panel.addSlider({
    id: 'metalness',
    label: '金属度：',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 1,
    onChange: (value) => {
      (metalSphere.material as THREE.MeshStandardMaterial).metalness = value
    },
  })

  // 粗糙度（展示环境贴图反射效果）
  // roughness：控制表面粗糙程度，影响反射的模糊/清晰
  //   0 = 完美镜面（玻璃、抛光金属），1 = 完全粗糙（石头、橡胶）
  // roughness 和 metalness 配合使用，可以模拟各种真实材质
  panel.addSlider({
    id: 'roughness',
    label: '粗糙度：',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0.2,
    onChange: (value) => {
      (metalSphere.material as THREE.MeshStandardMaterial).roughness = value
    },
  })

  // 重置按钮 — 恢复所有参数到初始值
  panel.addButton({
    id: 'reset',
    label: '重置参数',
    type: 'button',
    onClick: () => {
      // 恢复纹理变换参数
      checkerTexture.repeat.set(1, 1) // 不重复
      checkerTexture.offset.set(0, 0) // 无偏移
      checkerTexture.rotation = 0     // 不旋转
      checkerTexture.wrapS = THREE.RepeatWrapping // 恢复为重复模式
      checkerTexture.wrapT = THREE.RepeatWrapping
      checkerTexture.needsUpdate = true

      // 恢复金属球材质参数
      metalSphere.material.metalness = 1
      metalSphere.material.roughness = 0.2
    },
  })

  // ========== 9. 动画循环 ==========
  // delta：上一帧到这一帧的时间差（秒），用于帧率无关的动画
  //   60fps 时 delta ≈ 0.016，30fps 时 delta ≈ 0.033
  //   用 delta 乘以速度，可以保证不同设备上动画速度一致
  manager.onUpdate((delta) => {
    controls.update() // 启用阻尼后必须在每帧调用 update()

    // 立方体旋转 — 同时绕 X 和 Y 轴旋转，产生复杂运动
    cube.rotation.x += 0.3 * delta
    cube.rotation.y += 0.5 * delta

    // 地球旋转 — 绕 Y 轴自转
    earthMesh.rotation.y += 0.2 * delta

    // 圆环旋转 — 同时绕 X 和 Z 轴旋转，像翻滚一样
    torus.rotation.x += 0.4 * delta
    torus.rotation.z += 0.3 * delta
  })

  manager.start() // 启动渲染循环

  // ========== 控制台提示 ==========
  // 输出学习要点到浏览器控制台，方便复习
  console.log('=== 第 6 课：纹理与贴图 ===')
  console.log('观察要点：')
  console.log('  - 棋盘格纹理在不同几何体上的 UV 映射效果')
  console.log('  - 地球纹理（日间、凹凸、高光）')
  console.log('  - 天空盒（CubeTextureLoader）')
  console.log('  - 环境贴图反射（金属球）')
  console.log('  - HDRI 环境光照')
  console.log('')
  console.log('尝试修改：')
  console.log('  - 拖动滑块调整纹理参数')
  console.log('  - 调整金属度和粗糙度，观察反射变化')
  console.log('  - 切换环绕模式（Repeat/Clamp/Mirror）')
}

init()
