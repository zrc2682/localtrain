<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const challenges = ref<any[]>([]);
const loading = ref(false);
const filter = ref({ category: '', difficulty: '', status: '', contest: '' });

if (route.query.contest && typeof route.query.contest === 'string') {
  filter.value.contest = route.query.contest;
}

const categories = ['web', 'pwn', 'reverse', 'crypto', 'misc', 'cve'];
const difficulties = ['easy', 'medium', 'hard', 'expert'];
const statusOptions = [
  { label: '全部', value: '' },
  { label: '已解出', value: 'solved' },
  { label: '未解出', value: 'unsolved' },
];

const filtered = computed(() => {
  const list = challenges.value.filter((c) => {
    if (filter.value.category && c.category !== filter.value.category) return false;
    if (filter.value.difficulty && c.difficulty !== filter.value.difficulty) return false;
    if (filter.value.status === 'solved' && !c.solved) return false;
    if (filter.value.status === 'unsolved' && c.solved) return false;
    if (filter.value.contest && c.contest !== filter.value.contest) return false;
    return true;
  });
  // 可见题目排在前面，隐藏题目排在后面
  return list.slice().sort((a, b) => {
    const aVisible = a.visible !== false;
    const bVisible = b.visible !== false;
    if (aVisible === bVisible) return 0;
    return aVisible ? -1 : 1;
  });
});

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/challenges');
    challenges.value = data;
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function difficultyText(d: string) {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难', expert: '专家' };
  return map[d] || d;
}

function difficultyType(d: string) {
  const map: Record<string, any> = { easy: 'success', medium: 'warning', hard: 'danger', expert: 'info' };
  return map[d] || 'info';
}
</script>

<template>
  <div>
    <h1>题目列表</h1>
    <p style="color: #666;">
      当前身份：{{ auth.isAdmin ? '管理员' : '普通用户' }}
      <span v-if="auth.isAdmin" style="color: #999; margin-left: 8px;">（可点击右上角切换）</span>
    </p>

    <div style="margin-bottom: 20px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
      <el-select v-model="filter.category" clearable placeholder="分类筛选" style="width: 160px;">
        <el-option v-for="c in categories" :key="c" :label="c.toUpperCase()" :value="c" />
      </el-select>
      <el-select v-model="filter.difficulty" clearable placeholder="难度筛选" style="width: 160px;">
        <el-option v-for="d in difficulties" :key="d" :label="difficultyText(d)" :value="d" />
      </el-select>
      <el-select v-model="filter.status" clearable placeholder="状态筛选" style="width: 160px;">
        <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-button @click="load" :loading="loading">刷新</el-button>
      <el-tag v-if="filter.contest" closable type="danger" effect="plain" @close="filter.contest = ''">
        比赛：{{ filter.contest }}
      </el-tag>
    </div>

    <el-row :gutter="16">
      <el-col v-for="c in filtered" :key="c.id" :xs="24" :sm="12" :md="8" :lg="6" style="margin-bottom: 16px;">
        <el-card shadow="hover" :body-style="{ padding: '16px' }" :class="{ 'hidden-challenge-card': c.visible === false }">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h3 style="margin: 0 0 8px; font-size: 16px;">{{ c.title }}</h3>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
              <el-tag v-if="c.visible === false" type="info" size="small">已隐藏</el-tag>
              <el-tag v-if="c.solved" type="success" size="small">已解</el-tag>
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <el-tag size="small" style="margin-right: 8px;">{{ c.category.toUpperCase() }}</el-tag>
            <el-tag :type="difficultyType(c.difficulty)" size="small">{{ difficultyText(c.difficulty) }}</el-tag>
            <el-tag v-if="c.contest" type="danger" effect="plain" size="small" style="margin-left: 8px; cursor: pointer;" @click="filter.contest = c.contest">{{ c.contest }}</el-tag>
          </div>
          <p style="color: #666; font-size: 13px; min-height: 40px;">
            {{ c.description.slice(0, 60) || '暂无描述' }}
            {{ c.description.length > 60 ? '...' : '' }}
          </p>
          <el-button type="primary" style="width: 100%;" @click="$router.push(`/challenges/${c.id}`)">
            进入题目
          </el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="!loading && filtered.length === 0" description="暂无题目" />
  </div>
</template>
<style>
.hidden-challenge-card {
  opacity: 0.5;
  filter: grayscale(80%);
  background-color: #f5f5f5;
}
</style>
