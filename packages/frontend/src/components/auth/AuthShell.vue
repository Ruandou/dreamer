<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { DocumentTextOutline, VideocamOutline, LayersOutline, CutOutline } from '@vicons/ionicons5'
import { AUTH_PLATFORM } from '@/lib/auth-platform'

const iconMap = {
  script: DocumentTextOutline,
  video: VideocamOutline,
  pipeline: LayersOutline,
  compose: CutOutline
} as const
</script>

<template>
  <div class="auth-shell">
    <div class="auth-shell__bg" aria-hidden="true" />
    <div class="auth-shell__inner">
      <aside class="auth-intro" aria-labelledby="auth-platform-heading">
        <div class="auth-intro__brand">
          <img src="/images/dreamer-logo.png" alt="Dreamer" class="auth-intro__logo" />
          <div>
            <p class="auth-intro__product">{{ AUTH_PLATFORM.product }}</p>
            <h1 id="auth-platform-heading" class="auth-intro__title">{{ AUTH_PLATFORM.title }}</h1>
          </div>
        </div>
        <p class="auth-intro__tagline">{{ AUTH_PLATFORM.tagline }}</p>
        <ul class="auth-intro__list">
          <li v-for="item in AUTH_PLATFORM.features" :key="item.key" class="auth-intro__item">
            <span class="auth-intro__icon" aria-hidden="true">
              <NIcon :component="iconMap[item.key]" :size="22" />
            </span>
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </aside>
      <main class="auth-form-wrap">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.auth-shell {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: clamp(1.25rem, 4vw, 2.5rem);
  background: #1a1332;
  overflow-x: hidden;
}

.auth-shell__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 20% 20%, rgba(124, 92, 255, 0.45), transparent 55%),
    radial-gradient(ellipse 100% 70% at 85% 75%, rgba(236, 72, 153, 0.35), transparent 50%),
    linear-gradient(155deg, #312e81 0%, #1e1b4b 45%, #0f172a 100%);
  pointer-events: none;
}

.auth-shell__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(1.5rem, 4vw, 3.5rem);
  width: 100%;
  max-width: 1040px;
}

.auth-intro {
  flex: 1 1 280px;
  max-width: 440px;
  color: rgba(255, 255, 255, 0.92);
}

.auth-intro__brand {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 1rem;
}

.auth-intro__logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}

.auth-intro__product {
  margin: 0 0 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(196, 181, 253, 0.95);
}

.auth-intro__title {
  margin: 0;
  font-size: clamp(1.65rem, 3.2vw, 2.25rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.auth-intro__tagline {
  margin: 0 0 1.75rem;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: rgba(226, 232, 240, 0.88);
}

.auth-intro__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-intro__item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  font-size: 0.875rem;
  line-height: 1.55;
  color: rgba(226, 232, 240, 0.9);
}

.auth-intro__icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #c4b5fd;
}

.auth-form-wrap {
  flex: 0 1 400px;
  width: 100%;
  max-width: 420px;
}

.auth-form-wrap :deep(.n-card) {
  border-radius: 14px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.12),
    0 20px 40px -12px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.98);
}

@media (max-width: 768px) {
  .auth-shell {
    align-items: flex-start;
  }

  .auth-shell__inner {
    flex-direction: column;
    align-items: stretch;
  }

  .auth-intro {
    max-width: none;
  }

  .auth-intro__tagline {
    margin-bottom: 1.25rem;
  }

  .auth-intro__list {
    gap: 0.75rem;
  }

  .auth-form-wrap {
    max-width: none;
  }
}
</style>
