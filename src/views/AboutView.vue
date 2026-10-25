<template>
  <main class="ab" data-test="about-page">
    <section class="ab-card">
      <img :src="logo" width="56" height="56" alt="ClingNote logo" class="ab-logo" />
      <h2 class="ab-h">ClingNote</h2>
      <p class="ab-p">A strict daily system for getting your list done. Pick your hours each morning, lock them in, and earn your streak one finished task at a time.</p>
    </section>
    <section class="ab-card">
      <h3 class="ab-h3">How it works</h3>
      <ul class="ab-list">
        <li><span aria-hidden="true">☀️</span><div><b>Pick your day</b><small>Choose 3 to 12 hours each morning and confirm. Once confirmed, those hours are locked.</small></div></li>
        <li><span aria-hidden="true">✅</span><div><b>Finish the list</b><small>Hit the daily task target before the clock runs out to keep your streak.</small></div></li>
        <li><span aria-hidden="true">🔥</span><div><b>Build streaks</b><small>Earn badges, climb the monthly rankings and invite a manager or pals to keep you honest.</small></div></li>
      </ul>
    </section>
    <section class="ab-card ab-links">
      <router-link to="/support" class="ab-row">💬 <span>Help &amp; support</span><i aria-hidden="true">›</i></router-link>
      <router-link to="/privacy-policy" class="ab-row">🔒 <span>Privacy policy</span><i aria-hidden="true">›</i></router-link>
      <router-link to="/terms" class="ab-row">📄 <span>Terms &amp; conditions</span><i aria-hidden="true">›</i></router-link>
    </section>
    <p class="ab-ver">ClingNote · version {{ version }}</p>
  </main>
</template>

<script setup>
// Public About page (replaces the old admin user list that failed for everyone else).
import logo from '@/assets/clingnote-logo-128@2x.png';
const version = process.env.VUE_APP_VERSION || '1.0';
</script>

<style scoped>
.ab { max-width: 720px; margin: 0 auto; padding: 4px 16px 24px; display: flex; flex-direction: column; gap: 12px; }
.ab-card { background: var(--c-surface, #0C1630); border: 1px solid var(--c-border, #1A2846); border-radius: 18px; padding: 16px; }
.ab-logo { border-radius: 14px; display: block; }
.ab-h { margin: 10px 0 4px; font-size: 22px; font-weight: 800; color: #fff; }
.ab-h3 { margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #fff; }
.ab-p { margin: 0; color: var(--c-text-2, #A9B4CC); font-size: 14.5px; line-height: 1.5; }
.ab-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.ab-list li { display: flex; gap: 12px; align-items: flex-start; } .ab-list li > span { font-size: 20px; }
.ab-list b { display: block; color: #fff; font-size: 14.5px; } .ab-list small { color: var(--c-text-2, #A9B4CC); font-size: 13px; line-height: 1.4; }
.ab-links { padding: 4px 0; }
.ab-row { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 16px; color: #fff; text-decoration: none; font-weight: 600; font-size: 14.5px; }
.ab-row + .ab-row { border-top: 1px solid var(--c-border, #1A2846); } .ab-row span { flex: 1; } .ab-row i { font-style: normal; color: var(--c-text-3, #7180A0); }
.ab-ver { text-align: center; color: var(--c-text-3, #7180A0); font-size: 12px; margin: 4px 0 0; }
</style>
