<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
const router = useRouter();

const FLOAT_KEY = 'localtrain-containers-float';
const floatPos = ref(loadFloatPos());
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0, posX: 0, posY: 0, moved: false });

function loadFloatPos() {
  try {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    const raw = localStorage.getItem(FLOAT_KEY);
    if (raw) {
      const pos = JSON.parse(raw);
      return {
        x: Math.max(0, Math.min(window.innerWidth - 56, pos.x || 0)),
        y: Math.max(0, Math.min(window.innerHeight - 56, pos.y || 0)),
      };
    }
  } catch { /* ignore */ }
  return { x: Math.max(20, window.innerWidth - 76), y: Math.max(20, window.innerHeight - 76) };
}

function saveFloatPos() {
  try {
    localStorage.setItem(FLOAT_KEY, JSON.stringify(floatPos.value));
  } catch { /* ignore */ }
}

function onMouseDown(e: MouseEvent) {
  isDragging.value = true;
  dragStart.value = { x: e.clientX, y: e.clientY, posX: floatPos.value.x, posY: floatPos.value.y, moved: false };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStart.value.x;
  const dy = e.clientY - dragStart.value.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragStart.value.moved = true;
  floatPos.value = {
    x: Math.max(0, Math.min(window.innerWidth - 56, dragStart.value.posX + dx)),
    y: Math.max(0, Math.min(window.innerHeight - 56, dragStart.value.posY + dy)),
  };
}

function onMouseUp() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  saveFloatPos();
}

function onClickFloat() {
  if (dragStart.value.moved) return;
  router.push('/containers');
}

onMounted(() => {
  auth.fetchMe();
});

function logout() {
  auth.logout();
  router.push('/login');
}

async function switchRole() {
  await auth.switchRole();
  window.location.reload();
}
</script>

<template>
  <el-container direction="vertical" style="min-height: 100vh;">
    <el-header
      v-if="auth.isLoggedIn"
      style="display: flex; align-items: center; justify-content: space-between; background: #24292f; color: #fff;"
    >
      <div style="font-weight: bold; font-size: 18px;">
        🚩 LocalTrain
      </div>
      <div style="display: flex; gap: 16px; align-items: center;">
        <el-tag :type="auth.isAdmin ? 'danger' : 'success'">
          {{ auth.user?.username }} / {{ auth.isAdmin ? '管理员' : '普通用户' }}
        </el-tag>
        <el-button size="small" @click="switchRole">
          切换为 {{ auth.isAdmin ? '普通用户' : '管理员' }}
        </el-button>
        <el-button type="primary" size="small" @click="$router.push('/dashboard')">
          题目
        </el-button>
        <el-button type="info" size="small" @click="$router.push('/leaderboard')">
          排行榜
        </el-button>
        <el-button type="info" size="small" @click="$router.push('/profile')">
          个人主页
        </el-button>
        <el-button v-if="auth.isAdmin" type="warning" size="small" @click="$router.push('/admin')">
          管理后台
        </el-button>
        <el-button type="danger" size="small" @click="logout">退出</el-button>
      </div>
    </el-header>

    <el-main>
      <div class="page-container">
        <router-view />
      </div>
    </el-main>
  </el-container>

  <div
    v-if="auth.isLoggedIn"
    class="float-containers"
    :class="{ dragging: isDragging }"
    :style="{ left: floatPos.x + 'px', top: floatPos.y + 'px' }"
    @mousedown.prevent="onMouseDown"
    @click="onClickFloat"
  >
    <el-tooltip content="我的容器" placement="left">
      <el-button circle type="primary" size="large">
        <el-icon><Box /></el-icon>
      </el-button>
    </el-tooltip>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.float-containers {
  position: fixed;
  z-index: 2000;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.float-containers.dragging {
  cursor: grabbing;
}
.float-containers .el-button {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
