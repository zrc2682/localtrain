<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../../api/client';
import { getCache, setCache } from '../../utils/cache';

const containers = ref<any[]>([]);
const containerLoading = ref(false);
const containerGroupBy = ref<'user' | 'challenge'>('user');
const activeContainerPanels = ref<string[]>([]);

const CACHE_TTL_MS = 60 * 1000; // 1 分钟

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

async function extendContainer(row: any) {
  try {
    await api.post(`/challenges/containers/${row.containerId}/extend`);
    ElMessage.success('延长成功');
    loadContainers();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '延长失败');
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

onMounted(() => loadContainers());
</script>

<template>
  <div>
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
  </div>
</template>
