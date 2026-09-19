# Three.js + GLSL 创意 3D 学习项目

20 课体系化课程：从 Three.js 基础到 GLSL Shader，再到 Ray Marching、粒子系统、滚动驱动动画等创意特效，目标是在 L4 阶段复刻 Awwwards 获奖网站的核心 3D 效果。

## 当前进度

- 第 1-12 课已完成（截至 2026-08-31，平均 9.5 分）
- 第 13-20 课代码与笔记修复完善中

| 课 | 目录 | 主题 | 完成日期 | 评分 |
|----|------|------|---------|------|
| 1 | 01-project-architecture | Three.js 项目架构 | 2026-07-06 | 8.5 |
| 2 | 02-primitives | 几何体与图元 | 2026-07-07 | 9.5 |
| 3 | 03-materials | 材质系统 | 2026-07-16 | 9.5 |
| 4 | 04-lights-and-shadows | 灯光与阴影 | 2026-07-17 | 9.5 |
| 5 | 05-cameras | 相机与控制 | 2026-07-19 | 9.8 |
| 6 | 06-textures | 纹理与贴图 | 2026-07-23 | 9.4 |
| 7 | 07-scene-graph | 场景图与变换 | 2026-07-24 | 9.8 |
| 8 | 08-model-loading | 模型加载 | 2026-07-28 | 9.2 |
| 9 | 09-animation | 动画系统 | 2026-07-30 | 9.8 |
| 10 | 10-glsl-basics | GLSL 基础 | 2026-08-05 | 9.2 |
| 11 | 11-glsl-math | GLSL 数学函数 | 2026-08-19 | 9.85 |
| 12 | 12-noise | 噪声函数 | 2026-08-31 | 9.93 |
| 13 | 13-advanced-shaders | 高级 Shader 效果 | - | - |
| 14 | 14-post-processing | 后处理效果 | - | - |
| 15 | 15-particles | 粒子系统 | - | - |
| 16 | 16-ray-marching | Ray Marching 与 SDF | - | - |
| 17 | 17-scroll-animation | 滚动驱动动画 | - | - |
| 18 | 18-creative-interaction | 创意交互 | - | - |
| 19 | 19-architecture | 网站架构设计 | - | - |
| 20 | 20-performance | 性能调优与部署 | - | - |

## 快速开始

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器 (http://localhost:3300)
npx tsc --noEmit      # 类型检查
pnpm build            # 构建生产版本到 dist/
```

启动后通过地址栏 hash 选课：

- `http://localhost:3300/#lesson-17` 打开第 17 课
- `http://localhost:3300/#homework-12` 打开第 12 课作业

不带 hash 时默认打开第 17 课。部分课（01-04）暂无作业目录。

## 项目结构

```
src/
├── main.ts              # 入口：hash 选课 + 动态加载对应课程
├── style.css            # 全局样式
├── vite-env.d.ts        # Vite 客户端类型（import.meta.glob 等）
├── core/                # 可复用核心模块
│   ├── SceneManager.ts  # 场景/相机/渲染器/渲染循环封装
│   ├── ControlPanel.ts  # 通用控制面板（滑块/下拉/按钮）
│   └── LoadingScreen.ts # 加载进度屏
├── lessons/             # 每课示例代码（01-20 各一个目录）
└── homework/            # 每课作业（05-20 各一个目录）
docs/                    # 每课技术笔记（01-10、12-20，第 11 课待补）
public/
├── models/              # GLTF/OBJ 模型
├── textures/            # 纹理与天空盒
└── draco/               # Draco 解码器（模型压缩）
```

## 相关资料

- 学习计划：[../../../../../wiki/learning/前端/Threejs创意3D/学习计划.md](../../../../../wiki/learning/前端/Threejs创意3D/学习计划.md)（wiki 侧路径：`wiki/learning/前端/Threejs创意3D/学习计划.md`）
- 学习进度跟踪：wiki 侧 `wiki/learning/前端/Threejs创意3D/学习进度跟踪.md`
- 课程笔记（每课一篇）：wiki 侧 `wiki/learning/前端/Threejs创意3D/课程笔记/`
- 同期 webgpu 课程：wiki 侧 `wiki/learning/前端/webgpu/`
