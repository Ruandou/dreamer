<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { api } from '@/api'
import AuthShell from '@/components/auth/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const formValue = ref({ email: '', password: '' })
const isLoading = ref(false)

function safeRedirectTarget(): string {
  const raw = route.query.redirect
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  return s && s.startsWith('/') && !s.startsWith('//') ? s : '/projects'
}

const handleLogin = async () => {
  if (!formValue.value.email || !formValue.value.password) {
    message.error('请填写邮箱和密码')
    return
  }

  isLoading.value = true
  try {
    const res = await api.post('/auth/login', {
      email: formValue.value.email,
      password: formValue.value.password
    })

    if (res.data.accessToken) {
      localStorage.setItem('token', res.data.accessToken)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      message.success('登录成功')
      router.push(safeRedirectTarget())
    }
  } catch (error: any) {
    message.error(error.response?.data?.error || '登录失败')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <AuthShell>
    <NCard title="登录" style="width: 100%">
      <NForm :model="formValue">
        <NFormItem label="邮箱" path="email">
          <NInput v-model:value="formValue.email" placeholder="请输入邮箱" autocomplete="email" @keyup.enter="handleLogin" />
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput
            v-model:value="formValue.password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </NFormItem>
        <div class="auth-actions">
          <NButton type="primary" size="large" block round :loading="isLoading" @click="handleLogin">登录</NButton>
          <p class="auth-actions__alt">
            没有账号？
            <NButton text type="primary" class="auth-actions__link" @click="$router.push('/register')">
              立即注册
            </NButton>
          </p>
        </div>
      </NForm>
    </NCard>
  </AuthShell>
</template>

<style scoped>
.auth-actions {
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-actions__alt {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.125rem 0.35rem;
  font-size: 0.875rem;
  color: rgba(100, 116, 139, 0.95);
}

.auth-actions__link {
  font-weight: 600;
  padding: 0 0.25rem !important;
}
</style>
