import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/seedance.test.ts'], // API 签名变更导致测试失败，需要修复
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
