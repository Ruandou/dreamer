<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { api } from '@/api'
import AuthShell from '@/components/auth/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const formValue = ref({ name: '', email: '', password: '', confirmPassword: '' })
const isLoading = ref(false)

function safeRedirectTarget(): string {
  const raw = route.query.redirect
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  return s && s.startsWith('/') && !s.startsWith('//') ? s : '/projects'
}

const handleRegister = async () => {
  if (!formValue.value.name || !formValue.value.email || !formValue.value.password) {
    message.error('请填写所有必填项')
    return
  }

  if (formValue.value.password !== formValue.value.confirmPassword) {
    message.error('两次输入的密码不一致')
    return
  }

  if (formValue.value.password.length < 6) {
    message.error('密码长度不能少于6位')
    return
  }

  isLoading.value = true
  try {
    const res = await api.post('/auth/register', {
      name: formValue.value.name,
      email: formValue.value.email,
      password: formValue.value.password
    })

    if (res.data.accessToken) {
      localStorage.setItem('token', res.data.accessToken)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      message.success('注册成功')
      router.push(safeRedirectTarget())
    }
  } catch (error: any) {
    message.error(error.response?.data?.error || '注册失败')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <AuthShell>
    <NCard title="注册" style="width: 100%">
      <NForm :model="formValue">
        <NFormItem label="名称" path="name">
          <NInput v-model:value="formValue.name" placeholder="请输入名称" autocomplete="name" @keyup.enter="handleRegister" />
        </NFormItem>
        <NFormItem label="邮箱" path="email">
          <NInput v-model:value="formValue.email" placeholder="请输入邮箱" autocomplete="email" @keyup.enter="handleRegister" />
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput
            v-model:value="formValue.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            autocomplete="new-password"
            @keyup.enter="handleRegister"
          />
        </NFormItem>
        <NFormItem label="确认密码" path="confirmPassword">
          <NInput
            v-model:value="formValue.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            autocomplete="new-password"
            @keyup.enter="handleRegister"
          />
        </NFormItem>
        <div class="auth-actions">
          <NButton type="primary" size="large" block round :loading="isLoading" @click="handleRegister">注册</NButton>
          <p class="auth-actions__alt">
            已有账号？
            <NButton text type="primary" class="auth-actions__link" @click="$router.push('/login')">返回登录</NButton>
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
