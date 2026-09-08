<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const form = ref({ username: '', password: '' });
const loading = ref(false);

async function register() {
  if (form.value.username.length < 2 || form.value.password.length < 4) {
    ElMessage.warning('用户名至少 2 位，密码至少 4 位');
    return;
  }
  loading.value = true;
  try {
    await auth.register(form.value.username, form.value.password);
    ElMessage.success('注册成功');
    router.push('/dashboard');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div style="max-width: 400px; margin: 80px auto;">
    <el-card>
      <template #header>
        <h2 style="margin: 0; text-align: center;">LocalTrain 注册</h2>
      </template>
      <el-form label-position="top" @submit.prevent="register">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="设置用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="设置密码" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%;">
          注册
        </el-button>
      </el-form>
      <div style="text-align: center; margin-top: 16px;">
        <el-link type="primary" @click="$router.push('/login')">已有账号？去登录</el-link>
      </div>
    </el-card>
  </div>
</template>
