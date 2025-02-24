<template>
  <div>
    <button @click="getPlayerId">Get Player ID</button>
    <p v-if="playerId">Player ID: {{ playerId }}</p>
  </div>
</template>

<script>
export default {
  data() {
    return {
      playerId: null
    };
  },
  mounted() {
    this.initializeOneSignal();
  },
  methods: {
    async initializeOneSignal() {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({
          appId: "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
          safari_web_id: "web.onesignal.auto.2068edc0-2ec7-4d8d-bc37-83913e3acbff",
          notifyButton: {
            enable: true
          }
        });
      });
    },
    async getPlayerId() {
      if (window.OneSignal) {
        const playerId = await window.OneSignal.getUserId();
        this.playerId = playerId;
        console.log("Player ID:", playerId);
      } else {
        console.error("OneSignal is not initialized yet.");
      }
    }
  }
};
</script>
