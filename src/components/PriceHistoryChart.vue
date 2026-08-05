<template>
  <div class="chart-container">
    <div v-if="!history || history.length === 0" class="chart-empty">
      No price history available yet.
    </div>
    <div v-else class="chart-wrapper">
      <svg class="chart-svg" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none">
        <!-- Grid lines -->
        <line
          v-if="targetPriceY !== null"
          x1="0"
          :y1="targetPriceY"
          :x2="width"
          :y2="targetPriceY"
          stroke="rgba(245, 158, 11, 0.5)"
          stroke-dasharray="4,4"
          stroke-width="1.5"
        />

        <!-- Area fill under line -->
        <polygon :points="areaPoints" fill="url(#chartGradient)" opacity="0.2" />

        <!-- Price trend line -->
        <polyline
          :points="linePoints"
          fill="none"
          stroke="#06b6d4"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Data points -->
        <circle
          v-for="(point, idx) in chartPoints"
          :key="idx"
          :cx="point.x"
          :cy="point.y"
          r="4"
          :fill="(point.status === 'error' && point.price === null) ? '#f43f5e' : '#06b6d4'"
          stroke="#090d16"
          stroke-width="2"
          class="chart-point"
          @mouseenter="hoverPoint = point"
          @mouseleave="hoverPoint = null"
        />

        <!-- SVG Gradients -->
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0" />
          </linearGradient>
        </defs>
      </svg>

      <!-- Tooltip -->
      <div v-if="hoverPoint" class="chart-tooltip" :style="tooltipStyle">
        <div class="tooltip-date">{{ formatDate(hoverPoint.timestamp) }}</div>
        <div class="tooltip-price">
          {{ hoverPoint.currency }}{{ hoverPoint.price }}
          <span v-if="hoverPoint.status === 'error' && hoverPoint.price === null" class="tooltip-error">(Scrape Error)</span>
        </div>
      </div>

      <div class="chart-legend">
        <span class="legend-item"><span class="dot line-dot"></span> Price</span>
        <span v-if="targetPrice" class="legend-item"><span class="dot target-dot"></span> Target ({{ currency }}{{ targetPrice }})</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface HistoryRecord {
  timestamp: string
  price: number | null
  currency?: string
  status?: string
}

const props = defineProps<{
  history: HistoryRecord[]
  targetPrice?: number
  currency?: string
}>()

const width = 400
const height = 150
const padding = 20

const hoverPoint = ref<any>(null)

const validRecords = computed(() => {
  return (props.history || []).filter(r => r.price !== null && !isNaN(r.price))
})

const minPrice = computed(() => {
  if (validRecords.value.length === 0) return 0
  const prices = validRecords.value.map(r => r.price!)
  if (props.targetPrice) prices.push(props.targetPrice)
  return Math.min(...prices) * 0.95
})

const maxPrice = computed(() => {
  if (validRecords.value.length === 0) return 100
  const prices = validRecords.value.map(r => r.price!)
  if (props.targetPrice) prices.push(props.targetPrice)
  return Math.max(...prices) * 1.05
})

const chartPoints = computed(() => {
  const records = validRecords.value
  if (records.length === 0) return []

  const priceRange = maxPrice.value - minPrice.value || 1
  const stepX = (width - padding * 2) / (records.length > 1 ? records.length - 1 : 1)

  return records.map((record, index) => {
    const x = padding + index * stepX
    const normalizedY = (record.price! - minPrice.value) / priceRange
    const y = height - padding - normalizedY * (height - padding * 2)
    return {
      x,
      y,
      price: record.price,
      currency: record.currency || props.currency || '$',
      timestamp: record.timestamp,
      status: record.status
    }
  })
})

const linePoints = computed(() => {
  return chartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const areaPoints = computed(() => {
  const pts = chartPoints.value
  const firstPoint = pts[0]
  const lastPoint = pts[pts.length - 1]
  if (!firstPoint || !lastPoint) return ''
  const firstX = firstPoint.x
  const lastX = lastPoint.x
  const bottomY = height - padding
  return `${firstX},${bottomY} ${linePoints.value} ${lastX},${bottomY}`
})

const targetPriceY = computed(() => {
  if (!props.targetPrice) return null
  const priceRange = maxPrice.value - minPrice.value || 1
  const normalizedY = (props.targetPrice - minPrice.value) / priceRange
  return height - padding - normalizedY * (height - padding * 2)
})

const tooltipStyle = computed(() => {
  if (!hoverPoint.value) return {}
  const leftPercent = (hoverPoint.value.x / width) * 100
  return {
    left: `${leftPercent}%`,
    top: `${hoverPoint.value.y - 45}px`
  }
})

function formatDate(isoStr: string) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.chart-container {
  width: 100%;
  position: relative;
  margin-top: 12px;
}

.chart-empty {
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-muted);
  padding: 24px;
}

.chart-wrapper {
  position: relative;
  width: 100%;
}

.chart-svg {
  width: 100%;
  height: 120px;
  overflow: visible;
}

.chart-point {
  cursor: pointer;
  transition: r 0.2s ease;
}

.chart-point:hover {
  r: 6;
}

.chart-tooltip {
  position: absolute;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid var(--accent-primary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.tooltip-date {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.tooltip-price {
  font-weight: 700;
  color: var(--text-primary);
}

.tooltip-error {
  color: var(--color-danger);
  font-size: 0.65rem;
}

.chart-legend {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.line-dot {
  background: var(--accent-primary);
}

.target-dot {
  background: var(--color-warning);
}
</style>
