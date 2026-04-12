<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const formValue = ref({ email: '', password: '' })
const isLoading = ref(false)

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
      const raw = route.query.redirect
      const r = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
      const target = r.startsWith('/') && !r.startsWith('//') ? r : '/projects'
      router.push(target)
    }
  } catch (error: any) {
    message.error(error.response?.data?.error || '登录失败')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <NCard title="登录" style="width: 400px">
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
        <NSpace justify="space-between" style="width: 100%">
          <NButton @click="$router.push('/register')">注册</NButton>
          <NButton type="primary" :loading="isLoading" @click="handleLogin">登录</NButton>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
