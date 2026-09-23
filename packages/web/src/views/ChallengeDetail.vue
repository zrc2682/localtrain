<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api/client';

const route = useRoute();
const router = useRouter();
const challenge = ref<any>(null);
const loading = ref(false);
const flagInputs = ref<{ value: string; solved: boolean; submitting: boolean }[]>([]);
const starting = ref(false);
const stopping = ref(false);
const extending = ref(false);
const resetting = ref(false);
const timeLeft = ref(0);
let timer: any = null;

function formatTimeLeft(seconds: number) {
  if (seconds <= 0) return '已过期';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}小时 ${m}分 ${s}秒`;
}

function updateTimeLeft() {
  if (!challenge.value?.status?.expiresAt) {
    timeLeft.value = 0;
    return;
  }
  const expiresAt = new Date(challenge.value.status.expiresAt).getTime();
  timeLeft.value = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  if (timeLeft.value === 0 && challenge.value.status.running) {
    load();
  }
}

function startTimer() {
  stopTimer();
  updateTimeLeft();
  timer = setInterval(updateTimeLeft, 1000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function initFlagInputs() {
  if (!challenge.value) {
    flagInputs.value = [];
    return;
  }
  const solvedSet = new Set(challenge.value.solvedFlagIndices || []);
  const count = challenge.value.flagCount || challenge.value.flags?.length || 0;
  flagInputs.value = Array.from({ length: count }, (_, index) => ({
    value: '',
    solved: solvedSet.has(index),
    submitting: false,
  }));
}

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get(`/challenges/${route.params.id}`);
    challenge.value = data;
    initFlagInputs();
    updateTimeLeft();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function unlockHint(hint: any) {
  try {
    const { data } = await api.post(`/challenges/${challenge.value.id}/hints/${hint.id}/unlock`);
    hint.unlocked = true;
    hint.content = data.hint.content;
    ElMessage.success('提示已解锁');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '解锁失败');
  }
}

async function startEnv() {
  starting.value = true;
  try {
    const { data } = await api.post(`/challenges/${challenge.value.id}/start`);
    challenge.value.status = data;
    startTimer();
    ElMessage.success('环境已启动');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '启动失败');
  } finally {
    starting.value = false;
  }
}

async function stopEnv() {
  stopping.value = true;
  try {
    await api.post(`/challenges/${challenge.value.id}/stop`);
    await load();
    ElMessage.success('环境已关闭');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '关闭失败');
  } finally {
    stopping.value = false;
  }
}

async function extendEnv() {
  extending.value = true;
  try {
    const { data } = await api.post(`/challenges/${challenge.value.id}/extend`);
    challenge.value.status = data;
    startTimer();
    ElMessage.success('已延长 1 小时');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '延长失败');
  } finally {
    extending.value = false;
  }
}

async function resetChallenge() {
  try {
    await ElMessageBox.confirm('重置后将清空该题目的 flag 进度、已解锁提示和运行环境，确定要继续吗？', '重置题目', { type: 'warning' });
  } catch {
    return;
  }
  resetting.value = true;
  try {
    await api.post(`/challenges/${challenge.value.id}/reset`);
    ElMessage.success('题目已重置');
    await load();
    startTimer();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '重置失败');
  } finally {
    resetting.value = false;
  }
}

async function submitFlag(index: number) {
  const input = flagInputs.value[index];
  if (!input.value.trim()) return;
  input.submitting = true;
  try {
    const { data } = await api.post(`/challenges/${challenge.value.id}/submit`, {
      index,
      flag: input.value.trim(),
    });
    ElMessage[data.correct ? 'success' : 'error'](data.message);
    if (data.correct) {
      input.solved = true;
      if (data.solvedAll) {
        challenge.value.solved = true;
      }
      const solvedSet = new Set(challenge.value.solvedFlagIndices || []);
      solvedSet.add(index);
      challenge.value.solvedFlagIndices = Array.from(solvedSet);
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '提交失败');
  } finally {
    input.submitting = false;
  }
}

async function downloadAttachment(att: any) {
  const url = `/challenges/${challenge.value.id}/attachments/${att.id}/download`;
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: att.mimeType || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = att.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '下载失败');
  }
}

function difficultyText(d: string) {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难', expert: '专家' };
  return map[d] || d;
}

function filterByContest() {
  if (!challenge.value?.contest) return;
  router.push({ path: '/dashboard', query: { contest: challenge.value.contest } });
}

onMounted(() => {
  load().then(startTimer);
});

onUnmounted(stopTimer);
</script>

<template>
  <div v-loading="loading">
    <el-page-header @back="$router.push('/dashboard')" title="返回题目列表" />

    <div v-if="challenge" style="margin-top: 20px;">
      <h1 style="margin-top: 0;">{{ challenge.title }}</h1>
      <div style="margin-bottom: 16px;">
        <el-tag style="margin-right: 8px;">{{ challenge.category.toUpperCase() }}</el-tag>
        <el-tag type="warning">{{ difficultyText(challenge.difficulty) }}</el-tag>
        <el-tag v-if="challenge.contest" type="danger" effect="plain" style="margin-left: 8px; cursor: pointer;" @click="filterByContest">{{ challenge.contest }}</el-tag>
        <el-tag v-if="challenge.solved" type="success" size="small" style="margin-left: 8px;">已完整解出</el-tag>
      </div>

      <el-card style="margin-bottom: 20px;">
        <p style="white-space: pre-wrap;">{{ challenge.description || '暂无描述' }}</p>
      </el-card>

      <el-card v-if="challenge.attachments && challenge.attachments.length > 0" style="margin-bottom: 20px;">
        <template #header>
          <span>题目附件</span>
        </template>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div v-for="att in challenge.attachments" :key="att.id" style="display: flex; align-items: center; gap: 12px;">
            <span>{{ att.originalName }}</span>
            <span style="color: #999; font-size: 12px;">{{ (att.size / 1024).toFixed(1) }} KB</span>
            <el-button type="primary" size="small" @click="downloadAttachment(att)">下载</el-button>
          </div>
        </div>
      </el-card>

      <h3>环境操作</h3>
      <el-card style="margin-bottom: 20px;">
        <div v-if="challenge.status?.running" style="margin-bottom: 16px;">
          <el-alert title="环境运行中" type="success" :closable="false">
            <p>访问地址：<a :href="challenge.status.url" target="_blank">{{ challenge.status.url }}</a></p>
            <p>剩余时间：{{ formatTimeLeft(timeLeft) }}</p>
            <p>创建时间：{{ new Date(challenge.status.startedAt).toLocaleString() }}</p>
          </el-alert>
        </div>
        <div v-else style="margin-bottom: 16px;">
          <el-alert title="环境未启动" type="info" :closable="false" />
        </div>
        <div style="display: flex; gap: 12px;">
          <el-button type="primary" :loading="starting" @click="startEnv" :disabled="challenge.status?.running">
            启动环境
          </el-button>
          <el-button type="danger" :loading="stopping" @click="stopEnv" :disabled="!challenge.status?.running">
            关闭环境
          </el-button>
          <el-button type="warning" :loading="extending" @click="extendEnv" :disabled="!challenge.status?.running">
            延长 1h
          </el-button>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 12px;">
          每个用户最多同时运行 5 个容器，每个容器默认 2 小时，可无限次延长。
        </p>
      </el-card>

      <h3>提交 Flag</h3>
      <el-card style="margin-bottom: 20px;">
        <p style="color: #666; font-size: 13px; margin-bottom: 12px;">
          本题共 {{ challenge.flagCount || challenge.flags?.length || 0 }} 个 flag，每个 flag 对应一个提交框，可分开提交。
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div v-for="(input, index) in flagInputs" :key="index" style="display: flex; align-items: center; gap: 12px;">
            <span style="min-width: 60px;">Flag {{ index + 1 }}</span>
            <el-input
              v-model="input.value"
              :placeholder="`flag{...}`"
              :disabled="input.solved || challenge.solved"
              style="flex: 1;"
            />
            <el-tag v-if="input.solved" type="success">已解出</el-tag>
            <el-button
              v-else
              type="success"
              :loading="input.submitting"
              @click="submitFlag(index)"
            >
              提交
            </el-button>
          </div>
        </div>

        <el-divider v-if="challenge.solved" />

        <div v-if="challenge.solved" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <span style="color: #67c23a; font-weight: 500;">🎉 你已完整解出本题</span>
          <el-button type="info" :loading="resetting" @click="resetChallenge">
            重置题目（重新做题）
          </el-button>
        </div>
      </el-card>

      <h3>提示</h3>
      <el-card>
        <el-empty v-if="challenge.hints.length === 0" description="暂无提示" />
        <el-collapse v-else accordion>
          <el-collapse-item v-for="hint in challenge.hints" :key="hint.id" :title="hint.label">
            <div v-if="hint.unlocked">
              <p>{{ hint.content }}</p>
              <el-tag v-if="hint.scorePenalty > 0" type="warning" size="small">
                扣 {{ hint.scorePenalty }} 分
              </el-tag>
            </div>
            <div v-else>
              <p>该提示尚未解锁，点击下方按钮查看。</p>
              <el-button type="primary" size="small" @click="unlockHint(hint)">
                解锁提示
              </el-button>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>
    </div>
  </div>
</template>
