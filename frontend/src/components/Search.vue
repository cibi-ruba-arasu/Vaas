<script setup>
import { useRoute } from "vue-router";
const route = useRoute();
</script>

<template>
  <div class="search-page-container">
    <h1>Search Results for: "{{ route.query.q }}"</h1>
    <p>Full search functionality coming soon...</p>
  </div>
</template>

<style scoped>
.search-page-container {
    min-height: 100vh;
    background: #020617;
    color: white;
    padding: 100px 5%;
    text-align: center;
    font-family: 'Cinzel', serif;
}
</style>