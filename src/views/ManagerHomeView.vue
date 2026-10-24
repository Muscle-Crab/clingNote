<template>
  <ManagerHome :people="people" :loaded="loaded" @open="(p) => router.push(`/manage/${p.ownerUid}`)" @switch="toUser" />
</template>
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ManagerHome from '@/components/pals/ManagerHome.vue';
import { useManagedPeople } from '@/composables/usePals';
import { setMode } from '@/utils/appMode';
const router = useRouter();
const { people, loaded } = useManagedPeople();
onMounted(() => setMode('manager'));
const toUser = () => { setMode('user'); router.push('/home'); };
</script>
