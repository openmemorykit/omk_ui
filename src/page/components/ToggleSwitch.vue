<script setup lang="ts">
import { PageCommandType } from '../domain/page-commands'
import { useUi } from './use-ui'

const props = defineProps<{ itemId: string; on: boolean }>()
const { dispatch } = useUi()

function click(): void {
  dispatch({ type: PageCommandType.ClickItem, itemId: props.itemId })
}
</script>

<template>
  <span class="omk-switch" :class="{ 'is-on': on }" role="switch" :aria-checked="on" @click.stop="click" />
</template>
