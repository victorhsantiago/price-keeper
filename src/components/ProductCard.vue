<template>
  <div class="product-card glass-panel glass-panel-interactive">
    <!-- Header -->
    <div class="card-header">
      <div class="domain-badge">
        <img :src="faviconUrl" class="favicon" alt="Domain icon" @error="onFaviconError" />
        <span class="domain-name">{{ domain }}</span>
      </div>

      <div class="badges-row">
        <BaseBadge v-if="isHistoricalLow" variant="success">🔥 Lowest Price</BaseBadge>
        <BaseBadge v-else-if="isTargetReached" variant="warning">🎯 Target Hit</BaseBadge>
        <BaseBadge v-if="priceDropPercent > 0" variant="danger">↓ {{ priceDropPercent }}%</BaseBadge>
      </div>
    </div>

    <!-- Product Title & Link -->
    <h3 class="product-title">
      <a :href="product.url" target="_blank" rel="noopener noreferrer" class="product-link">
        {{ product.name }}
      </a>
    </h3>

    <!-- Price Section -->
    <div class="price-section">
      <div class="price-main">
        <span class="currency">{{ currency }}</span>
        <span class="amount">{{ currentPrice !== null ? currentPrice.toFixed(2) : 'N/A' }}</span>
      </div>

      <div class="price-meta">
        <div v-if="lowestPrice !== null" class="meta-item">
          <span class="meta-label">Lowest:</span>
          <span class="meta-val">{{ currency }}{{ lowestPrice.toFixed(2) }}</span>
        </div>

        <div v-if="product.targetPrice" class="meta-item">
          <span class="meta-label">Target:</span>
          <span class="meta-val">{{ currency }}{{ product.targetPrice.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Chart Toggle -->
    <div class="chart-section">
      <button class="chart-toggle-btn" @click="showChart = !showChart">
        <span>{{ showChart ? 'Hide Price History' : 'View Price Trend' }}</span>
        <span class="arrow">{{ showChart ? '▲' : '▼' }}</span>
      </button>

      <PriceHistoryChart
        v-if="showChart"
        :history="history"
        :target-price="product.targetPrice"
        :currency="currency"
      />
    </div>

    <!-- Card Footer -->
    <div class="card-footer">
      <span class="last-checked">Updated {{ lastUpdatedText }}</span>

      <BaseButton
        variant="danger-outline"
        size="sm"
        :href="removeIssueUrl"
        target="_blank"
        rel="noopener noreferrer"
        title="Remove product via GitHub Issue"
      >
        Remove 🗑️
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PriceHistoryChart from './PriceHistoryChart.vue'
import BaseBadge from './ui/BaseBadge.vue'
import BaseButton from './ui/BaseButton.vue'

interface Product {
  id: string
  name: string
  url: string
  selector?: string
  targetPrice?: number
  addedAt?: string
}

interface HistoryRecord {
  timestamp: string
  price: number | null
  currency?: string
  status?: string
}

const props = defineProps<{
  product: Product
  history: HistoryRecord[]
  repoOwner?: string
  repoName?: string
}>()

const showChart = ref(false)
const faviconFailed = ref(false)

const domain = computed(() => {
  try {
    const u = new URL(props.product.url)
    return u.hostname.replace('www.', '')
  } catch {
    return 'Web'
  }
})

const faviconUrl = computed(() => {
  if (faviconFailed.value) return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'
  return `https://www.google.com/s2/favicons?domain=${domain.value}&sz=32`
})

function onFaviconError() {
  faviconFailed.value = true
}

const validHistory = computed(() => {
  return (props.history || []).filter(h => h.price !== null && !isNaN(h.price))
})

const currentRecord = computed(() => {
  const v = validHistory.value
  return v.length > 0 ? (v[v.length - 1] ?? null) : null
})

const currentPrice = computed(() => currentRecord.value?.price ?? null)
const currency = computed(() => currentRecord.value?.currency || '$')

const lowestPrice = computed(() => {
  const v = validHistory.value
  if (v.length === 0) return null
  return Math.min(...v.map(h => h.price!))
})

const initialPrice = computed(() => {
  const v = validHistory.value
  return (v.length > 0 && v[0]) ? v[0].price : null
})

const isHistoricalLow = computed(() => {
  if (currentPrice.value === null || lowestPrice.value === null) return false
  return currentPrice.value <= lowestPrice.value
})

const isTargetReached = computed(() => {
  if (currentPrice.value === null || !props.product.targetPrice) return false
  return currentPrice.value <= props.product.targetPrice
})

const priceDropPercent = computed(() => {
  if (currentPrice.value === null || initialPrice.value === null || initialPrice.value === 0) return 0
  if (currentPrice.value >= initialPrice.value) return 0
  return Math.round(((initialPrice.value - currentPrice.value) / initialPrice.value) * 100)
})

const lastUpdatedText = computed(() => {
  if (!currentRecord.value?.timestamp) return 'Never'
  const d = new Date(currentRecord.value.timestamp)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})

const defaultOwner = computed(() => props.repoOwner || 'victorsantiago')
const defaultRepo = computed(() => props.repoName || 'price-keeper')

const removeIssueUrl = computed(() => {
  const title = encodeURIComponent(`[Remove Product] ${props.product.name}`)
  const body = encodeURIComponent(
`### Product ID
${props.product.id}

### Product URL
${props.product.url}
`
  )
  return `https://github.com/${defaultOwner.value}/${defaultRepo.value}/issues/new?title=${title}&body=${body}&labels=product-action,remove-product`
})
</script>

<style scoped>
.product-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.domain-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.favicon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.badges-row {
  display: flex;
  gap: 6px;
}

.product-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 14px;
  line-height: 1.3;
}

.product-link {
  color: var(--text-primary);
  text-decoration: none;
  transition: var(--transition-fast);
}

.product-link:hover {
  color: var(--accent-primary);
}

.price-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.price-main {
  display: flex;
  align-items: baseline;
  color: var(--text-primary);
}

.currency {
  font-size: 1rem;
  font-weight: 600;
  color: var(--accent-primary);
  margin-right: 2px;
}

.amount {
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.price-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.meta-item {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.meta-label {
  color: var(--text-muted);
  margin-right: 4px;
}

.meta-val {
  font-weight: 600;
  color: var(--text-primary);
}

.chart-section {
  margin-bottom: 14px;
}

.chart-toggle-btn {
  width: 100%;
  background: transparent;
  border: 1px dashed var(--border-color);
  color: var(--text-secondary);
  font-size: 0.75rem;
  padding: 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  transition: var(--transition-fast);
}

.chart-toggle-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: rgba(6, 182, 212, 0.05);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 0.75rem;
}
</style>
