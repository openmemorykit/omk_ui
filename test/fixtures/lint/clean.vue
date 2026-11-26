<script setup lang="ts">
import { computed, inject, shallowRef } from 'vue'

const props = defineProps<{ label: string; items: readonly { id: string; name: string }[] }>()
const emit = defineEmits<{ pick: [id: string] }>()
const injected = inject<number>('key', 0)
const state = shallowRef(0)
const doubled = computed(() => state.value + injected + props.label.length)

function pick(id: string): void {
  emit('pick', id)
}
</script>

<template>
  <ul>
    <li v-for="item in items" :key="item.id" @click="pick(item.id)">{{ item.name }} {{ doubled }}</li>
  </ul>
</template>
