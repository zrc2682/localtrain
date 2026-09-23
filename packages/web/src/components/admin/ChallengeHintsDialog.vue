<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../../api/client';

const props = defineProps<{ modelValue: boolean; challenge: any | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'changed'): void }>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

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

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    hintFormVisible.value = false;
    isHintEdit.value = false;
    resetHintForm();
    loadHints();
  },
);

async function loadHints() {
  if (!props.challenge) return;
  hintLoading.value = true;
  try {
    const { data } = await api.get(`/challenges/${props.challenge.id}/hints`);
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
  if (!props.challenge) return;
  try {
    if (isHintEdit.value) {
      await api.put(`/challenges/${props.challenge.id}/hints/${hintForm.id}`, { ...hintForm });
      ElMessage.success('提示更新成功');
    } else {
      await api.post(`/challenges/${props.challenge.id}/hints`, { ...hintForm });
      ElMessage.success('提示添加成功');
    }
    hintFormVisible.value = false;
    resetHintForm();
    await loadHints();
    emit('changed');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败');
  }
}

async function removeHint(id: string) {
  if (!props.challenge) return;
  try {
    await ElMessageBox.confirm('确定删除该提示吗？', '提示', { type: 'warning' });
    await api.delete(`/challenges/${props.challenge.id}/hints/${id}`);
    ElMessage.success('删除成功');
    await loadHints();
    emit('changed');
  } catch {
    // cancelled
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="`管理提示：${props.challenge?.title || ''}`" width="700px">
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
</template>
