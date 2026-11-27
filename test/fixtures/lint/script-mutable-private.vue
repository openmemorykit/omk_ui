<script setup lang="ts">
class Counter {
  private count = 0
  read(): number {
    return this.count
  }
}
const value = new Counter().read()
</script>

<template>
  <p>{{ value }}</p>
</template>
