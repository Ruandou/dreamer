<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NCard,
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSpace,
  NAlert,
  useMessage,
  NTag,
  NIcon
} from 'naive-ui'
import {
  KeyOutline,
  VideocamOutline,
  FlameOutline,
  CheckmarkOutline,
  PersonOutline,
  HardwareChipOutline
} from '@vicons/ionicons5'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { useModelPreferenceStore } from '../stores/model-preference.ts'
import { NSelect } from 'naive-ui'

const message = useMessage()
const modelStore = useModelPreferenceStore()

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
    await modelStore.init()

    const res = await fetch('/api/settings/me', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
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
        Authorization: `Bearer ${localStorage.getItem('token')}`
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
        Authorization: `Bearer ${localStorage.getItem('token')}`
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

    // Save model preferences
    await modelStore.savePreferences()

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
  <div class="settings-page page-shell page-shell--narrow">
    <header class="settings-header">
      <div class="settings-header__left">
        <h1 class="settings-header__title">设置</h1>
      </div>
    </header>

    <div v-if="loading" class="settings-loading">
      <SkeletonLoader variant="card" :rows="8" />
    </div>
    <div v-else class="settings-content">
      <!-- Account Info -->
      <div class="settings-section">
        <div class="settings-section__header">
          <div
            class="settings-section__icon"
            style="background: linear-gradient(135deg, #ffeaea 0%, #ffedd5 100%); color: #f4726a"
          >
            <NIcon :component="PersonOutline" :size="20" />
          </div>
          <div>
            <h3 class="settings-section__title">账户信息</h3>
            <p class="settings-section__desc">管理你的个人资料</p>
          </div>
        </div>
        <NCard class="settings-card" :bordered="false">
          <NForm label-placement="left" label-width="100">
            <NFormItem label="用户名">
              <NInput v-model:value="userName" placeholder="输入用户名" />
            </NFormItem>
          </NForm>
        </NCard>
      </div>

      <!-- AI Model Preference -->
      <div class="settings-section">
        <div class="settings-section__header">
          <div
            class="settings-section__icon"
            style="background: linear-gradient(135deg, #ede9fe 0%, #f3e8ff 100%); color: #7c3aed"
          >
            <NIcon :component="HardwareChipOutline" :size="20" />
          </div>
          <div>
            <h3 class="settings-section__title">AI 模型</h3>
            <p class="settings-section__desc">选择默认的 AI 生成模型</p>
          </div>
        </div>
        <NCard class="settings-card" :bordered="false">
          <NForm label-placement="left" label-width="100">
            <NFormItem label="文本模型">
              <NSelect
                v-model:value="modelStore.currentTextModel"
                :options="modelStore.textModels.map((m) => ({ label: m.name, value: m.id }))"
                placeholder="选择默认文本模型"
                clearable
              />
            </NFormItem>
            <NFormItem label="图片模型">
              <NSelect
                v-model:value="modelStore.currentImageModel"
                :options="modelStore.imageModels.map((m) => ({ label: m.name, value: m.id }))"
                placeholder="选择默认图片模型"
                clearable
              />
            </NFormItem>
            <NFormItem label="视频模型">
              <NSelect
                v-model:value="modelStore.currentVideoModel"
                :options="modelStore.videoModels.map((m) => ({ label: m.name, value: m.id }))"
                placeholder="选择默认视频模型"
                clearable
              />
            </NFormItem>
          </NForm>
        </NCard>
      </div>

      <!-- DeepSeek API -->
      <div class="settings-section">
        <div class="settings-section__header">
          <div
            class="settings-section__icon"
            style="background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); color: #2563eb"
          >
            <NIcon :component="KeyOutline" :size="20" />
          </div>
          <div>
            <h3 class="settings-section__title">DeepSeek</h3>
            <p class="settings-section__desc">AI 编剧与对话模型</p>
          </div>
          <NTag v-if="hasApiKey" type="success" size="small" round style="margin-left: auto"
            >已配置</NTag
          >
          <NTag v-else type="warning" size="small" round style="margin-left: auto">未配置</NTag>
        </div>
        <NCard class="settings-card" :bordered="false">
          <div v-if="hasApiKey && !apiKeyInput" class="api-key-display">
            <NInput :value="apiKey" disabled placeholder="已配置的 API Key" />
            <NButton @click="apiKeyInput = ''" type="primary" secondary>更换</NButton>
          </div>

          <div v-else class="api-key-form">
            <NAlert v-if="balanceError" type="warning" class="mb-4">
              {{ balanceError }}
            </NAlert>

            <NAlert v-if="verifySuccess && balance" type="success" class="mb-4">
              验证成功！余额：¥{{
                formatBalance(
                  balance.balanceInfos.find((b: any) => b.currency === 'CNY')?.totalBalance || 0
                )
              }}
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

          <div class="balance-info" v-if="balance">
            <span class="balance-label">当前余额：</span>
            <span v-for="info in balance.balanceInfos" :key="info.currency" class="balance-item">
              {{ info.currency === 'CNY' ? '¥' : '$' }}{{ formatBalance(info.totalBalance) }}
            </span>
          </div>
        </NCard>
      </div>

      <!-- Atlas API (Wan 2.6) -->
      <div class="settings-section">
        <div class="settings-section__header">
          <div
            class="settings-section__icon"
            style="background: linear-gradient(135deg, #d1fae5 0%, #ccfbf1 100%); color: #059669"
          >
            <NIcon :component="VideocamOutline" :size="20" />
          </div>
          <div>
            <h3 class="settings-section__title">Atlas</h3>
            <p class="settings-section__desc">视频生成 Wan 2.6</p>
          </div>
          <NTag v-if="atlasApiKey" type="success" size="small" round style="margin-left: auto"
            >已配置</NTag
          >
          <NTag v-else type="warning" size="small" round style="margin-left: auto">未配置</NTag>
        </div>
        <NCard class="settings-card" :bordered="false">
          <NForm label-placement="left" label-width="120">
            <NFormItem label="API Key">
              <NInput
                v-model:value="atlasApiKey"
                type="password"
                placeholder="Atlas API Key"
                show-password-on="click"
              />
            </NFormItem>
            <NFormItem label="API URL">
              <NInput v-model:value="atlasApiUrl" placeholder="https://api.atlascloud.com" />
            </NFormItem>
          </NForm>
        </NCard>
      </div>

      <!-- Volcano Engine API (Seedance 2.0) -->
      <div class="settings-section">
        <div class="settings-section__header">
          <div
            class="settings-section__icon"
            style="background: linear-gradient(135deg, #fef3c7 0%, #ffedd5 100%); color: #d97706"
          >
            <NIcon :component="FlameOutline" :size="20" />
          </div>
          <div>
            <h3 class="settings-section__title">火山方舟</h3>
            <p class="settings-section__desc">视频生成 Seedance 2.0</p>
          </div>
          <NTag v-if="arkApiKey" type="success" size="small" round style="margin-left: auto"
            >已配置</NTag
          >
          <NTag v-else type="warning" size="small" round style="margin-left: auto">未配置</NTag>
        </div>
        <NCard class="settings-card" :bordered="false">
          <NForm label-placement="left" label-width="120">
            <NFormItem label="API Key">
              <NInput
                v-model:value="arkApiKey"
                type="password"
                placeholder="火山方舟 API Key"
                show-password-on="click"
              />
            </NFormItem>
            <NFormItem label="API URL">
              <NInput
                v-model:value="arkApiUrl"
                placeholder="https://ark.cn-beijing.volces.com/api/v3"
              />
              <template #feedback> 默认地址：https://ark.cn-beijing.volces.com/api/v3 </template>
            </NFormItem>
          </NForm>
        </NCard>
      </div>

      <!-- Save Button -->
      <div class="settings-actions">
        <NButton type="primary" size="large" :loading="saving" @click="saveSettings">
          <template #icon>
            <NIcon :component="CheckmarkOutline" :size="18" />
          </template>
          保存设置
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.settings-header__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.settings-loading {
  padding: var(--spacing-xl) 0;
}

.settings-section__header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.settings-section__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.settings-section__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.settings-section__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 2px 0 0;
}

.settings-card {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
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
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.balance-label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.balance-item {
  padding: 4px 12px;
  background: var(--color-primary-light);
  border-radius: var(--radius-full);
  color: var(--color-primary);
  font-weight: 600;
  font-size: var(--font-size-sm);
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
