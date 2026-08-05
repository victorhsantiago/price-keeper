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

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="isSubmitting" @click="close">Cancel</BaseButton>
      <BaseButton
        variant="primary"
        :disabled="isSubmitting"
        @click="handleSubmit"
      >
        {{ isSubmitting ? 'Saving...' : 'Add Product 🚀' }}
      </BaseButton>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import ModalDialog from './ui/ModalDialog.vue'
import BaseInput from './ui/BaseInput.vue'
import BaseButton from './ui/BaseButton.vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close', 'product-added'])

const isSubmitting = ref(false)
const errorMessage = ref('')

const form = reactive({
  name: '',
  url: '',
  targetPrice: null as number | null,
  selector: ''
})

function close() {
  errorMessage.value = ''
  emit('close')
}

async function handleSubmit() {
  if (!form.name || !form.url) {
    errorMessage.value = 'Please fill out both product name and URL.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  if (isSupabaseConfigured && supabase) {
    const id = `prod_${Date.now()}`
    const { error } = await supabase.from('products').insert({
      id,
      name: form.name,
      url: form.url,
      selector: form.selector || '',
      target_price: form.targetPrice ? Number(form.targetPrice) : 0,
      active: true,
      added_at: new Date().toISOString()
    })

    if (error) {
      console.error('Failed to add product to Supabase:', error.message)
      errorMessage.value = `Failed to save product: ${error.message}`
      isSubmitting.value = false
      return
    }
  }

  form.name = ''
  form.url = ''
  form.targetPrice = null
  form.selector = ''
  isSubmitting.value = false

  emit('product-added')
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

.error-text {
  color: var(--accent-danger, #ef4444);
  font-size: 0.85rem;
  margin-top: 4px;
}
</style>
