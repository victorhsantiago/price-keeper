<template>
  <component
    :is="isLink ? 'a' : 'button'"
    :href="href"
    :type="isLink ? undefined : type"
    :class="['btn', `btn-${variant}`, size ? `btn-${size}` : '']"
    v-bind="$attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger-outline'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  href?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  type: 'button'
})

const isLink = computed(() => !!props.href)
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: var(--transition-fast);
  text-decoration: none;
  font-family: var(--font-body);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 0.75rem;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 1rem;
}

.btn-primary {
  background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%);
  color: #ffffff;
  box-shadow: 0 4px 14px var(--accent-glow);
}

.btn-primary:hover {
  filter: brightness(1.1);
  box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-danger-outline {
  background: transparent;
  color: var(--color-danger);
  border-color: rgba(244, 63, 94, 0.3);
}

.btn-danger-outline:hover {
  background: rgba(244, 63, 94, 0.1);
  border-color: var(--color-danger);
}
</style>
