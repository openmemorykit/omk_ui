import { createPageApp } from './bootstrap'
import { createProductionHost } from './infrastructure/host/production-host'
import { createWindowViewport } from './infrastructure/viewport'

const ROOT_SELECTOR = '#omk-ui'
const NO_HOST_WARNING = '[omk_ui] GetParentResourceName is missing: this page only runs inside FiveM'

function start(): void {
  const element = document.querySelector(ROOT_SELECTOR)
  if (element === null) return
  if (__OMK_PREVIEW__) {
    void import('../../preview/main').then((preview) => preview.mountPreview(element))
    return
  }
  const host = createProductionHost(window)
  if (host === null) {
    window.console.warn(NO_HOST_WARNING)
    return
  }
  createPageApp({ host, win: window, viewport: createWindowViewport(window) }).mount(element)
}

start()
