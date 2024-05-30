<template>
  <div class="not-found">
    <h1>404 - Page Not Found</h1>
    <p>Looks like you've followed a broken link or entered a URL that doesn't exist on this site.</p>
    <router-link to="/">Back to our site</router-link>
  </div>
</template>

<script>
export default {
  name: 'NotFoundComponent'
};
</script>

<style scoped>
.not-found {
  text-align: center;
  padding: 50px;
}
</style>
