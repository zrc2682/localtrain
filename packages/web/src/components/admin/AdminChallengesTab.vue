<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Sort, SortUp, SortDown } from '@element-plus/icons-vue';
import { api } from '../../api/client';
import { getCache, setCache } from '../../utils/cache';
import ChallengeEditDialog from './ChallengeEditDialog.vue';
import ChallengeHintsDialog from './ChallengeHintsDialog.vue';

const challenges = ref<any[]>([]);
const loading = ref(false);
const selectedChallenges = ref<any[]>([]);

// 编辑 / 提示弹窗状态
const editDialogVisible = ref(false);
const editingChallenge = ref<any | null>(null);
const hintDialogVisible = ref(false);
const hintTarget = ref<any | null>(null);

const CACHE_TTL_MS = 60 * 1000; // 1 分钟

const filter = ref({ category: '', difficulty: '', keyword: '', contest: '' });
const searchKeyword = ref('');
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => filter.value.keyword,
  (val) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchKeyword.value = val;
    }, 300);
  },
  { immediate: true }
);

const categories = ['web', 'pwn', 'reverse', 'crypto', 'misc', 'cve'];
const difficulties = ['easy', 'medium', 'hard', 'expert'];

const difficultySort = ref<'asc' | 'desc' | ''>('');
const difficultyRank: Record<string, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

function toggleDifficultySort() {
  if (difficultySort.value === '') difficultySort.value = 'asc';
  else if (difficultySort.value === 'asc') difficultySort.value = 'desc';
  else difficultySort.value = '';
}

const filteredChallenges = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  let list = challenges.value.filter((c) => {
    if (filter.value.category && c.category !== filter.value.category) return false;
    if (filter.value.difficulty && c.difficulty !== filter.value.difficulty) return false;
    if (filter.value.contest && c.contest !== filter.value.contest) return false;
    if (kw && !c.title.toLowerCase().includes(kw)) return false;
    return true;
  });
  // 可见题目排在前面，隐藏题目排在后面；同组内按难度排序（当启用时）
  return list.slice().sort((a, b) => {
    const aVisible = a.visible !== false ? 0 : 1;
    const bVisible = b.visible !== false ? 0 : 1;
    if (aVisible !== bVisible) return aVisible - bVisible;
    if (difficultySort.value) {
      const order = difficultySort.value === 'asc' ? 1 : -1;
      return (difficultyRank[a.difficulty] - difficultyRank[b.difficulty]) * order;
    }
    return 0;
  });
});

async function loadChallenges(showLoading = true) {
  const cached = getCache<any[]>('admin:challenges', CACHE_TTL_MS);
  if (cached) {
    challenges.value = cached;
    if (showLoading) loading.value = false;
  } else if (showLoading) {
    loading.value = true;
  }
  try {
    const { data } = await api.get('/challenges');
    challenges.value = data;
    setCache('admin:challenges', data);
  } catch (err: any) {
    if (!cached) ElMessage.error(err.response?.data?.error || '加载失败');
  } finally {
    if (showLoading) loading.value = false;
  }
}

function openCreate() {
  editingChallenge.value = null;
  editDialogVisible.value = true;
}

function openEdit(row: any) {
  editingChallenge.value = row;
  editDialogVisible.value = true;
}

function openHintDialog(row: any) {
  hintTarget.value = { id: row.id, title: row.title };
  hintDialogVisible.value = true;
}

async function batchVisible(visible: boolean) {
  const ids = selectedChallenges.value.map((c) => c.id);
  if (ids.length === 0) {
    ElMessage.warning('请先选择题目');
    return;
  }
  try {
    await api.post('/challenges/batch-visible', { ids, visible });
    ElMessage.success('批量更新成功');
    selectedChallenges.value = [];
    loadChallenges();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '批量更新失败');
  }
}

async function batchDelete() {
  const ids = selectedChallenges.value.map((c) => c.id);
  if (ids.length === 0) {
    ElMessage.warning('请先选择题目');
    return;
  }
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 道题目吗？关联提示、flag、附件也会删除。`, '提示', { type: 'warning' });
    await api.post('/challenges/batch-delete', { ids });
    ElMessage.success('批量删除成功');
    selectedChallenges.value = [];
    loadChallenges();
  } catch {
    // cancelled
  }
}

async function removeChallenge(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该题目吗？关联提示、flag、附件也会删除。', '提示', { type: 'warning' });
    await api.delete(`/challenges/${id}`);
    ElMessage.success('删除成功');
    loadChallenges();
  } catch {
    // cancelled
  }
}

function difficultyText(d: string) {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难', expert: '专家' };
  return map[d] || d;
}

function rowClassName({ row }: { row: any }) {
  return row.visible === false ? 'hidden-challenge-row' : '';
}

onMounted(() => loadChallenges());
</script>

<template>
  <div>
    <div style="margin-bottom: 16px;">
      <el-button type="primary" @click="openCreate">创建题目</el-button>
      <el-button @click="loadChallenges" :loading="loading">刷新</el-button>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
      <el-select v-model="filter.category" clearable placeholder="分类筛选" style="width: 160px;">
        <el-option v-for="c in categories" :key="c" :label="c.toUpperCase()" :value="c" />
      </el-select>
      <el-select v-model="filter.difficulty" clearable placeholder="难度筛选" style="width: 160px;">
        <el-option v-for="d in difficulties" :key="d" :label="difficultyText(d)" :value="d" />
      </el-select>
      <el-input v-model="filter.keyword" clearable placeholder="标题搜索" style="width: 200px;" />
      <el-button @click="filter = { category: '', difficulty: '', keyword: '', contest: '' }">重置</el-button>
      <el-tag v-if="filter.contest" closable type="danger" effect="plain" @close="filter.contest = ''">
        比赛：{{ filter.contest }}
      </el-tag>
    </div>

    <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
      <el-button type="primary" @click="batchVisible(true)">批量可见</el-button>
      <el-button @click="batchVisible(false)">批量隐藏</el-button>
      <el-button type="danger" @click="batchDelete">批量删除</el-button>
      <span v-if="selectedChallenges.length > 0" style="line-height: 32px; color: #606266;">已选 {{ selectedChallenges.length }} 题</span>
    </div>

    <div class="challenge-table-wrapper">
      <el-table
        :data="filteredChallenges"
        v-loading="loading"
        style="width: 100%;"
        table-layout="fixed"
        max-height="calc(100vh - 240px)"
        :row-class-name="rowClassName"
        @selection-change="(rows: any[]) => selectedChallenges = rows"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="title" label="标题" width="200" :show-overflow-tooltip="{ showAfter: 1000 }" />
        <el-table-column prop="category" label="分类" width="80" :show-overflow-tooltip="{ showAfter: 1000 }" />
        <el-table-column label="比赛" width="140">
          <template #default="{ row }">
            <el-tooltip v-if="row.contest" :content="row.contest" placement="top" :show-after="1000">
              <el-tag type="danger" effect="plain" size="small" class="challenge-table-contest" style="cursor: pointer;" @click="filter.contest = row.contest">{{ row.contest }}</el-tag>
            </el-tooltip>
            <span v-else style="color: #ccc;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="难度" width="100">
          <template #header>
            <span class="sortable-header" @click="toggleDifficultySort">
              难度
              <el-icon :size="16" :color="difficultySort ? '#409EFF' : '#C0C4CC'">
                <component :is="difficultySort === 'asc' ? SortUp : difficultySort === 'desc' ? SortDown : Sort" />
              </el-icon>
            </span>
          </template>
          <template #default="{ row }">
            <el-tooltip :content="difficultyText(row.difficulty)" placement="top" :show-after="1000">
              <span class="cell-ellipsis">{{ difficultyText(row.difficulty) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="Flag 数量" width="100">
          <template #default="{ row }">
            <el-tooltip :content="`${row.flagCount || 0} 个 flag`" placement="top" :show-after="1000">
              <span>{{ row.flagCount || 0 }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="90">
          <template #default="{ row }">
            <el-tooltip :content="`${row.attachmentCount || 0} 个附件`" placement="top" :show-after="1000">
              <el-tag v-if="row.attachmentCount > 0" type="info" size="small">{{ row.attachmentCount }}</el-tag>
              <span v-else style="color: #ccc;">-</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="image" label="镜像" width="250" :show-overflow-tooltip="{ showAfter: 1000 }" />
        <el-table-column prop="port" label="端口" width="70" :show-overflow-tooltip="{ showAfter: 1000 }" />
        <el-table-column label="备注" width="70">
          <template #default="{ row }">
            <el-tooltip v-if="row.note" :content="row.note" placement="top" :show-after="1000">
              <el-tag type="warning" size="small">有</el-tag>
            </el-tooltip>
            <span v-else style="color: #ccc;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="可见性" width="90">
          <template #default="{ row }">
            <el-tooltip :content="row.visible === false ? '隐藏' : '可见'" placement="top" :show-after="1000">
              <el-tag :type="row.visible === false ? 'danger' : 'success'" size="small">
                {{ row.visible === false ? '隐藏' : '可见' }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="warning" @click="openHintDialog(row)">提示</el-button>
            <el-button size="small" type="danger" @click="removeChallenge(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-empty v-if="!loading && filteredChallenges.length === 0" description="暂无题目" />

    <ChallengeEditDialog v-model="editDialogVisible" :challenge="editingChallenge" @saved="loadChallenges" />
    <ChallengeHintsDialog v-model="hintDialogVisible" :challenge="hintTarget" @changed="loadChallenges" />
  </div>
</template>

<style>
.hidden-challenge-row {
  background-color: #f5f5f5 !important;
  color: #909399;
}

.hidden-challenge-row .el-button {
  opacity: 1;
  filter: none;
}

.challenge-table-wrapper {
  width: 100%;
}
.challenge-table-contest {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.cell-ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.sortable-header {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  user-select: none;
  color: #303133;
}
.sortable-header:hover {
  color: #409EFF;
}
</style>
