<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const form = ref({ username: '', password: '' });
const loading = ref(false);

async function login() {
  loading.value = true;
  try {
    await auth.login(form.value.username, form.value.password);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div style="max-width: 400px; margin: 80px auto;">
    <el-card>
      <template #header>
        <h2 style="margin: 0; text-align: center;">LocalTrain 登录</h2>
      </template>
      <el-form label-position="top" @submit.prevent="login">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="admin 或 user" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="admin / user" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%;">
          登录
        </el-button>
      </el-form>
      <div style="text-align: center; margin-top: 16px;">
        <el-link type="primary" @click="$router.push('/register')">还没有账号？去注册</el-link>
      </div>
    </el-card>
  </div>
</template>
