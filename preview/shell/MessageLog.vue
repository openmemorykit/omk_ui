<script setup lang="ts">
import { computed } from 'vue'
import { LogKind, type LogEntry, type LogEvent } from '../runtime/types'

interface Row {
  readonly key: string
  readonly at: number
  readonly label: string
  readonly detail: string
}

const props = defineProps<{ entries: readonly LogEntry[] }>()

const LOG_LIMIT = 200
const DETAIL_LIMIT = 160

function labelOf(event: LogEvent): string {
  switch (event.kind) {
    case LogKind.ToPage:
      return `to page: ${event.message.type}`
    case LogKind.FromPage:
      return `from page: ${event.message.type}`
    case LogKind.Call:
      return `call ${event.owner}: ${event.name}`
    case LogKind.Reply:
      return `reply ${event.owner}`
    default:
      return event.kind
  }
}

const rows = computed<readonly Row[]>(() =>
  props.entries
    .slice(-LOG_LIMIT)
    .map((entry, index) => ({
      key: `${entry.at}-${index}`,
      at: entry.at,
      label: labelOf(entry.event),
      detail: JSON.stringify(entry.event).slice(0, DETAIL_LIMIT),
    }))
    .reverse(),
)
</script>

<template>
  <section class="pv-log" data-surface="preview-log" aria-label="Message log">
    <h2>Messages ({{ rows.length }})</h2>
    <ol>
      <li v-for="row in rows" :key="row.key">
        <span class="pv-at">{{ row.at }} ms</span>
        <strong>{{ row.label }}</strong>
        <code>{{ row.detail }}</code>
      </li>
    </ol>
  </section>
</template>

<style>
.pv-log { display: flex; flex-direction: column; min-height: 0; padding: 0.75rem 1rem; background: #16141f; color: #f4f2f9; font: 1.125rem/1.35 system-ui, sans-serif; }
.pv-log h2 { margin: 0 0 0.5rem; font-size: 1.125rem; }
.pv-log ol { flex: 1; min-height: 0; margin: 0; padding: 0; overflow: auto; list-style: none; }
.pv-log li { display: flex; flex-direction: column; padding: 0.25rem 0; border-bottom: 0.0625rem solid #2b2938; }
.pv-at { color: #c6c1d6; }
.pv-log code { color: #c6c1d6; overflow-wrap: anywhere; }
</style>
