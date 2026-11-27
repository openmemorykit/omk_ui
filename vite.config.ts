import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const PREVIEW_MODE = 'preview'
const SIDE_EFFECT_FREE = [/node_modules\/@openmemorykit\//, /\/src\/shared\//]

export default defineConfig(({ mode }) => {
  const preview = mode === PREVIEW_MODE
  return {
    base: './',
    publicDir: '.public',
    plugins: [vue()],
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
      __OMK_PREVIEW__: preview,
    },
    build: {
      target: 'chrome103',
      outDir: preview ? '.preview-dist' : 'omk_ui/web',
      assetsDir: 'assets',
      modulePreload: { polyfill: false },
      emptyOutDir: true,
      rolldownOptions: {
        treeshake: { propertyReadSideEffects: false, unknownGlobalSideEffects: false, moduleSideEffects: SIDE_EFFECT_FREE.map((test) => ({ test, sideEffects: false })) },
      },
    },
  }
})
