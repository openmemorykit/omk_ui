import { createApp, shallowRef, watch, type App as VueApp, type ShallowRef } from 'vue'
import App from './App.vue'
import { createUiStore } from './application/ui-store'
import type { Announcer, Dispatch, HostBridge, UiPorts, UiStore, Viewport, ViewportSize } from './application/ports'
import { themeView } from './application/views/theme-view'
import { UI_CONTEXT, type UiContext } from './components/use-ui'
import { BindingKind, decodeBinding } from './domain/key-map'
import { TimerKind } from './domain/page-commands'
import { isTextEntryActive } from './domain/text-entry'
import type { UiState } from './domain/ui-state'
import { createTranslator } from './i18n/translator'
import { createErrorReporter, installErrorCapture } from './infrastructure/error-capture'
import { createFrameRequester } from './infrastructure/frame-requester'
import { createKeyboardSource } from './infrastructure/input/keyboard-source'
import { createPointerSource } from './infrastructure/input/pointer-source'
import { createLiveAnnouncer } from './infrastructure/live-announcer'
import { createPaintProbe } from './infrastructure/paint-probe'
import { createTextFocus } from './infrastructure/text-focus'
import { applyTheme } from './infrastructure/theme-applier'
import { createTimeoutScheduler } from './infrastructure/timeout-scheduler'
import { createVueStore, type VueStore } from './infrastructure/vue-store'
import { createWindowEvents, type Detach } from './infrastructure/window-events'

export interface PageInputs {
  readonly dispatch: Dispatch
  readonly state: () => UiState
}

export interface PageAppOptions {
  readonly host: HostBridge
  readonly win: Window
  readonly viewport: Viewport
  readonly attachInputs?: (inputs: PageInputs) => Detach
}

export interface PageApp {
  mount(element: Element): void
  dispose(): void
}

const POLITE_REGION = '[role="status"]'
const ASSERTIVE_REGION = '[role="alert"]'

function pushToTalkCodeOf(raw: string): string | null {
  const decoded = decodeBinding(raw)
  return decoded.kind === BindingKind.Known ? decoded.code : null
}

function createPorts(options: PageAppOptions, announcer: Announcer): UiPorts {
  const { host, win } = options
  const raf = (callback: FrameRequestCallback): number => win.requestAnimationFrame(callback)
  const clock = { now: () => win.performance.now() }
  return {
    host,
    scheduler: createTimeoutScheduler({
      setTimeout: (callback, delayMs) => win.setTimeout(callback, delayMs),
      clearTimeout: (handle) => win.clearTimeout(handle),
    }),
    frames: createFrameRequester(raf),
    clock,
    announcer,
    translator: createTranslator((key) => console.warn(`[omk_ui] missing message ${key}`)),
    paint: createPaintProbe(raf, clock.now),
    textFocus: createTextFocus(win.document, createFrameRequester(raf)),
  }
}

function attachSources(options: PageAppOptions, store: UiStore): Detach[] {
  const { win } = options
  const dispatch: Dispatch = (command) => store.dispatch(command)
  const state = (): UiState => store.state()
  const keys = createKeyboardSource(win, dispatch, () => ({
    bindings: state().binding,
    pushToTalkCode: pushToTalkCodeOf(state().binding.pushToTalk),
    textFieldFocused: isTextEntryActive(state()),
  }))
  const pointer = createPointerSource(win, dispatch, () => ({ radialBinding: state().binding.radial }))
  const extra = options.attachInputs?.({ dispatch, state })
  return [keys, pointer, createWindowEvents(win, dispatch), ...(extra === undefined ? [] : [extra])]
}

function createVueApp(options: PageAppOptions, context: UiContext): VueApp {
  const app = createApp(App)
  const report = createErrorReporter((message) => options.host.send(message))
  app.config.errorHandler = (error) => report(error)
  app.provide(UI_CONTEXT, context)
  return app
}

interface Runtime {
  readonly ports: UiPorts
  readonly store: UiStore
  readonly vueStore: VueStore
  readonly size: ShallowRef<ViewportSize>
  readonly app: VueApp
  readonly stopTheme: () => void
  readonly regions: { current: Announcer | null }
}

function createRuntime(options: PageAppOptions): Runtime {
  const regions: Runtime['regions'] = { current: null }
  const ports = createPorts(options, { announce: (text, urgency) => regions.current?.announce(text, urgency) })
  const store = createUiStore(ports)
  const vueStore = createVueStore(store)
  const size = shallowRef(options.viewport.read())
  const context: UiContext = { state: vueStore.state, dispatch: (command) => store.dispatch(command), translate: ports.translator.translate, viewport: size }
  const stopTheme = watch(
    [() => vueStore.state.value.settings, size],
    ([settings, viewport]) => applyTheme(options.win.document.documentElement, themeView(settings, viewport), options.win.document),
    { immediate: true, flush: 'sync' },
  )
  return { ports, store, vueStore, size, app: createVueApp(options, context), stopTheme, regions }
}

export function createPageApp(options: PageAppOptions): PageApp {
  const { host, win } = options
  const runtime = createRuntime(options)
  let detachments: Detach[] = []
  let mounted = false
  let disposed = false

  return {
    mount(element) {
      if (mounted || disposed) return
      mounted = true
      runtime.app.mount(element)
      const polite = element.querySelector<HTMLElement>(POLITE_REGION)
      const assertive = element.querySelector<HTMLElement>(ASSERTIVE_REGION)
      if (polite !== null && assertive !== null) runtime.regions.current = createLiveAnnouncer(polite, assertive)
      detachments = [
        installErrorCapture(win, (message) => host.send(message)),
        options.viewport.listen((next) => void (runtime.size.value = next)),
        ...attachSources(options, runtime.store),
        host.listen((message) => runtime.store.dispatch(message)),
      ]
    },
    dispose() {
      if (disposed) return
      disposed = true
      detachments.forEach((detach) => detach())
      detachments = []
      runtime.stopTheme()
      runtime.vueStore.stop()
      Object.values(TimerKind).forEach((timer) => runtime.ports.scheduler.cancel(timer))
      if (mounted) runtime.app.unmount()
      runtime.regions.current = null
    },
  }
}
