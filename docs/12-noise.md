# 第 12 课技术笔记：噪声函数实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. 伪随机 vs 噪声

| | 伪随机数（fract + sin） | 噪声函数 |
|--|--|--|
| 连续性 | ❌ 不连续，相邻点差异大 | ✅ 连续，相邻点平滑过渡 |
| 视觉效果 | 杂乱的雪花 | 云雾、地形、火焰等有机效果 |
| 可预测性 | 哈希，完全不可预测 | 梯度插值，有规律 |

**类比**：随机数 = 掷骰子（每次独立）；噪声 = 山脉高度（相邻接近，整体不可预测）

### 2. Perlin Noise 算法

1. `floor(p)` → 整数网格坐标
2. `fract(p)` → 格子内小数坐标
3. `hash(i + offset)` → 四个角的随机梯度向量（vec2）
4. `dot(梯度, 距离向量)` → 四个角对当前点的影响值
5. Hermite 插值 `f*f*(3-2*f)` → 平滑混合

### 3. FBM（分形布朗运动）

叠加多个频率/振幅的噪声层：
- 每层频率 ×lacunarity（通常 2.0）
- 每层振幅 ×persistence（通常 0.5）
- octaves 越多细节越丰富，但计算量线性增长

| 层 | 频率 | 振幅 | 效果 |
|----|------|------|------|
| 1 | ×1 | ×1 | 大轮廓 |
| 2 | ×2 | ×0.5 | 中等细节 |
| 3 | ×4 | ×0.25 | 细节 |
| 4 | ×8 | ×0.125 | 微细节 |

### 4. 顶点变形

在顶点着色器中用噪声偏移 position：
```glsl
float n = fbm(pos.xy * scale + time, octaves, lacunarity, persistence);
pos += normal * n * strength;
```

法线重算用有限差分法：对 pos 做微小偏移 (eps)，算切线，再叉积得到新法线。

---

## API 速查

| API | 用途 |
|-----|------|
| `floor(x)` | 取整数部分（确定网格坐标） |
| `fract(x)` | 取小数部分（确定格内位置） |
| `dot(a, b)` | 点积（梯度与距离的投影） |
| `mix(a, b, t)` | 线性插值 |
| `smoothstep(e0, e1, x)` | 平滑阶跃（Hermite 插值） |
| `normalize(v)` | 向量归一化 |
| `cross(a, b)` | 叉积（求法线） |
| `IcosahedronGeometry(r, detail)` | 二十面体球体，detail=64 时约 40962 顶点 |

---

## 课程代码结构

| 面板 | 着色器 | 核心知识点 |
|------|--------|-----------|
| Perlin Noise | `perlinFragmentShader` | hash 梯度 + dot 影响值 + Hermite 插值 |
| FBM | `fbmFragmentShader` | 多层噪声叠加，octaves/lacunarity/persistence |
| 云雾/火焰 | `cloudFragmentShader` | FBM + 时间动画 + smoothstep 形状控制 |
| 顶点变形 | `deformVertexShader` | 顶点法线偏移 + 有限差分法重算法线 |

---

## 常见错误

- **噪声值域映射**：Perlin Noise 输出约 [-0.7, 0.7]，需要 `* 0.5 + 0.5` 映射到 [0, 1]
- **顶点着色器不能用 `if` 分支**：GLSL 中 if/else 在顶点着色器中性能差，尽量用 mix/step
- **法线不重算**：顶点变形后直接用原始法线 → 光照会"滑动"
- **octaves 太多**：8 层以上性能下降明显，视觉差异不大，4~6 层通常够用

---

## 相关资源

- [The Book of Shaders — Noise](https://thebookofshaders.com/11/)
- [Inigo Quilez — Noise](https://iquilezles.org/articles/noiseonline/)
- [Inigo Quilez — FBM](https://iquilezles.org/articles/fbm/)
- [Shadertoy — Noise 示例](https://www.shadertoy.com/view/XslGRr)
