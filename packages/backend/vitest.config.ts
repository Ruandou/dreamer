import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    /** 先于任何测试文件执行，避免只 mock 单模块时未加载根 .env */
    setupFiles: ['./src/bootstrap-env.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
