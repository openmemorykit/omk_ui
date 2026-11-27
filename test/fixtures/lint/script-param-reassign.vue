<script setup lang="ts">
function bump(item: { count: number }): void {
  item.count += 1
}
bump({ count: 0 })
</script>

<template>
  <p />
</template>
