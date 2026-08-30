# 第 17 课技术笔记：滚动驱动动画实现细节

> 日期：2026-08-26
> 状态：进行中
> 评分：待定

---

## 核心概念

### 1. GSAP ScrollTrigger

监听滚动位置，驱动 CSS/JS 动画。

```typescript
gsap.registerPlugin(ScrollTrigger)
gsap.to(obj.position, {
  z: 10,
  scrollTrigger: {
    trigger: '#section-1',  // 触发元素
    start: 'top center',    // 开始条件
    end: 'bottom center',   // 结束条件
    scrub: 0.5,             // 动画延迟跟随
  },
})
```

### 2. scrub 参数

- `scrub: true` → 动画进度与滚动位置完全同步
- `scrub: 0.5` → 动画有 0.5 秒延迟跟随（更平滑）
- `scrub: false` → 触发后立即播放（不跟滚动同步）

### 3. canvas 固定 + HTML 滚动

```css
#canvas { position: fixed; top: 0; left: 0; z-index: -1; }
#content { position: relative; z-index: 1; }
```

canvas 始终在背景，HTML 内容在前景滚动。

### 4. 视差效果

不同元素以不同速度跟随滚动：前景快、背景慢。

---

## API 速查

| API | 用途 |
|-----|------|
| `gsap.registerPlugin(ScrollTrigger)` | 注册插件 |
| `scrollTrigger.trigger` | 触发元素选择器 |
| `scrollTrigger.start` / `end` | 触发区域 |
| `scrollTrigger.scrub` | 滚动同步模式 |
| `gsap.from()` | 从目标值动画到当前值 |
| `gsap.to()` | 从当前值动画到目标值 |

---

## 课程代码结构

| 模块 | 功能 | 核心知识点 |
|------|------|-----------|
| Section 1 动画 | 物体飞入 | gsap.from + scrub |
| Section 2 动画 | 物体旋转 | gsap.to rotation |
| Section 3 动画 | 物体缩放 | gsap.to scale |
| Section 4 动画 | 相机移动 | gsap.to camera.position |

---

## 常见错误

- 忘记 `gsap.registerPlugin(ScrollTrigger)` → ScrollTrigger 不生效
- canvas 用 `position: absolute` 而非 `fixed` → 滚动时 canvas 也跟着走
- 忘记 `ScrollTrigger.refresh()` → 动态内容变化后触发区域错位
- scrub 值太大 → 动画严重滞后，用户体验差

---

## 相关资源

- [GSAP ScrollTrigger 文档](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [Three.js + GSAP 集成示例](https://threejs-journey.com)
