import js from '@eslint/js'
import ts from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.vue',
      'packages/backend/prisma/**'
    ]
  },
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': ts,
      prettier
    },
    rules: {
      // TypeScript 推荐规则
      ...ts.configs.recommended.rules,

      // Prettier 格式化规则
      'prettier/prettier': 'error',

      // 自定义规则
      // 后端服务允许 console（用于日志和错误追踪）
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      // 强制禁止 any（规范第4节）- 必须添加注释说明原因才允许使用
      '@typescript-eslint/no-explicit-any': 'error',
      // 禁止使用非空断言，改用可选链或类型守卫
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // 强制使用 const（优先不可变）
      'prefer-const': 'error',
      'no-var': 'error',
      // 禁止空 catch 块（必须处理或记录错误）
      'no-empty': ['error', { allowEmptyCatch: false }],
      // 禁止不必要的 async 函数
      'no-return-await': 'error'
    }
  },
  // Frontend-specific overrides: browser globals
  {
    files: ['packages/frontend/**/*.ts', 'packages/frontend/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  }
]
