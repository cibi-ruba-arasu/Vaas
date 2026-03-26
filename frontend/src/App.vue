<script setup>
import { RouterView } from 'vue-router'
import { Analytics } from '@vercel/analytics/vue'
</script>

<template>
  <Analytics />
  <router-view />
</template>

<style>
  body, html, #app {
    margin: 0;
    scrollbar-width: none;
    border: none;;
  }
</style>
