/// <reference types="vite/client" />

// 声明图片资源模块的类型，让 TypeScript 识别 import
declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.hdr' {
  const src: string
  export default src
}
