<template>
  <div class="pl" data-test="manager-home">
    <header class="pl-head">
      <div class="pl-kicker">Manager mode</div>
      <h1>People you manage</h1>
    </header>
    <div v-if="!loaded" class="pl-card pl-muted">Loading…</div>
    <div v-else-if="!people.length" class="pl-card" data-test="manager-empty">
      <h2>No one yet</h2>
      <p class="pl-muted">To manage someone, ask them to open ClingNote → <b>Manager &amp; Pals → Manager</b> and send you their manager link. Open the link, tap <b>Sign in to connect</b>, and they'll show up here.</p>
      <button class="pl-btn" style="margin-top:12px" @click="$emit('switch')">Back to User mode</button>
    </div>
    <ul v-else class="mh-list">
      <li v-for="p in people" :key="p.ownerUid">
        <button class="mh-row" @click="$emit('open', p)" data-test="managed-person">
          <span class="mh-av">{{ (p.ownerName || '?').slice(0, 1).toUpperCase() }}</span>
          <span class="mh-main"><span class="mh-name">{{ p.ownerName }}</span><span class="pl-small">{{ p.open }} to do</span></span>
          <span v-if="p.overdue" class="mh-badge red" :title="`${p.overdue} overdue`">{{ p.overdue }} overdue</span>
          <span v-if="p.unread" class="mh-badge blue" :title="`${p.unread} unread`">{{ p.unread }} new</span>
          <span class="mh-chev">›</span>
        </button>
      </li>
    </ul>
  </div>
</template>
<script setup>
import './pals.css';
defineProps({ people: { type: Array, default: () => [] }, loaded: Boolean });
defineEmits(['open', 'switch']);
</script>
<style scoped>
.mh-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.mh-row { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); border: 1px solid #2A3C66; border-radius: 14px; padding: 12px; color: #F2F5FC; }
.mh-av { flex: none; width: 40px; height: 40px; border-radius: 50%; background: #1B2D57; color: #8FB4FF; display: grid; place-items: center; font-weight: 800; }
.mh-main { flex: 1; min-width: 0; display: flex; flex-direction: column; } .mh-name { font-weight: 700; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh-badge { flex: none; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 8px; }
.mh-badge.red { background: #2E1517; color: #F87171; } .mh-badge.blue { background: #13245A; color: #8FB4FF; }
.mh-chev { color: #7180A0; font-size: 22px; }
</style>
