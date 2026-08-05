<template>
  <ModalDialog :is-open="isOpen" title="🏷️ Watch New Product" @close="close">
    <form @submit.prevent="handleSubmit" class="modal-form">
      <BaseInput
        id="prod-name"
        v-model="form.name"
        label="Product Name"
        placeholder="e.g. Sony WH-1000XM5 Headphones"
        required
      />

      <BaseInput
        id="prod-url"
        v-model="form.url"
        type="url"
        label="Product Web URL"
        placeholder="https://example.com/product/123"
        required
      />

      <div class="form-row">
        <div class="flex-1">
          <BaseInput
            id="prod-target"
            v-model="form.targetPrice"
            type="number"
            step="0.01"
            label="Target Alert Price ($)"
            placeholder="299.99"
          />
        </div>

        <div class="flex-2">
          <BaseInput
            id="prod-selector"
            v-model="form.selector"
            label="CSS Selector (Optional)"
            placeholder="Auto-detect or e.g. .price-tag"
          />
        </div>
      </div>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="close">Cancel</BaseButton>
      <BaseButton
        variant="primary"
        :href="issueUrl"
        target="_blank"
        rel="noopener noreferrer"
        @click="close"
      >
        Create via GitHub Issue 🚀
      </BaseButton>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import ModalDialog from './ui/ModalDialog.vue'
import BaseInput from './ui/BaseInput.vue'
import BaseButton from './ui/BaseButton.vue'

const props = defineProps<{
  isOpen: boolean
  repoOwner?: string
  repoName?: string
}>()

const emit = defineEmits(['close', 'submitted'])

const form = reactive({
  name: '',
  url: '',
  targetPrice: null as number | null,
  selector: ''
})

const defaultOwner = computed(() => props.repoOwner || 'victorsantiago')
const defaultRepo = computed(() => props.repoName || 'price-keeper')

const issueUrl = computed(() => {
  const title = encodeURIComponent(`[Add Product] ${form.name || 'New Product'}`)
  const body = encodeURIComponent(
`### Product Name
${form.name || 'N/A'}

### Product URL
${form.url || 'N/A'}

### Custom CSS Selector (Optional)
${form.selector || ''}

### Target Price
${form.targetPrice ?? '0'}
`
  )
  return `https://github.com/${defaultOwner.value}/${defaultRepo.value}/issues/new?title=${title}&body=${body}&labels=product-action,add-product`
})

function close() {
  emit('close')
}

function handleSubmit() {
  window.open(issueUrl.value, '_blank')
  close()
}
</script>

<style scoped>
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }
</style>
