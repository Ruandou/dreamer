<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NButton, NForm, NFormItem, NInput, NSpace, NSpin,
  NAlert, useMessage, NTag
} from 'naive-ui'

const router = useRouter()
const message = useMessage()

const loading = ref(false)
const saving = ref(false)
const verifying = ref(false)

const userName = ref('')
const apiKey = ref('')
const hasApiKey = ref(false)
const apiKeyInput = ref('')

// 其他 API Keys
const deepseekApiUrl = ref('')
const atlasApiKey = ref('')
const atlasApiUrl = ref('')
const arkApiKey = ref('')
const arkApiUrl = ref('')

const balance = ref<any>(null)
const balanceError = ref<string | null>(null)
const verifyError = ref<string | null>(null)
const verifySuccess = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch('/api/settings/me', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    const data = await res.json()

    if (data.error) {
      message.error(data.error)
      return
    }

    userName.value = data.user.name
    hasApiKey.value = data.hasApiKey
    if (data.hasApiKey) {
      apiKey.value = '********'
      apiKeyInput.value = ''
    }

    if (data.balance) {
      balance.value = data.balance
    }
    if (data.balanceError) {
      balanceError.value = data.balanceError
    }

    // 加载其他 API 配置
    if (data.apiKeys) {
      deepseekApiUrl.value = data.apiKeys.deepseekApiUrl || ''
      atlasApiKey.value = data.apiKeys.atlasApiKey || ''
      atlasApiUrl.value = data.apiKeys.atlasApiUrl || ''
      arkApiKey.value = data.apiKeys.arkApiKey || ''
      arkApiUrl.value = data.apiKeys.arkApiUrl || ''
    }
  } catch (error: any) {
    message.error('获取设置失败')
  } finally {
    loading.value = false
  }
})

const verifyApiKey = async () => {
  if (!apiKeyInput.value) {
    message.warning('请输入 API Key')
    return
  }

  verifying.value = true
  verifyError.value = null
  verifySuccess.value = false

  try {
    const res = await fetch('/api/settings/verify-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ apiKey: apiKeyInput.value })
    })
    const data = await res.json()

    if (!res.ok || !data.valid) {
      verifyError.value = data.error || 'API Key 验证失败'
      verifySuccess.value = false
      return
    }

    verifySuccess.value = true
    balance.value = data.balance
    message.success('API Key 验证成功')
  } catch (error: any) {
    verifyError.value = '验证失败，请稍后重试'
    verifySuccess.value = false
  } finally {
    verifying.value = false
  }
}

const saveSettings = async () => {
  saving.value = true

  try {
    const body: any = {
      name: userName.value,
      apiKeys: {
        deepseekApiUrl: deepseekApiUrl.value,
        atlasApiKey: atlasApiKey.value,
        atlasApiUrl: atlasApiUrl.value,
        arkApiKey: arkApiKey.value,
        arkApiUrl: arkApiUrl.value
      }
    }
    if (apiKeyInput.value) {
      body.apiKey = apiKeyInput.value
    }

    const res = await fetch('/api/settings/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(body)
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      message.error(data.error || '保存失败')
      return
    }

    hasApiKey.value = data.user.hasApiKey
    if (apiKeyInput.value) {
      apiKey.value = '********'
      apiKeyInput.value = ''
    }

    message.success('设置已保存')
  } catch (error: any) {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

const formatBalance = (amount: number) => {
  return amount.toFixed(2)
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <div class="settings-header__left">
        <h1 class="settings-header__title">设置</h1>
      </div>
      <div class="settings-header__right">
        <NButton @click="router.push('/projects')">
          返回项目
        </NButton>
      </div>
    </header>

    <NSpin :show="loading">
      <div class="settings-content">
        <!-- Account Info -->
        <NCard title="账户信息" class="settings-card">
          <NForm label-placement="left" label-width="100">
            <NFormItem label="用户名">
              <NInput v-model:value="userName" placeholder="输入用户名" />
            </NFormItem>
          </NForm>
        </NCard>

        <!-- DeepSeek API -->
        <NCard title="🤖 DeepSeek（AI 编剧）" class="settings-card">
          <template #header-extra>
            <NTag v-if="hasApiKey" type="success" size="small">已配置</NTag>
            <NTag v-else type="warning" size="small">未配置</NTag>
          </template>

          <div v-if="hasApiKey && !apiKeyInput" class="api-key-display">
            <NInput :value="apiKey" disabled placeholder="已配置的 API Key" />
            <NButton @click="apiKeyInput = ''" type="primary" tertiary>更换</NButton>
          </div>

          <div v-else class="api-key-form">
            <NAlert v-if="balanceError" type="warning" class="mb-4">
              {{ balanceError }}
            </NAlert>

            <NAlert v-if="verifySuccess && balance" type="success" class="mb-4">
              验证成功！余额：¥{{ formatBalance(balance.balanceInfos.find((b: any) => b.currency === 'CNY')?.totalBalance || 0) }}
            </NAlert>

            <NAlert v-if="verifyError" type="error" class="mb-4">
              {{ verifyError }}
            </NAlert>

            <NForm label-placement="left" label-width="100">
              <NFormItem label="API Key">
                <NInput
                  v-model:value="apiKeyInput"
                  type="password"
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  show-password-on="click"
                />
              </NFormItem>
              <NFormItem label="API URL">
                <NInput
                  v-model:value="deepseekApiUrl"
                  placeholder="https://api.deepseek.com/v1（可选）"
                />
              </NFormItem>
            </NForm>

            <div class="api-key-actions">
              <NSpace>
                <NButton @click="verifyApiKey" :loading="verifying" :disabled="!apiKeyInput">
                  验证
                </NButton>
                <NButton @click="apiKeyInput = ''" tertiary>取消</NButton>
              </NSpace>
            </div>
          </div>

          <template #footer>
            <div class="balance-info" v-if="balance">
              <span class="balance-label">当前余额：</span>
              <span
                v-for="info in balance.balanceInfos"
                :key="info.currency"
                class="balance-item"
              >
                {{ info.currency === 'CNY' ? '¥' : '$' }}{{ formatBalance(info.totalBalance) }}
              </span>
            </div>
          </template>
        </NCard>

        <!-- Atlas API (Wan 2.6) -->
        <NCard title="🎬 Atlas（视频生成 Wan 2.6）" class="settings-card">
          <template #header-extra>
            <NTag v-if="atlasApiKey" type="success" size="small">已配置</NTag>
            <NTag v-else type="warning" size="small">未配置</NTag>
          </template>

          <NForm label-placement="left" label-width="120">
            <NFormItem label="API Key">
              <NInput v-model:value="atlasApiKey" type="password" placeholder="Atlas API Key" show-password-on="click" />
            </NFormItem>
            <NFormItem label="API URL">
              <NInput v-model:value="atlasApiUrl" placeholder="https://api.atlascloud.com" />
            </NFormItem>
          </NForm>
        </NCard>

        <!-- Volcano Engine API (Seedance 2.0) -->
        <NCard title="🎥 火山方舟（视频生成 Seedance 2.0）" class="settings-card">
          <template #header-extra>
            <NTag v-if="arkApiKey" type="success" size="small">已配置</NTag>
            <NTag v-else type="warning" size="small">未配置</NTag>
          </template>

          <NForm label-placement="left" label-width="120">
            <NFormItem label="API Key">
              <NInput v-model:value="arkApiKey" type="password" placeholder="火山方舟 API Key" show-password-on="click" />
            </NFormItem>
            <NFormItem label="API URL">
              <NInput v-model:value="arkApiUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" />
              <template #feedback>
                默认地址：https://ark.cn-beijing.volces.com/api/v3
              </template>
            </NFormItem>
          </NForm>
        </NCard>

        <!-- Save Button -->
        <div class="settings-actions">
          <NButton type="primary" size="large" :loading="saving" @click="saveSettings">
            保存设置
          </NButton>
        </div>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.settings-page {
  padding: var(--spacing-lg);
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.settings-header__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.settings-card {
  background: white;
}

.api-key-display {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.api-key-display :deep(.n-input) {
  flex: 1;
}

.api-key-form {
  margin-bottom: var(--spacing-md);
}

.api-key-actions {
  margin-top: var(--spacing-md);
}

.mb-4 {
  margin-bottom: var(--spacing-md);
}

.balance-info {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.balance-label {
  font-weight: 500;
}

.balance-item {
  padding: 4px 12px;
  background: var(--color-primary-light);
  border-radius: 4px;
  color: var(--color-primary);
  font-weight: 600;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-md);
}

.text-muted {
  color: var(--color-text-secondary);
}
</style>
