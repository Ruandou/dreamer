<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const formValue = ref({ name: '', email: '', password: '', confirmPassword: '' })
const isLoading = ref(false)

const handleRegister = async () => {
  console.log('formValue:', formValue.value)
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
      const raw = route.query.redirect
      const r = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
      const target = r.startsWith('/') && !r.startsWith('//') ? r : '/projects'
      router.push(target)
    }
  } catch (error: any) {
    message.error(error.response?.data?.error || '注册失败')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="register-container">
    <NCard title="注册" style="width: 400px">
      <NForm :model="formValue">
        <NFormItem label="名称" path="name">
          <NInput v-model:value="formValue.name" placeholder="请输入名称" @keyup.enter="handleRegister" />
        </NFormItem>
        <NFormItem label="邮箱" path="email">
          <NInput v-model:value="formValue.email" placeholder="请输入邮箱" @keyup.enter="handleRegister" />
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput
            v-model:value="formValue.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            @keyup.enter="handleRegister"
          />
        </NFormItem>
        <NFormItem label="确认密码" path="confirmPassword">
          <NInput
            v-model:value="formValue.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            @keyup.enter="handleRegister"
          />
        </NFormItem>
        <NSpace justify="space-between" style="width: 100%">
          <NButton @click="$router.push('/login')">返回登录</NButton>
          <NButton type="primary" :loading="isLoading" @click="handleRegister">注册</NButton>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.register-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
