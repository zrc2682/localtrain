<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const loading = ref(false);
const profile = ref<any>(null);

const difficulties: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
  expert: '专家',
};

const categories = ['web', 'pwn', 'reverse', 'crypto', 'misc', 'cve'];
const difficultyList = ['easy', 'medium', 'hard', 'expert'];
const filter = ref({ category: '', difficulty: '' });

const filteredChallenges = computed(() => {
  if (!profile.value) return [];
  return profile.value.challenges.filter((item: any) => {
    const c = item.challenge;
    if (filter.value.category && c.category !== filter.value.category) return false;
    if (filter.value.difficulty && c.difficulty !== filter.value.difficulty) return false;
    return true;
  });
});

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/users/profile');
    profile.value = data;
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败');
  } finally {
    loading.value = false;
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <h1>个人主页</h1>

    <el-card v-if="auth.user" style="margin-bottom: 20px;">
      <p><strong>用户名：</strong>{{ auth.user.username }}</p>
      <p><strong>角色：</strong>{{ auth.user.role === 'admin' ? '管理员' : '普通用户' }}</p>
      <p><strong>注册时间：</strong>{{ auth.user.createdAt ? formatTime(auth.user.createdAt) : '-' }}</p>
    </el-card>

    <el-card v-if="profile" style="margin-bottom: 20px;">
      <div style="display: flex; gap: 24px; flex-wrap: wrap;">
        <el-statistic title="完整解出题目" :value="profile.solvedCount" />
        <el-statistic title="总积分" :value="profile.totalScore" />
      </div>
    </el-card>

    <h2>完整解出记录</h2>

    <div style="margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap;">
      <el-select v-model="filter.category" clearable placeholder="分类筛选" style="width: 160px;">
        <el-option v-for="c in categories" :key="c" :label="c.toUpperCase()" :value="c" />
      </el-select>
      <el-select v-model="filter.difficulty" clearable placeholder="难度筛选" style="width: 160px;">
        <el-option v-for="d in difficultyList" :key="d" :label="difficulties[d] || d" :value="d" />
      </el-select>
      <el-button @click="filter = { category: '', difficulty: '' }">重置</el-button>
    </div>

    <el-empty v-if="profile && filteredChallenges.length === 0" description="还没有完整解出的题目" />

    <el-table v-if="profile && filteredChallenges.length > 0" :data="filteredChallenges" style="width: 100%;">
      <el-table-column prop="challenge.title" label="题目" />
      <el-table-column label="分类" width="120">
        <template #default="{ row }">
          {{ row.challenge.category.toUpperCase() }}
        </template>
      </el-table-column>
      <el-table-column label="难度" width="120">
        <template #default="{ row }">
          {{ difficulties[row.challenge.difficulty] || row.challenge.difficulty }}
        </template>
      </el-table-column>
      <el-table-column label="解出次数" width="120">
        <template #default="{ row }">
          {{ row.solveCount || 1 }}
        </template>
      </el-table-column>
      <el-table-column label="获得积分" width="120">
        <template #default="{ row }">
          {{ row.score || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="最近解出时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.solvedAt) }}
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
