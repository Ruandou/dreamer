<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace } from 'naive-ui'

const router = useRouter()
const formValue = ref({ name: '', email: '', password: '', confirmPassword: '' })

const handleRegister = () => {
  // TODO: implement register
  router.push('/login')
}
</script>

<template>
  <div class="register-container">
    <NCard title="注册" style="width: 400px">
      <NForm :model="formValue">
        <NFormItem label="名称" path="name">
          <NInput v:value="formValue.name" placeholder="请输入名称" />
        </NFormItem>
        <NFormItem label="邮箱" path="email">
          <NInput v:value="formValue.email" placeholder="请输入邮箱" />
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput v:value="formValue.password" type="password" placeholder="请输入密码" />
        </NFormItem>
        <NFormItem label="确认密码" path="confirmPassword">
          <NInput v:value="formValue.confirmPassword" type="password" placeholder="请再次输入密码" />
        </NFormItem>
        <NSpace justify="space-between" style="width: 100%">
          <NButton @click="$router.push('/login')">返回登录</NButton>
          <NButton type="primary" @click="handleRegister">注册</NButton>
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
