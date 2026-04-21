<script setup>
const loading = false;
const items = [];
</script>

<template>
  <main>
    <p v-if="loading">Loading</p>
    <p v-else-if="items.length === 0">No items found</p>
    <form>
      <input name="email" />
    </form>
  </main>
</template>