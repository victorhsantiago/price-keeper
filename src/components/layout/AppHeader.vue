<template>
  <header class="header glass-panel">
    <div class="header-brand">
      <div class="logo-icon">🏷️</div>
      <div>
        <h1 class="brand-title">PriceKeeper</h1>
        <p class="brand-subtitle">GitHub-Native Serverless Price Tracker</p>
      </div>
    </div>

    <div class="header-actions">
      <BaseButton
        variant="secondary"
        :href="`https://github.com/${repoOwner}/${repoName}/actions/workflows/price-tracker.yml`"
        target="_blank"
        rel="noopener noreferrer"
        title="Run Scraper Workflow on GitHub"
      >
        ⚡ Run Scraper
      </BaseButton>

      <BaseButton variant="primary" @click="$emit('open-add-modal')">
        + Watch Product
      </BaseButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import BaseButton from '../ui/BaseButton.vue'

defineProps<{
  repoOwner: string
  repoName: string
}>()

defineEmits(['open-add-modal'])
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 28px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-icon {
  font-size: 2.2rem;
  background: rgba(6, 182, 212, 0.15);
  padding: 8px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-highlight);
}

.brand-title {
  font-size: 1.75rem;
  font-weight: 800;
  background: linear-gradient(135deg, #ffffff 0%, var(--accent-primary) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
