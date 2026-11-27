export function surveyPage(radialSelector) {
  const SKIPPED = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
  const ESSENTIAL = '[data-motion="essential"], .omk-spinner'
  const MS_PER_SECOND = 1000
  const ALPHA_OPAQUE = 1
  const colorOf = (token) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${token})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }
  const roleColors = new Map([[colorOf('--ink'), 'primary'], [colorOf('--ink-2'), 'secondary'], [colorOf('--ink-3'), 'secondary'], [colorOf('--accent-text'), 'accent']])
  const alphaOf = (color) => {
    const match = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)
    return match === null ? ALPHA_OPAQUE : Number(match[1])
  }
  const opacityProduct = (element) => {
    let product = 1
    for (let node = element; node !== null; node = node.parentElement) product *= Number(getComputedStyle(node).opacity)
    return product
  }
  const backgroundsOf = (element) => {
    const layers = []
    for (let node = element; node !== null; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor
      const alpha = alphaOf(color)
      if (alpha > 0) layers.push(color)
      if (alpha === ALPHA_OPAQUE) break
    }
    return layers
  }
  const screenScaleOf = (element) => {
    if (element.closest('svg') === null || typeof element.getScreenCTM !== 'function') return 1
    return element.getScreenCTM()?.a ?? 1
  }
  const isPreviewChrome = (element) => element.closest('[data-surface^="preview-"]:not([data-surface="preview-scene"])') !== null
  const visible = (element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && style.display !== 'none'
  }

  const texts = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const element = node.parentElement
    const content = node.textContent.trim()
    if (element === null || content === '' || SKIPPED.has(element.tagName) || isPreviewChrome(element) || !visible(element) || opacityProduct(element) === 0) continue
    const style = getComputedStyle(element)
    texts.push({ text: content.slice(0, 40), fontSize: parseFloat(style.fontSize) * screenScaleOf(element), role: roleColors.get(style.color) ?? 'other', color: style.color, backgrounds: backgroundsOf(element) })
  }

  const surfaces = [...document.querySelectorAll('[data-surface]')].filter((element) => !isPreviewChrome(element) && element.dataset.surface !== 'preview-scene' && visible(element)).map((element) => {
    const style = getComputedStyle(element)
    return { surface: element.dataset.surface, backgroundColor: style.backgroundColor, opacityProduct: opacityProduct(element), backdropFilter: style.backdropFilter || 'none', filter: style.filter, backgroundImage: style.backgroundImage }
  })

  const boxOf = (element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
  }
  const radialElement = document.querySelector(radialSelector)
  const radial = radialElement === null ? null : boxOf(radialElement)
  const columnElement = document.querySelector('[data-surface="column"]')
  const column = columnElement === null ? null : {
    dimmed: columnElement.hasAttribute('data-dimmed'),
    opacityProduct: opacityProduct(columnElement),
    veilColor: getComputedStyle(columnElement, '::after').backgroundColor,
    veilDisplay: getComputedStyle(columnElement, '::after').display,
  }

  const toMs = (list) => list.split(',').map((item) => (item.trim().endsWith('ms') ? parseFloat(item) : parseFloat(item) * MS_PER_SECOND))
  const animations = []
  let essentialAnimated = 0
  for (const element of document.querySelectorAll('*')) {
    const style = getComputedStyle(element)
    const animated = style.animationName !== 'none'
    const durationsMs = [...(animated ? toMs(style.animationDuration) : []), ...toMs(style.transitionDuration)].filter((duration) => duration > 0)
    const exempt = element.closest(ESSENTIAL) !== null
    if (animated && exempt && element.matches(ESSENTIAL)) essentialAnimated += 1
    if (durationsMs.length > 0) animations.push({ selector: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`, durationsMs, exempt })
  }

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    texts,
    surfaces,
    radial,
    column,
    animations,
    essentialAnimated,
  }
}

export async function settleAnimations() {
  const ESSENTIAL = '[data-motion="essential"], .omk-spinner'
  const finite = document.getAnimations().filter((animation) => {
    const target = animation.effect?.target
    return animation.effect?.getComputedTiming().iterations !== Infinity && !(target instanceof Element && target.closest(ESSENTIAL) !== null)
  })
  await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)))
}

export const PROMPT_RING_FRACTION = 0.62

export function freezePromptRing(fraction, root = document) {
  const RING = '.omk-prompt__ring'
  const animations = root.getAnimations().filter((animation) => animation.effect?.target?.closest?.(RING) != null)
  const totalMs = Math.max(0, ...animations.map((animation) => animation.effect.getComputedTiming().endTime))
  for (const animation of animations) {
    animation.pause()
    animation.currentTime = fraction * totalMs
  }
  return animations.length
}
