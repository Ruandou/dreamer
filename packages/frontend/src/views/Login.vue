<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, NText } from 'naive-ui'

const router = useRouter()
const formValue = ref({ email: '', password: '' })

const handleLogin = () => {
  // TODO: implement login
  router.push('/projects')
}
</script>

<template>
  <div class="login-container">
    <NCard title="登录" style="width: 400px">
      <NForm :model="formValue">
        <NFormItem label="邮箱" path="email">
          <NInput v:value="formValue.email" placeholder="请输入邮箱" />
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput v:value="formValue.password" type="password" placeholder="请输入密码" />
        </NFormItem>
        <NSpace justify="space-between" style="width: 100%">
          <NButton @click="$router.push('/register')">注册</NButton>
          <NButton type="primary" @click="handleLogin">登录</NButton>
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
