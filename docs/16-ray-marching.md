# 第 16 课技术笔记：Ray Marching & SDF 实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. SDF（有符号距离场）

到最近表面的距离。正=外部，负=内部，零=表面上。

```glsl
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
```

### 2. Ray Marching 原理

从相机沿光线方向步进，每次步进 SDF 距离（安全距离，不会穿过表面）。

```glsl
float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 100; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) break;  // 击中
    t += d;
    if (t > 50.0) break;   // 超出范围
  }
  return t;
}
```

### 3. SDF 布尔运算

```glsl
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtraction(float d1, float d2) { return max(-d1, d2); }
float opIntersection(float d1, float d2) { return max(d1, d2); }
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}
```

**为什么三个公式只需要 min/max？** 关键在 SDF 的符号约定：负值 = 在内部，布尔运算是对「内部区域」做集合运算：

- **并集 = min**：点在并集内部 = 至少在一个形状内部。min 只要有一个参数为负结果就为负，零等值面自动变成两形状边界的拼接。
- **交集 = max**：点在交集内部 = 同时在两个内部。max 要求两个参数都为负结果才为负。
- **差集 = max(-d1, d2)**：「在 d2 内部」且「不在 d1 内部」。-d1 把 d1 内外翻转——原本 d1 内部的负值区域变成正值（视为外部），就被挖掉了。注意方向：**第二个参数是被挖的物体**。

**本课演示**：`uShapeMode` uniform 切换四种形态（面板下拉）：并集（硬拼接）/ 平滑并集（交界融化，默认）/ 交集（球盒重叠的透镜状嵌块）/ 差集（盒面被挖出碗形凹坑）。交集/差集模式下挖具球定义在盒子局部空间（`rotP`）并跟随旋转、半径取盒半边长的 0.6 倍嵌在盒面上——两形状必须真正重叠，否则交集是空集（max 处处为正，物体直接消失）。

### 4. 法线计算（有限差分法）

在击点附近采样 4 次 SDF，用梯度近似法线方向。

```glsl
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}
```

### 5. 软阴影（Inigo Quilez 方法）

从击点向光源方向步进，检查是否被遮挡。k 控制柔和度。

### 6. 环境光遮蔽（AO）

在击点法线方向多次采样 SDF，距离越近 → 被遮挡越多 → 越暗。

---

## API 速查

| API | 用途 |
|-----|------|
| `length(p)` | 向量长度（球体 SDF 基础） |
| `abs(p)` | 绝对值（利用对称性） |
| `max(a, b)` / `min(a, b)` | 布尔运算基础 |
| `clamp(x, a, b)` | 钳制到范围 |
| `mix(a, b, t)` | 线性插值（smooth union） |
| `normalize(v)` | 归一化（法线计算） |
| `reflect(I, N)` | 反射向量 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| sdSphere/sdBox/sdTorus | SDF 基本形状 | 距离场数学 |
| opSmoothUnion | 平滑布尔运算 | smin 插值 |
| map | 场景 SDF，uShapeMode 切换四种布尔形态 | 布尔运算组合 + 局部空间重叠 |
| rayMarch | 光线步进主循环 | 安全步进距离 |
| calcNormal | 法线计算 | 有限差分法 |
| softShadow | 软阴影 | 光线步进 + 遮挡检测 |
| calcAO | 环境光遮蔽 | 近处采样 |

---

## 常见错误

- 步进次数太少（<50）→ 复杂场景有噪点/空洞
- epsilon 太大（>0.01）→ 表面有锯齿
- maxDist 太小 → 远处物体被截断
- 忘记 normalize 法线 → 光照计算错误
- 交集/差集的两形状不重叠 → 交集是空集（max 处处为正，物体直接消失）
- opSubtraction 参数顺序写反 → 挖反方向（第二个参数才是被挖的物体）

---

## 相关资源

- [Inigo Quilez — SDF 函数大全](https://iquilezles.org/articles/distfunctions/)
- [Inigo Quilez — Ray Marching](https://iquilezles.org/articles/raymarchingdfs/)
- [Shadertoy — Ray Marching 教程](https://www.shadertoy.com/view/XlGBzG)
