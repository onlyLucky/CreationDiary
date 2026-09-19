# 第 11 课技术笔记：GLSL 数学函数实现细节

> 日期：2026-08-19
> 状态：已完成
> 评分：9.85/10

***

## 核心概念

### 1. 函数分类速览

GLSL 内置数学函数按用途分四类，创意编程里各有典型用法：

* **标量整形**：`abs` / `sign` / `floor` / `ceil` / `fract` / `mod` —— 切分、重复、取周期

* **插值与映射**：`mix` / `step` / `smoothstep` / `clamp` —— 一切「形状与过渡」的基石

* **三角函数**：`sin` / `cos` / `atan` —— 波动、圆形、极坐标

* **指数与幂**：`pow` / `exp` / `sqrt` / `log` —— 曲线塑形（伽马、衰减）

### 2. 插值三件套：mix / step / smoothstep

| 函数 | 公式 | 边界 | 典型用途 |
| ------ | ---- | ---- | -------- |
| `mix(a, b, t)` | a*(1-t) + b*t | 连续 | 颜色/位置渐变 |
| `step(edge, x)` | x < edge ? 0 : 1 | 硬边界 | 锐利线条、消融边缘、遮罩 |
| `smoothstep(e0, e1, x)` | Hermite 插值 | 软边界 | 柔和渐变、SDF 抗锯齿、阴影边缘 |

smoothstep 的内部实现（理解它才能随心塑形）：

```glsl
float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
float result = t * t * (3.0 - 2.0 * t);  // 两端导数为 0，过渡无突兀感
```

配套用法：

* `clamp(x, a, b)` = `min(max(x, a), b)`，把任意值压回安全区间（如颜色输出前防止溢出）

* `mix` 的 `t` 传 `smoothstep(...)` 的结果 = 带缓动的插值，比线性 t 更自然

### 3. 周期函数：fract 与 mod

`fract(x)` 返回小数部分（[0, 1)），`mod(x, y)` 返回 x - y * floor(x/y)。两者关系：`fract(x) = mod(x, 1.0)`。

三大典型用途：

```glsl
// 1. 图案重复：把 UV 切成 n×n 网格，每格独立作画
vec2 cell = fract(uv * 5.0);

// 2. 周期动画：每 1/speed 秒循环一次
float cycle = fract(uTime * 0.5);

// 3. 伪随机数（第 12 课噪声的地基）
float random(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
}
```

棋盘格是 mod + floor 的组合应用：`mod(floor(uv * 8.0).x + floor(uv * 8.0).y, 2.0)`。

### 4. 向量函数的几何意义

| 函数 | 几何意义 | 创意编程典型用途 |
| ------ | -------- | ---------------- |
| `length(v)` | 向量长度 | 距离场（画圆的核心） |
| `distance(a, b)` | 两点距离 | SDF 基础 |
| `dot(a, b)` | 投影；单位向量时 = cosθ | Lambert 光照、Fresnel |
| `cross(a, b)` | 垂直于两向量的向量（右手定则，仅 vec3） | 由切线求面法线 |
| `normalize(v)` | 保持方向、长度归一 | 光照方向、防除零前先判长度 |
| `reflect(i, n)` | i 关于 n 的镜面反射 | 反射高光、水面 |

### 5. 坐标系变换

**UV 居中**：`vec2 centeredUV = uv - 0.5;`（范围 [-0.5, 0.5]），画中心对称图形前必做。

**直角转极坐标**：

```glsl
float r = length(centeredUV);              // 半径
float theta = atan(centeredUV.y, centeredUV.x);  // 角度 [-π, π]
```

极坐标是圆形/花瓣/放射图案的钥匙：

```glsl
float petals = sin(theta * 8.0) * 0.5 + 0.5;   // 8 瓣花
float rings = sin(r * 20.0 - uTime * 3.0);     // 向外扩散的波纹
```

### 6. 用 SDF 画基本形状

「距离 < 半径 → 在图形内」是有符号距离场（SDF）的核心思想：

```glsl
// 圆：到圆心的距离
float d = distance(uv, center);
float circle = smoothstep(radius, radius - 0.01, d);  // 边缘 0.01 抗锯齿

// 矩形：abs 对称到第一象限，两个方向同时满足
vec2 d = abs(uv - center);
float rect = step(d.x, size.x * 0.5) * step(d.y, size.y * 0.5);

// 六边形：√3 方向与 X 方向取最大（六边形 SDF）
vec2 d = abs(uv - center);
float hex = max(dot(d, normalize(vec2(1.0, 1.73))), d.x);
float shape = smoothstep(radius, radius - 0.01, hex);

// 三角形：三条边各是一个半平面，取最大距离（内部为负、外部为正）
float d1 = -p.y - size * 0.5;                       // 底边
float d2 = dot(p, vec2(-0.866, 0.5)) - size * 0.5;  // 左斜边（0.866 ≈ √3/2）
float d3 = dot(p, vec2(0.866, 0.5)) - size * 0.5;   // 右斜边
float d = max(d1, max(d2, d3));
float tri = smoothstep(0.01, -0.01, d);  // edge0 > edge1 反向过渡，内部填色
```

***

## API 速查

| API | 用途 |
| ---- | ---- |
| `mix(a, b, t)` | 线性插值（t 可传入 smoothstep 结果做缓动） |
| `step(edge, x)` | 硬阶跃：x ≥ edge 返回 1，否则 0 |
| `smoothstep(e0, e1, x)` | 平滑阶跃（Hermite 插值），e0 < e1 |
| `clamp(x, a, b)` | 限制值域，min(max(x, a), b) |
| `fract(x)` | 小数部分，[0, 1)，重复图案/周期动画的基础 |
| `mod(x, y)` | 取模，x - y * floor(x/y)，结果与 y 同号 |
| `abs(x)` / `sign(x)` | 绝对值 / 符号（-1、0、+1） |
| `sin(x)` / `cos(x)` | 波动、圆形轨道 |
| `atan(y, x)` | 双参数反正切（同数学 atan2），极坐标角度 |
| `pow(x, y)` | 幂运算（x 必须非负）；伽马/对比度曲线 |
| `exp(x)` | e^x；指数衰减光晕 |
| `length(v)` / `distance(a, b)` | 长度 / 距离（SDF 基础） |
| `dot(a, b)` / `cross(a, b)` | 点积（cosθ）/ 叉积（法线） |
| `normalize(v)` | 归一化（零向量未定义，先判长度） |
| `mat2(c, s, -s, c)` | 2×2 旋转矩阵，列主序填数（第一列 c,s；第二列 -s,c）；用法 `rot * uv`（矩阵乘向量） |

***

## 课程代码结构

五个全屏面板各演示一个主题，顶部下拉可单独查看（all/shapes/gradient/wave/pattern/functions）：

| 面板 | 着色器 | 核心知识点 |
| ---- | ---- | ---- |
| 形状 | `shapesFragmentShader` | distance + smoothstep 画圆/矩形/六边形/三角形（半平面组合） |
| 渐变 | `gradientFragmentShader` | mix + smoothstep 的水平/垂直/径向渐变 |
| 波浪 | `waveFragmentShader` | sin 叠加多频率，频率/振幅可调 |
| 图案 | `patternFragmentShader` | fract 网格重复 + mod 棋盘格，网格大小/速度可调 |
| 函数演示 | `functionsFragmentShader` | clamp/atan/pow/exp/cross/sign 六函数 + mat2 旋转，随时间自动轮播七种效果 |

***

## 常见错误

* **smoothstep 参数顺序写反**：GLSL 规范要求 edge0 < edge1，写反属于未定义行为（不同驱动表现不同，可能全黑或全白）。想要「从 1 到 0」的渐变，应写 `smoothstep(e1, e0, x)` 而不是调换 x 的位置

* **step 参数记反**：是 `step(edge, x)`——第一个参数是边界，第二个是测试值。写成 `step(x, edge)` 渐变直接反转

* **atan 参数顺序**：GLSL 双参数形式是 `atan(y, x)`（与数学 atan2 一致）。写反会导致角度镜像、图案左右翻转

* **极坐标接缝**：theta 在 ±π 处跳变，直接用 `step/mod` 处理 theta 会在左侧出现一条缝。用对称函数（cos/sin/abs(theta)）或对 2π 取 fract 归一化规避

* **pow 的负底数**：`pow(-2.0, 0.5)` 未定义。对可能为负的值先 `abs()`，需要保留正负时用 `sign(x) * pow(abs(x), n)`

* **normalize 零向量**：`normalize(vec2(0.0))` 结果未定义（NaN），距离原点处常出黑点。先 `if (length(v) > 0.0001)` 或加微小偏移

* **忘记输出值域**：`sin(...)` 输出 [-1, 1]，直接赋给颜色会出现负值截断。习惯性 `* 0.5 + 0.5` 映射到 [0, 1]

***

## 相关资源

* [The Book of Shaders — Shaping Functions](https://thebookofshaders.com/05/)

* [Inigo Quilez — 2D SDF 函数](https://iquilezles.org/articles/distfunctions2d/)

* [GLSL 数学函数官方参考](https://www.khronos.org/registry/OpenGL-Refpages/gl4/)

* [Shadertoy — 学习和分享 shader](https://www.shadertoy.com)
