<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { use } from 'echarts/core';
import { Refresh } from '@element-plus/icons-vue';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { api } from '../api/client';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent]);

interface LeaderboardUser {
  id: string;
  username: string;
  scores: number[];
  lastUpdated: string | null;
  totalScore: number;
}

interface LeaderboardData {
  dates: string[];
  users: LeaderboardUser[];
}

const data = ref<LeaderboardData | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const { data: res } = await api.get('/users/leaderboard');
    data.value = res;
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载排行榜失败');
  } finally {
    loading.value = false;
  }
}

const chartOption = computed(() => {
  if (!data.value) return {};
  const { dates, users } = data.value;

  // 隐藏完全没有积分变化的用户，避免空线干扰
  const activeUsers = users.filter((u) => u.totalScore > 0);

  const palette = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
    '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#ff9f7f',
  ];

  const allScores = activeUsers.flatMap((u) => u.scores);
  const minScore = allScores.length ? Math.min(...allScores) : 0;
  const maxScore = allScores.length ? Math.max(...allScores) : 100;

  return {
    title: { text: '用户积分走势', left: 'center' },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        if (!params || !params.length) return '';
        const date = params[0].name;
        const rows = params
          .map((p) => {
            const u = activeUsers[p.seriesIndex];
            if (!u) return null;
            return `<div style="display:flex;align-items:center;gap:6px;margin:4px 0;">
<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};"></span>
<span style="font-weight:bold">${u.username}</span>：${p.value} 分（最近更新 ${u.lastUpdated || '-'})</div>`;
          })
          .filter(Boolean)
          .join('');
        return `<div style="font-weight:bold;margin-bottom:6px;">${date}</div>${rows}`;
      },
    },
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      bottom: 0,
      data: activeUsers.map((u) => u.username),
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      name: '日期',
    },
    yAxis: {
      type: 'value',
      name: '累计积分',
      scale: true,
      min: minScore,
      max: maxScore,
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'inside', yAxisIndex: 0 },
    ],
    series: activeUsers.map((u, idx) => ({
      name: u.username,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: u.scores,
      lineStyle: { width: 2 },
      itemStyle: { color: palette[idx % palette.length] },
      emphasis: { focus: 'series' },
    })),
  };
});

onMounted(() => {
  load();
});
</script>

<template>
  <div v-loading="loading">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
      <h2 style="margin: 0;">排行榜</h2>
      <el-button :icon="Refresh" :loading="loading" circle size="small" @click="load" title="刷新" />
    </div>
    <p style="color: #999; font-size: 12px; margin-bottom: 12px;">
      从今天起往前推 6 天（共 7 天），每个用户一条线，悬停可查看用户名、当日积分、最近更新日期。
    </p>
    <v-chart
      v-if="data && data.users.length"
      :option="chartOption"
      autoresize
      style="width: 100%; height: 500px;"
    />
    <el-empty v-else-if="!loading" description="暂无积分数据" />
  </div>
</template>
