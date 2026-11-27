declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare const __OMK_PREVIEW__: boolean

interface Window {
  ui?: import('../preview/shell/console-api').ConsoleApi
}
