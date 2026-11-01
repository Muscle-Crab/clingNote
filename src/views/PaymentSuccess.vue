<template>
  <main class="ps" data-test="payment-success">
    <div class="ps-card">
      <div class="ps-ico" aria-hidden="true">✓</div>
      <p class="ps-lead">Thanks! Your ClingNote Pro is now active.</p>
      <p class="ps-sub">Your streak tools, extra day lengths and Pro features are unlocked.</p>
      <router-link to="/home" class="ps-btn" data-test="payment-success-home">Back to my day</router-link>
    </div>
  </main>
</template>

<script setup>
// Web checkout return page (the page title comes from the shared sub-page header).
</script>

<style scoped>
.ps { max-width: 520px; margin: 0 auto; padding: 0 16px 24px; }
.ps-card { background: var(--c-surface, #0C1630); border: 1px solid var(--c-border, #1A2846); border-radius: 18px; padding: 22px 18px; text-align: center; }
.ps-ico { width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; color: #fff; background: linear-gradient(180deg, #3D8BFF, #2563EB); }
.ps-lead { margin: 0; color: #fff; font-size: 17px; font-weight: 700; }
.ps-sub { margin: 6px 0 18px; color: var(--c-text-2, #A9B4CC); font-size: 14px; line-height: 1.45; }
.ps-btn { display: flex; align-items: center; justify-content: center; min-height: 48px; border-radius: 14px; background: linear-gradient(180deg, #3D8BFF, #2563EB); color: #fff; font-weight: 700; text-decoration: none; }
</style>
