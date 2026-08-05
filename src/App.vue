<template>
  <div class="app-container">
    <!-- App Header Layout -->
    <AppHeader
      :repo-owner="repoOwner"
      :repo-name="repoName"
      @open-add-modal="isAddModalOpen = true"
    />

    <!-- Main Content -->
    <main class="main-content">
      <!-- Summary Metrics Bar -->
      <section class="metrics-grid">
        <MetricCard icon="📦" :value="products.length" label="Watched Products" />
        <MetricCard icon="🚨" :value="activePriceDropsCount" label="Active Price Drops" text-variant="danger" />
        <MetricCard icon="🔥" :value="historicalLowsCount" label="Historical Lows" text-variant="success" />
        <MetricCard icon="⏱️" value="6 Hours" label="Scrape Schedule" text-variant="cyan" />
      </section>

      <!-- Filter & Search Toolbar Layout -->
      <AppToolbar
        v-model:searchQuery="searchQuery"
        v-model:currentTab="currentTab"
        v-model:sortBy="sortBy"
        :total-count="products.length"
        :target-hit-count="targetHitProducts.length"
        :price-drop-count="priceDropProducts.length"
      />

      <!-- Loading State -->
      <div v-if="isLoading" class="state-container glass-panel">
        <div class="spinner"></div>
        <p>Loading tracked products data...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredProducts.length === 0" class="state-container glass-panel">
        <div class="empty-icon">🔍</div>
        <h3>No Products Found</h3>
        <p v-if="searchQuery || currentTab !== 'all'">
          No tracked products match your current search or filter criteria.
        </p>
        <p v-else>
          You haven't added any products to watch yet!
        </p>
        <BaseButton variant="primary" class="mt-4" @click="isAddModalOpen = true">
          + Add Your First Product
        </BaseButton>
      </div>

      <!-- Products Grid -->
      <section v-else class="products-grid">
        <ProductCard
          v-for="prod in filteredProducts"
          :key="prod.id"
          :product="prod"
          :history="historyMap[prod.id] || []"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
      </section>
    </main>

    <!-- Add Product Modal -->
    <AddProductModal
      :is-open="isAddModalOpen"
      :repo-owner="repoOwner"
      :repo-name="repoName"
      @close="isAddModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProductCard from './components/ProductCard.vue'
import AddProductModal from './components/AddProductModal.vue'
import MetricCard from './components/ui/MetricCard.vue'
import BaseButton from './components/ui/BaseButton.vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppToolbar from './components/layout/AppToolbar.vue'

interface Product {
  id: string
  name: string
  url: string
  selector?: string
  targetPrice?: number
  active?: boolean
  addedAt?: string
}

interface HistoryRecord {
  timestamp: string
  price: number | null
  currency?: string
  status?: string
}

const repoOwner = 'victorsantiago'
const repoName = 'price-keeper'

const products = ref<Product[]>([])
const historyMap = ref<Record<string, HistoryRecord[]>>({})
const isLoading = ref(true)

const searchQuery = ref('')
const currentTab = ref<'all' | 'targetMet' | 'drops'>('all')
const sortBy = ref<'addedAt' | 'name' | 'priceAsc' | 'priceDesc'>('addedAt')

const isAddModalOpen = ref(false)

async function loadData() {
  isLoading.value = true
  const baseUrl = import.meta.env.BASE_URL || './'
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'

  try {
    const productsRes = await fetch(`${cleanBase}data/products.json?t=${Date.now()}`)
      .catch(() => fetch('./data/products.json'))
      .catch(() => fetch('data/products.json'))
    if (productsRes && productsRes.ok) {
      products.value = await productsRes.json()
    }
  } catch (err) {
    console.warn('Could not fetch products.json:', err)
  }

  try {
    const historyRes = await fetch(`${cleanBase}data/history.json?t=${Date.now()}`)
      .catch(() => fetch('./data/history.json'))
      .catch(() => fetch('data/history.json'))
    if (historyRes && historyRes.ok) {
      historyMap.value = await historyRes.json()
    }
  } catch (err) {
    console.warn('Could not fetch history.json:', err)
  }

  isLoading.value = false
}

onMounted(() => {
  loadData()
})

const getLatestPrice = (productId: string): number | null => {
  const records = (historyMap.value[productId] || []).filter(r => r.price !== null && !isNaN(r.price))
  const lastRecord = records[records.length - 1]
  return lastRecord ? lastRecord.price : null
}

const getInitialPrice = (productId: string): number | null => {
  const records = (historyMap.value[productId] || []).filter(r => r.price !== null && !isNaN(r.price))
  const firstRecord = records[0]
  return firstRecord ? firstRecord.price : null
}

const getLowestPrice = (productId: string): number | null => {
  const records = (historyMap.value[productId] || []).filter(r => r.price !== null && !isNaN(r.price))
  if (records.length === 0) return null
  return Math.min(...records.map(r => r.price!))
}

const targetHitProducts = computed(() => {
  return products.value.filter(p => {
    const price = getLatestPrice(p.id)
    return price !== null && p.targetPrice && price <= p.targetPrice
  })
})

const priceDropProducts = computed(() => {
  return products.value.filter(p => {
    const latest = getLatestPrice(p.id)
    const initial = getInitialPrice(p.id)
    return latest !== null && initial !== null && latest < initial
  })
})

const activePriceDropsCount = computed(() => priceDropProducts.value.length)

const historicalLowsCount = computed(() => {
  return products.value.filter(p => {
    const latest = getLatestPrice(p.id)
    const lowest = getLowestPrice(p.id)
    return latest !== null && lowest !== null && latest <= lowest
  }).length
})

const filteredProducts = computed(() => {
  let list = [...products.value]

  // Filter tab
  if (currentTab.value === 'targetMet') {
    list = targetHitProducts.value
  } else if (currentTab.value === 'drops') {
    list = priceDropProducts.value
  }

  // Search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.url.toLowerCase().includes(q))
  }

  // Sort
  list.sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name)
    } else if (sortBy.value === 'priceAsc') {
      const pA = getLatestPrice(a.id) ?? Infinity
      const pB = getLatestPrice(b.id) ?? Infinity
      return pA - pB
    } else if (sortBy.value === 'priceDesc') {
      const pA = getLatestPrice(a.id) ?? -1
      const pB = getLatestPrice(b.id) ?? -1
      return pB - pA
    } else {
      // addedAt
      return new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime()
    }
  })

  return list
})
</script>

<style scoped>
.app-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.state-container {
  padding: 60px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 3rem;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.mt-4 { margin-top: 16px; }
</style>
