<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../../api/client';
import { getCache, setCache } from '../../utils/cache';

const loading = ref(false);
const users = ref<any[]>([]);
const userKeyword = ref('');
const userSort = ref<'default' | 'desc' | 'asc'>('default');
const userOnlySolved = ref(false);
const userDetail = ref<any>(null);
const userDetailLoading = ref(false);
const userDialogVisible = ref(false);

const CACHE_TTL_MS = 60 * 1000; // 1 分钟

const filteredUsers = computed(() => {
  let list = users.value;
  if (userKeyword.value) {
    const kw = userKeyword.value.toLowerCase();
    list = list.filter((u) => u.username.toLowerCase().includes(kw));
  }
  if (userOnlySolved.value) {
    list = list.filter((u) => (u.totalScore ?? 0) > 0);
  }
  if (userSort.value === 'desc') {
    list = list.slice().sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  } else if (userSort.value === 'asc') {
    list = list.slice().sort((a, b) => (a.totalScore ?? 0) - (b.totalScore ?? 0));
  }
  return list;
});

async function loadUsers() {
  const cached = getCache<any[]>('admin:users', CACHE_TTL_MS);
  if (cached) {
    users.value = cached;
  }
  loading.value = true;
  try {
    const { data } = await api.get('/users');
    users.value = data;
    setCache('admin:users', data);
  } catch (err: any) {
    if (!cached) ElMessage.error(err.response?.data?.error || '加载用户失败');
  } finally {
    loading.value = false;
  }
}

async function openUserSubmissions(user: any) {
  userDetailLoading.value = true;
  userDialogVisible.value = true;
  userDetail.value = null;
  try {
    const { data } = await api.get(`/users/${user.id}/submissions`);
    userDetail.value = data;
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败');
    userDialogVisible.value = false;
  } finally {
    userDetailLoading.value = false;
  }
}

function difficultyText(d: string) {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难', expert: '专家' };
  return map[d] || d;
}

onMounted(loadUsers);
</script>

<template>
  <div>
    <div style="margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
      <el-input v-model="userKeyword" clearable placeholder="搜索用户名" style="width: 240px;" />
      <el-select v-model="userSort" placeholder="积分排序" style="width: 140px;">
        <el-option label="默认" value="default" />
        <el-option label="积分从高到低" value="desc" />
        <el-option label="积分从低到高" value="asc" />
      </el-select>
      <el-checkbox v-model="userOnlySolved">仅看有解题记录</el-checkbox>
      <el-button @click="loadUsers" :loading="loading">刷新</el-button>
      <el-button @click="userKeyword = ''; userSort = 'default'; userOnlySolved = false">重置</el-button>
    </div>
    <el-table :data="filteredUsers" style="width: 100%;" v-loading="loading">
      <el-table-column type="index" width="60" />
      <el-table-column label="用户名" min-width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openUserSubmissions(row)">{{ row.username }}</el-button>
        </template>
      </el-table-column>
      <el-table-column prop="role" label="角色" width="100" />
      <el-table-column prop="totalScore" label="总积分" width="100">
        <template #default="{ row }">
          <el-tag type="warning" size="small">{{ row.totalScore ?? 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" min-width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && filteredUsers.length === 0" description="无匹配用户" />

    <!-- 用户解题记录 -->
    <el-dialog v-model="userDialogVisible" :title="`用户 ${userDetail?.user?.username || ''} 的解题记录`" width="720px">
      <div v-loading="userDetailLoading">
        <div style="margin-bottom: 16px; display: flex; gap: 24px; flex-wrap: wrap;">
          累计解出：<strong>{{ userDetail?.solvedCount ?? 0 }}</strong> 次
          <span>总积分：<strong>{{ userDetail?.totalScore ?? 0 }}</strong></span>
        </div>
        <el-table v-if="userDetail?.challenges?.length" :data="userDetail.challenges" style="width: 100%;" max-height="400px">
          <el-table-column prop="challenge.title" label="题目" min-width="180" :show-overflow-tooltip="{ showAfter: 1000 }" />
          <el-table-column prop="challenge.category" label="分类" width="80" />
          <el-table-column label="难度" width="80">
            <template #default="{ row }">
              {{ difficultyText(row.challenge.difficulty) }}
            </template>
          </el-table-column>
          <el-table-column prop="solveCount" label="解出次数" width="90" />
          <el-table-column prop="score" label="积分" width="80" />
          <el-table-column label="最近解出" min-width="180">
            <template #default="{ row }">
              {{ row.solvedAt ? new Date(row.solvedAt).toLocaleString() : '-' }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无解题记录" />
      </div>
    </el-dialog>
  </div>
</template>
