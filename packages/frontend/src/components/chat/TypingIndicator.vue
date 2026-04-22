<template>
  <div class="typing-indicator">
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  </div>
</template>

<style scoped>
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  align-self: flex-start;
}

.typing-dot {
  width: 8px;
  height: 8px;
  background: var(--color-text-tertiary, #9ca3af);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) {
  animation-delay: 0s;
}
.typing-dot:nth-child(2) {
  animation-delay: 0.16s;
}
.typing-dot:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-6px);
  }
}
</style>
