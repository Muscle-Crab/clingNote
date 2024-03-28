<template>
  <nav>
    <router-link to="/">Home</router-link> |
    <router-link to="/about">One Signal</router-link>
  </nav>
  <router-view/>
</template>
<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  const OneSignal = window.OneSignal || [];
  OneSignal.push(() => {
    OneSignal.init({
      appId: "65d866ad-f59c-4557-9d75-4ccf7fe60a47",
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
