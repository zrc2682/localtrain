<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api/client';

const containers = ref<any[]>([]);
const loading = ref(false);
const stoppingId = ref<string | null>(null);

function formatTimeLeft(expiresAt: string) {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  if (seconds <= 0) return '已过期';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}小时 ${m}分 ${s}秒`;
}

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/challenges/containers');
    containers.value = data;
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function stopContainer(c: any) {
  stoppingId.value = c.challengeId;
  try {
    await api.post(`/challenges/${c.challengeId}/stop`);
    ElMessage.success('关闭成功');
    await load();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '关闭失败');
  } finally {
    stoppingId.value = null;
  }
}

async function extendContainer(c: any) {
  try {
    await api.post(`/challenges/${c.challengeId}/extend`);
    ElMessage.success('已延长 1 小时');
    load();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '延长失败');
  }
}

onMounted(() => {
  load();
});
</script>

<template>
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <h2 style="margin: 0;">我的容器</h2>
      <el-button type="primary" size="small" :loading="loading" @click="load">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>
    <p style="color: #999; font-size: 12px; margin-bottom: 12px;">
      同时运行的容器最多 5 个。
    </p>
    <el-table :data="containers" v-loading="loading" style="width: 100%">
      <el-table-column prop="challengeTitle" label="题目" />
      <el-table-column label="访问地址">
        <template #default="{ row }">
          <a :href="row.url" target="_blank">{{ row.url }}</a>
        </template>
      </el-table-column>
      <el-table-column prop="hostPort" label="端口" />
      <el-table-column label="剩余时间">
        <template #default="{ row }">
          {{ formatTimeLeft(row.expiresAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button type="warning" size="small" @click="extendContainer(row)">延长 1h</el-button>
          <el-button type="danger" size="small" :loading="stoppingId === row.challengeId" :disabled="stoppingId !== null" @click="stopContainer(row)">关闭</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
