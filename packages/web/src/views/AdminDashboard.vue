<script setup lang="ts">
import { onMounted, ref, reactive, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Sort, SortUp, SortDown } from '@element-plus/icons-vue';
import { marked } from 'marked';
import { api } from '../api/client';
import { getCache, setCache } from '../utils/cache';

const activeTab = ref('users');
const challenges = ref<any[]>([]);
const users = ref<any[]>([]);
const userKeyword = ref('');
const userSort = ref<'default' | 'desc' | 'asc'>('default');
const userOnlySolved = ref(false);
const userDetail = ref<any>(null);
const userDetailLoading = ref(false);
const userDialogVisible = ref(false);
const loading = ref(false);
const containers = ref<any[]>([]);
const containerLoading = ref(false);
const containerGroupBy = ref<'user' | 'challenge'>('user');

const selectedChallenges = ref<any[]>([]);

const dialogVisible = ref(false);
const isEdit = ref(false);
const form = reactive({
  id: '',
  title: '',
  description: '',
  category: 'web',
  difficulty: 'easy',
  contest: '',
  flags: [] as string[],
  image: '',
  port: 80,
  visible: true,
  note: '',
});
const flagInput = ref('');
const existingAttachments = ref<any[]>([]);
const originalAttachmentVisibility = ref<Record<string, boolean>>({});
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFiles = ref<File[]>([]);

const templateOptions = [
  { label: '不使用模板', value: '' },
  { label: 'Web', value: 'web' },
  { label: 'Pwn', value: 'pwn' },
  { label: 'Reverse', value: 'reverse' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Misc', value: 'misc' },
  { label: 'CVE 复现', value: 'cve' },
];
const selectedTemplate = ref('');

const templates: Record<string, any> = {
  web: {
    title: 'Web 示例题',
    description: '目标站点运行在容器端口上，请通过浏览器或工具访问，找到 flag。',
    category: 'web',
    difficulty: 'easy',
    flags: ['flag{web_example}'],
    image: 'localtrain/web-example:latest',
    port: 80,
    visible: true,
  },
  pwn: {
    title: 'Pwn 示例题',
    description: '远程二进制服务运行在 nc 地址上，利用漏洞获取 shell 并读取 flag。',
    category: 'pwn',
    difficulty: 'medium',
    flags: ['flag{pwn_example}'],
    image: 'localtrain/pwn-example:latest',
    port: 9999,
    visible: true,
  },
  reverse: {
    title: 'Reverse 示例题',
    description: '分析附件中的二进制程序，找到正确的输入或隐藏逻辑，得到 flag。',
    category: 'reverse',
    difficulty: 'medium',
    flags: ['flag{reverse_example}'],
    image: '',
    port: 80,
    visible: true,
  },
  crypto: {
    title: 'Crypto 示例题',
    description: '附件中有一段加密数据或可疑文本，分析算法并解出 flag。',
    category: 'crypto',
    difficulty: 'medium',
    flags: ['flag{crypto_example}'],
    image: '',
    port: 80,
    visible: true,
  },
  misc: {
    title: 'Misc 示例题',
    description: '附件中隐藏了 flag，请使用各类工具仔细分析。',
    category: 'misc',
    difficulty: 'easy',
    flags: ['flag{misc_example}'],
    image: '',
    port: 80,
    visible: true,
  },
  cve: {
    title: 'CVE 复现题',
    description: '环境中运行着存在已知 CVE 的服务，请利用漏洞获取 flag。',
    category: 'cve',
    difficulty: 'hard',
    flags: ['flag{cve_example}'],
    image: 'localtrain/cve-example:latest',
    port: 8080,
    visible: true,
  },
};

function applyTemplate(value: string) {
  if (!value || isEdit.value) return;
  const t = templates[value];
  if (!t) return;
  Object.assign(form, { ...t, id: '' });
  flagInput.value = '';
  existingAttachments.value = [];
  selectedFiles.value = [];
  if (fileInput.value) fileInput.value.value = '';
  ElMessage.success(`已应用 ${value.toUpperCase()} 模板`);
}

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

const activeContainerPanels = ref<string[]>([]);

const groupedContainers = computed(() => {
  if (containerGroupBy.value === 'challenge') {
    const map = new Map<string, { key: string; label: string; containers: any[] }>();
    for (const c of containers.value) {
      const label = c.challengeTitle || '未知题目';
      if (!map.has(label)) {
        map.set(label, { key: label, label, containers: [] });
      }
      map.get(label)!.containers.push(c);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }
  const map = new Map<string, { key: string; label: string; containers: any[] }>();
  for (const c of containers.value) {
    const label = c.username || '未知用户';
    if (!map.has(label)) {
      map.set(label, { key: label, label, containers: [] });
    }
    map.get(label)!.containers.push(c);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
});

const hintDialog = ref(false);
const currentChallengeId = ref('');
const currentChallengeTitle = ref('');
const currentHints = ref<any[]>([]);
const hintLoading = ref(false);
const hintFormVisible = ref(false);
const isHintEdit = ref(false);
const hintForm = reactive({
  id: '',
  level: 1,
  label: '',
  content: '',
  scorePenalty: 0,
});

const CACHE_TTL_MS = 60 * 1000; // 1 分钟

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

async function loadUsers() {
  const cached = getCache<any[]>('admin:users', CACHE_TTL_MS);
  if (cached) {
    users.value = cached;
  }
  try {
    const { data } = await api.get('/users');
    users.value = data;
    setCache('admin:users', data);
  } catch (err: any) {
    if (!cached) ElMessage.error(err.response?.data?.error || '加载用户失败');
  }
}

async function loadContainers(showLoading = true) {
  const cached = getCache<any[]>('admin:containers', CACHE_TTL_MS);
  if (cached) {
    containers.value = cached;
    if (showLoading) containerLoading.value = false;
  } else if (showLoading) {
    containerLoading.value = true;
  }
  try {
    const { data } = await api.get('/challenges/containers/all');
    containers.value = data;
    setCache('admin:containers', data);
  } catch (err: any) {
    if (!cached) ElMessage.error(err.response?.data?.error || '加载容器失败');
  } finally {
    if (showLoading) containerLoading.value = false;
  }
}

async function stopContainer(row: any) {
  try {
    await api.post(`/challenges/${row.challengeId}/stop`);
    ElMessage.success('关闭成功');
    loadContainers();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '关闭失败');
  }
}

function formatContainerTime(expiresAt: string) {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  if (seconds <= 0) return '已过期';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}小时 ${m}分 ${s}秒`;
}

async function extendContainer(row: any) {
  try {
    await api.post(`/challenges/containers/${row.containerId}/extend`);
    ElMessage.success('延长成功');
    loadContainers();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '延长失败');
  }
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

const renderedDescription = computed(() => {
  return marked.parse(form.description || '', { async: false }) as string;
});

function openCreate() {
  isEdit.value = false;
  selectedTemplate.value = '';
  Object.assign(form, {
    id: '',
    title: '',
    description: '',
    category: 'web',
    difficulty: 'easy',
    contest: '',
    flags: [],
    image: '',
    port: 80,
    visible: true,
    note: '',
  });
  flagInput.value = '';
  existingAttachments.value = [];
  selectedFiles.value = [];
  if (fileInput.value) fileInput.value.value = '';
  dialogVisible.value = true;
}

function openEdit(c: any) {
  isEdit.value = true;
  Object.assign(form, {
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    flags: c.flags ? c.flags.map((f: any) => f.value) : [],
    image: c.image,
    port: c.port,
    contest: c.contest || '',
    visible: c.visible !== false,
    note: c.note || '',
  });
  flagInput.value = '';
  existingAttachments.value = (c.attachments || []).map((att: any) => ({
    ...att,
    visibleToUser: att.visibleToUser !== false,
  }));
  originalAttachmentVisibility.value = {};
  for (const att of existingAttachments.value) {
    originalAttachmentVisibility.value[att.id] = att.visibleToUser;
  }
  selectedFiles.value = [];
  if (fileInput.value) fileInput.value.value = '';
  dialogVisible.value = true;
}

function addFlag() {
  const value = flagInput.value.trim();
  if (!value) return;
  if (form.flags.includes(value)) {
    ElMessage.warning('该 flag 已存在');
    return;
  }
  form.flags.push(value);
  flagInput.value = '';
}

function removeFlag(index: number) {
  form.flags.splice(index, 1);
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  selectedFiles.value = Array.from(target.files || []);
}

async function removeAttachment(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该附件吗？', '提示', { type: 'warning' });
    await api.delete(`/challenges/${form.id}/attachments/${id}`);
    ElMessage.success('删除成功');
    existingAttachments.value = existingAttachments.value.filter((a) => a.id !== id);
    loadChallenges();
  } catch {
    // cancelled
  }
}

async function downloadAttachment(att: any) {
  try {
    const res = await api.get(`/challenges/${form.id}/attachments/${att.id}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '下载失败');
  }
}

async function renameAttachment(att: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的附件名', '重命名附件', {
      inputValue: att.originalName,
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPattern: /\S/,
      inputErrorMessage: '附件名不能为空',
    });
    const { data } = await api.put(`/challenges/${form.id}/attachments/${att.id}`, { originalName: value });
    att.originalName = data.originalName;
    ElMessage.success('重命名成功');
    loadChallenges();
  } catch (err: any) {
    if (err === 'cancel' || err?.name === 'Cancel') return;
    ElMessage.error(err.response?.data?.error || '重命名失败');
  }
}

async function saveChallenge() {
  if (form.flags.length === 0) {
    ElMessage.error('至少需要填写一个 flag');
    return;
  }

  const payload = new FormData();
  payload.append('title', form.title);
  payload.append('description', form.description);
  payload.append('category', form.category);
  payload.append('difficulty', form.difficulty);
  payload.append('image', form.image);
  payload.append('port', String(form.port));
  payload.append('contest', form.contest);
  payload.append('visible', String(form.visible));
  payload.append('note', form.note);
  form.flags.forEach((f) => payload.append('flags', f));
  selectedFiles.value.forEach((file) => payload.append('attachments', file));

  try {
    if (isEdit.value) {
      await api.put(`/challenges/${form.id}`, payload);
      for (const att of existingAttachments.value) {
        const initial = originalAttachmentVisibility.value[att.id];
        if (initial !== undefined && att.visibleToUser !== initial) {
          await api.put(`/challenges/${form.id}/attachments/${att.id}/visible`, {
            visibleToUser: att.visibleToUser,
          });
        }
      }
      ElMessage.success('更新成功');
    } else {
      await api.post('/challenges', payload);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadChallenges();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败');
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

async function openHintDialog(c: any) {
  currentChallengeId.value = c.id;
  currentChallengeTitle.value = c.title;
  hintFormVisible.value = false;
  isHintEdit.value = false;
  resetHintForm();
  hintDialog.value = true;
  await loadHints();
}

async function loadHints() {
  hintLoading.value = true;
  try {
    const { data } = await api.get(`/challenges/${currentChallengeId.value}/hints`);
    currentHints.value = data;
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载提示失败');
  } finally {
    hintLoading.value = false;
  }
}

function resetHintForm() {
  Object.assign(hintForm, { id: '', level: 1, label: '', content: '', scorePenalty: 0 });
}

function openAddHint() {
  isHintEdit.value = false;
  resetHintForm();
  hintForm.level = currentHints.value.length + 1;
  hintFormVisible.value = true;
}

function openEditHint(h: any) {
  isHintEdit.value = true;
  Object.assign(hintForm, { ...h });
  hintFormVisible.value = true;
}

async function saveHint() {
  try {
    if (isHintEdit.value) {
      await api.put(`/challenges/${currentChallengeId.value}/hints/${hintForm.id}`, { ...hintForm });
      ElMessage.success('提示更新成功');
    } else {
      await api.post(`/challenges/${currentChallengeId.value}/hints`, { ...hintForm });
      ElMessage.success('提示添加成功');
    }
    hintFormVisible.value = false;
    resetHintForm();
    await loadHints();
    loadChallenges();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败');
  }
}

async function removeHint(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该提示吗？', '提示', { type: 'warning' });
    await api.delete(`/challenges/${currentChallengeId.value}/hints/${id}`);
    ElMessage.success('删除成功');
    await loadHints();
    loadChallenges();
  } catch {
    // cancelled
  }
}

onMounted(() => {
  loadChallenges();
  loadUsers();
  loadContainers();
});

function difficultyText(d: string) {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难', expert: '专家' };
  return map[d] || d;
}

function rowClassName({ row }: { row: any }) {
  return row.visible === false ? 'hidden-challenge-row' : '';
}
</script>

<template>
  <div>
    <h1>管理后台</h1>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="用户列表" name="users">
        <div style="margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
          <el-input v-model="userKeyword" clearable placeholder="搜索用户名" style="width: 240px;" />
          <el-select v-model="userSort" placeholder="积分排序" style="width: 140px;">
            <el-option label="默认" value="default" />
            <el-option label="积分从高到低" value="desc" />
            <el-option label="积分从低到高" value="asc" />
          </el-select>
          <el-checkbox v-model="userOnlySolved">仅看有解题记录</el-checkbox>
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
      </el-tab-pane>

      <el-tab-pane label="题目管理" name="challenges">
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
                <el-tooltip :content="`${row.flags?.length || 0} 个 flag`" placement="top" :show-after="1000">
                  <span>{{ row.flags?.length || 0 }}</span>
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
      </el-tab-pane>
      <el-tab-pane label="容器管理" name="containers">
        <div style="margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
          <el-button @click="loadContainers" :loading="containerLoading">刷新</el-button>
          <el-radio-group v-model="containerGroupBy">
            <el-radio-button label="user">按用户分组</el-radio-button>
            <el-radio-button label="challenge">按题目分组</el-radio-button>
          </el-radio-group>
        </div>
        <div v-loading="containerLoading">
          <el-collapse v-if="groupedContainers.length" v-model="activeContainerPanels">
            <el-collapse-item v-for="group in groupedContainers" :key="group.key" :name="group.key" :title="`${group.label}（${group.containers.length} 个容器）`">
              <el-table :data="group.containers" style="width: 100%;" :show-header="true">
                <el-table-column :prop="containerGroupBy === 'user' ? 'challengeTitle' : 'username'" :label="containerGroupBy === 'user' ? '题目' : '用户'" min-width="160" :show-overflow-tooltip="{ showAfter: 1000 }" />
                <el-table-column label="访问地址" min-width="180">
                  <template #default="{ row }">
                    <a :href="row.url" target="_blank">{{ row.url }}</a>
                  </template>
                </el-table-column>
                <el-table-column prop="hostPort" label="端口" width="90" />
                <el-table-column label="启动时间" min-width="160">
                  <template #default="{ row }">
                    {{ row.startedAt ? new Date(row.startedAt).toLocaleString() : '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="剩余时间" width="160">
                  <template #default="{ row }">
                    {{ formatContainerTime(row.expiresAt) }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" @click="extendContainer(row)">延长 1h</el-button>
                    <el-button size="small" type="danger" @click="stopContainer(row)">关闭</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>
          <el-empty v-if="!containerLoading && groupedContainers.length === 0" description="暂无运行中的容器" />
        </div>
      </el-tab-pane>
    </el-tabs>

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

    <!-- 题目表单 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑题目' : '创建题目'" width="600px">
      <el-form label-width="80px">
        <el-form-item v-if="!isEdit" label="出题模板">
          <el-select v-model="selectedTemplate" placeholder="选择模板快速填充" clearable style="width: 100%;" @change="applyTemplate">
            <el-option v-for="opt in templateOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="描述">
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <el-input v-model="form.description" type="textarea" :rows="10" style="flex: 1; min-width: 280px;" placeholder="支持 Markdown，右侧可实时预览" />
            <div style="flex: 1; min-width: 280px; max-height: 260px; overflow: auto; border: 1px solid #dcdfe6; border-radius: 4px; padding: 12px; background: #fafafa;">
              <div v-html="renderedDescription" style="word-break: break-word;" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" style="width: 100%;">
            <el-option v-for="c in ['web', 'pwn', 'reverse', 'crypto', 'misc', 'cve']" :key="c" :label="c.toUpperCase()" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="form.difficulty" style="width: 100%;">
            <el-option v-for="d in ['easy', 'medium', 'hard', 'expert']" :key="d" :label="difficultyText(d)" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="比赛">
          <el-input v-model="form.contest" placeholder="例如 ISCC 2024,留空表示非比赛题" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="3" placeholder="仅管理员可见；留空则不显示" />
        </el-form-item>
        <el-form-item label="Flags">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <div style="display: flex; gap: 8px;">
              <el-input v-model="flagInput" placeholder="输入 flag 后回车添加" @keyup.enter="addFlag" />
              <el-button @click="addFlag">添加</el-button>
            </div>
            <div v-if="form.flags.length > 0" style="display: flex; flex-wrap: wrap; gap: 8px;">
              <el-tag v-for="(f, index) in form.flags" :key="index" closable @close="removeFlag(index)">
                {{ f }}
              </el-tag>
            </div>
            <p v-else style="color: #999; font-size: 12px; margin: 0;">至少需要一个 flag</p>
          </div>
        </el-form-item>
        <el-form-item label="镜像">
          <el-input v-model="form.image" placeholder="例如 nginx:alpine" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="form.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="可见性">
          <el-switch
            v-model="form.visible"
            active-text="可见"
            inactive-text="隐藏"
          />
        </el-form-item>
        <el-form-item label="附件">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <input ref="fileInput" type="file" multiple @change="onFileChange" />
            <p v-if="selectedFiles.length > 0" style="color: #666; font-size: 12px; margin: 0;">
              待上传：{{ selectedFiles.map(f => f.name).join(', ') }}
            </p>
            <div v-if="existingAttachments.length > 0" style="display: flex; flex-direction: column; gap: 4px;">
              <p style="margin: 0; font-size: 12px; color: #999;">已有附件（关闭「用户可见」后普通用户将无法看到该附件）：</p>
              <div v-for="att in existingAttachments" :key="att.id" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <el-link type="primary" @click="downloadAttachment(att)">{{ att.originalName }}</el-link>
                <el-tag v-if="!att.visibleToUser" type="warning" size="small">仅管理员可见</el-tag>
                <el-switch
                  v-model="att.visibleToUser"
                  active-text="用户可见"
                  inactive-text="隐藏"
                  inline-prompt
                />
                <el-button type="primary" size="small" link @click="renameAttachment(att)">重命名</el-button>
                <el-button type="danger" size="small" link @click="removeAttachment(att.id)">删除</el-button>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveChallenge">保存</el-button>
      </template>
    </el-dialog>

    <!-- 提示管理 -->
    <el-dialog v-model="hintDialog" :title="`管理提示：${currentChallengeTitle}`" width="700px">
      <div v-loading="hintLoading">
        <div style="margin-bottom: 16px;">
          <el-button type="primary" @click="openAddHint" :disabled="hintFormVisible">新增提示</el-button>
        </div>

        <el-table :data="currentHints" style="width: 100%;" v-if="currentHints.length > 0">
          <el-table-column prop="level" label="级别" width="80" />
          <el-table-column prop="label" label="名称" />
          <el-table-column prop="content" label="内容" show-overflow-tooltip />
          <el-table-column prop="scorePenalty" label="扣分" width="80" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button size="small" @click="openEditHint(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="removeHint(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无提示" />

        <el-card v-if="hintFormVisible" style="margin-top: 16px;" shadow="never">
          <template #header>
            <strong>{{ isHintEdit ? '编辑提示' : '新增提示' }}</strong>
          </template>
          <el-form label-width="80px">
            <el-form-item label="级别">
              <el-input-number v-model="hintForm.level" :min="1" />
            </el-form-item>
            <el-form-item label="名称">
              <el-input v-model="hintForm.label" placeholder="例如 初级提示" />
            </el-form-item>
            <el-form-item label="内容">
              <el-input v-model="hintForm.content" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item label="扣分">
              <el-input-number v-model="hintForm.scorePenalty" :min="0" />
            </el-form-item>
          </el-form>
          <div style="text-align: right;">
            <el-button @click="hintFormVisible = false">取消</el-button>
            <el-button type="primary" @click="saveHint">保存</el-button>
          </div>
        </el-card>
      </div>
    </el-dialog>
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

.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3,
.markdown-preview h4,
.markdown-preview h5,
.markdown-preview h6 {
  margin-top: 12px;
  margin-bottom: 8px;
}
.markdown-preview p {
  margin: 8px 0;
}
.markdown-preview pre {
  background: #f0f0f0;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}
.markdown-preview code {
  background: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
}
.markdown-preview blockquote {
  border-left: 4px solid #dcdfe6;
  margin: 8px 0;
  padding-left: 12px;
  color: #606266;
}
.markdown-preview ul,
.markdown-preview ol {
  padding-left: 20px;
}
</style>
