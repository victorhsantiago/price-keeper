<template>
  <section class="toolbar glass-panel">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        :value="searchQuery"
        type="text"
        placeholder="Search by product name or domain..."
        class="search-input"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="filter-controls">
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: currentTab === 'all' }"
          @click="$emit('update:currentTab', 'all')"
        >
          All ({{ totalCount }})
        </button>
        <button
          class="tab-btn"
          :class="{ active: currentTab === 'targetMet' }"
          @click="$emit('update:currentTab', 'targetMet')"
        >
          Target Hit ({{ targetHitCount }})
        </button>
        <button
          class="tab-btn"
          :class="{ active: currentTab === 'drops' }"
          @click="$emit('update:currentTab', 'drops')"
        >
          Price Drops ({{ priceDropCount }})
        </button>
      </div>

      <div class="sort-box">
        <label for="sort-select">Sort:</label>
        <select
          id="sort-select"
          :value="sortBy"
          class="sort-select"
          @change="$emit('update:sortBy', ($event.target as HTMLSelectElement).value)"
        >
          <option value="addedAt">Recently Added</option>
          <option value="name">Name (A-Z)</option>
          <option value="priceAsc">Price: Low to High</option>
          <option value="priceDesc">Price: High to Low</option>
        </select>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  searchQuery: string
  currentTab: 'all' | 'targetMet' | 'drops'
  sortBy: 'addedAt' | 'name' | 'priceAsc' | 'priceDesc'
  totalCount: number
  targetHitCount: number
  priceDropCount: number
}

defineProps<Props>()

defineEmits([
  'update:searchQuery',
  'update:currentTab',
  'update:sortBy'
])
</script>

<style scoped>
.toolbar {
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  padding: 8px 14px;
  border-radius: var(--radius-md);
  flex: 1;
  min-width: 260px;
}

.search-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  width: 100%;
}

.search-input:focus {
  outline: none;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.tab-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.tab-btn.active {
  background: var(--accent-primary);
  color: #ffffff;
}

.sort-box {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.sort-select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: var(--accent-primary);
}
</style>
