import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // 相对路径：构建产物放到任意静态目录（含子路径）都能直接跑
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3300,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        // three / gsap 体量大且很少变动，拆成独立 chunk：
        // 业务代码改动不使库缓存失效，浏览器可以长期复用。
        // Vite 8（rolldown）的 manualChunks 只接受函数形式
        manualChunks(id: string) {
          if (id.includes('gsap')) return 'gsap'
          if (id.includes('node_modules') && id.includes('three')) return 'three'
        },
      },
    },
  },
})
