<script setup lang="ts">
import { computed } from 'vue'
import { IconName, NotificationTone } from '@openmemorykit/ui/contract'
import { toastsView } from '../application/views/toast-view'
import { themeView } from '../application/views/theme-view'
import { ICON_PATHS } from '../theme/icons'
import { useUi } from './use-ui'

const ui = useUi()
const view = computed(() => toastsView(ui.state.value, ui.translate))
const columnSide = computed(() => themeView(ui.state.value.settings, ui.viewport.value).side)

const TONE_ICON: ReadonlyMap<NotificationTone, IconName> = new Map([
  [NotificationTone.Info, IconName.Info],
  [NotificationTone.Success, IconName.Check],
  [NotificationTone.Warning, IconName.Warning],
  [NotificationTone.Error, IconName.Close],
])

function iconPaths(tone: NotificationTone): readonly string[] {
  const name = TONE_ICON.get(tone)
  return name === undefined ? [] : ICON_PATHS[name]
}
</script>

<template>
  <div class="omk-toasts" :data-column-side="columnSide">
    <div v-for="toast in view.toasts" :key="toast.id" class="omk-toast omk-anim-slide" data-surface="toast" :data-tone="toast.tone">
      <span class="omk-toast__mark">
        <svg class="omk-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-for="path in iconPaths(toast.tone)" :key="path" :d="path" />
        </svg>
      </span>
      <div class="omk-toast__body">
        <span class="omk-toast__tone">{{ toast.toneLabel }}</span>
        <span class="omk-toast__title">{{ toast.title }}</span>
        <p v-if="toast.text !== null" class="omk-secondary omk-toast__text">{{ toast.text }}</p>
      </div>
    </div>
  </div>
</template>

<style>
.omk-toasts {
  position: fixed;
  top: var(--column-edge);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: var(--toast-width);
  contain: layout;
}

.omk-toasts[data-column-side="left"] {
  right: 4rem;
  --slide-from: var(--space-7);
}

.omk-toasts[data-column-side="right"] {
  left: 4rem;
  --slide-from: calc(-1 * var(--space-7));
}

.omk-toast {
  display: flex;
  align-items: stretch;
  box-shadow: var(--shadow-toast);
  --tone: var(--info);
}

.omk-toast[data-tone="success"] {
  --tone: var(--success);
}

.omk-toast[data-tone="warning"] {
  --tone: var(--warning);
}

.omk-toast[data-tone="error"] {
  --tone: var(--error);
}

.omk-toast__mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 3rem;
  background-color: var(--tone);
  color: var(--tone-ink);
}

.omk-toast__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-4) var(--space-6);
}

.omk-toast__tone {
  color: var(--tone);
  font-size: var(--text-min);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--tracking-caps);
  line-height: var(--leading-tight);
  text-transform: uppercase;
}

.omk-toast__title {
  font-size: var(--text-emphasis);
  font-weight: var(--font-weight-bold);
  line-height: var(--leading-text);
}

.omk-toast__text {
  margin: 0;
}
</style>
