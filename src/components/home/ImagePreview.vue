<template>
  <div class="image-preview-overlay" @click="$emit('close')">
    <img :src="src" class="image-preview-img" />
  </div>
</template>

<script setup>
defineProps({ src: { type: String, default: '' } });
defineEmits(['close']);
</script>

<style scoped>
.image-preview-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.9);
  z-index: 400;
  display: flex; align-items: center; justify-content: center;
  cursor: zoom-out;
}
.image-preview-img { max-width: 90%; max-height: 90vh; border-radius: 12px; }
</style>
