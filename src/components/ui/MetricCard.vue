<template>
  <div class="metric-card glass-panel">
    <div class="metric-icon">{{ icon }}</div>
    <div class="metric-info">
      <span :class="['metric-value', textVariant ? `text-${textVariant}` : '']">
        {{ value }}
      </span>
      <span class="metric-label">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  icon: string
  value: string | number
  label: string
  textVariant?: 'danger' | 'success' | 'cyan' | 'warning'
}

defineProps<Props>()
</script>

<style scoped>
.metric-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.metric-icon {
  font-size: 2rem;
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
}

.metric-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.text-danger { color: var(--color-danger); }
.text-success { color: var(--color-success); }
.text-cyan { color: var(--accent-primary); }
.text-warning { color: var(--color-warning); }
</style>
