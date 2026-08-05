<template>
  <div class="form-group">
    <label v-if="label" :for="id" class="form-label">
      {{ label }}
      <span v-if="required" class="required-star">*</span>
    </label>
    <input
      :id="id"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :step="step"
      class="form-input"
      @input="onInput"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  id?: string
  modelValue?: string | number | null
  label?: string
  type?: string
  placeholder?: string
  required?: boolean
  step?: string | number
}

defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.type === 'number' ? (target.value === '' ? null : Number(target.value)) : target.value)
}
</script>

<style scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.required-star {
  color: var(--color-danger);
}

.form-input {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: var(--font-body);
  transition: var(--transition-fast);
  width: 100%;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
</style>
