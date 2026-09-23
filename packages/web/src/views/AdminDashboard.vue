<script setup lang="ts">
import { ref } from 'vue';
import AdminUsersTab from '../components/admin/AdminUsersTab.vue';
import AdminChallengesTab from '../components/admin/AdminChallengesTab.vue';
import AdminContainersTab from '../components/admin/AdminContainersTab.vue';

const activeTab = ref('users');
</script>

<template>
  <div>
    <h1>管理后台</h1>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="用户列表" name="users">
        <AdminUsersTab />
      </el-tab-pane>
      <el-tab-pane label="题目管理" name="challenges">
        <AdminChallengesTab />
      </el-tab-pane>
      <el-tab-pane label="容器管理" name="containers">
        <AdminContainersTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
