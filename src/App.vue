<template>
  <nav>
    <router-link to="/">Home</router-link> |
    <router-link to="/about">About</router-link>
  </nav>
  <router-view/>
</template>
<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  const OneSignal = window.OneSignal || [];
  OneSignal.push(() => {
    OneSignal.init({
      appId: "c9aceaa3-3b9b-453c-a3e3-e28dcea47b48",
      safari_web_id: "web.onesignal.auto.599df49f-4478-46e8-9089-3c95d63b63cf",
      notifyButton: {
        enable: true,
      },
      subdomainName: "1gtfwsaafsds",
    });
  });
});
</script>
<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

nav {
  padding: 30px;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
}

nav a.router-link-exact-active {
  color: #42b983;
}
</style>
