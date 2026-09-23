<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { marked } from 'marked';
import { api } from '../../api/client';

const props = defineProps<{ modelValue: boolean; challenge: any | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'saved'): void }>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

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

function difficultyText(d: string) {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难', expert: '专家' };
  return map[d] || d;
}

const renderedDescription = computed(() => {
  return marked.parse(form.description || '', { async: false }) as string;
});

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

function resetForm() {
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
  originalAttachmentVisibility.value = {};
  selectedFiles.value = [];
  if (fileInput.value) fileInput.value.value = '';
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.challenge) {
      openEdit(props.challenge);
    } else {
      isEdit.value = false;
      resetForm();
    }
  },
);

async function openEdit(c: any) {
  isEdit.value = true;
  // 列表接口只返回摘要字段，编辑所需的 flags / 附件明细从详情接口拉取
  let detail = c;
  try {
    const { data } = await api.get(`/challenges/${c.id}`);
    detail = data;
  } catch {
    ElMessage.error('获取题目详情失败');
    visible.value = false;
    return;
  }
  Object.assign(form, {
    id: detail.id,
    title: detail.title,
    description: detail.description,
    category: detail.category,
    difficulty: detail.difficulty,
    flags: detail.flags ? detail.flags.map((f: any) => f.value) : [],
    image: detail.image,
    port: detail.port,
    contest: detail.contest || '',
    visible: detail.visible !== false,
    note: detail.note || '',
  });
  flagInput.value = '';
  existingAttachments.value = (detail.attachments || []).map((att: any) => ({
    ...att,
    visibleToUser: att.visibleToUser !== false,
  }));
  originalAttachmentVisibility.value = {};
  for (const att of existingAttachments.value) {
    originalAttachmentVisibility.value[att.id] = att.visibleToUser;
  }
  selectedFiles.value = [];
  if (fileInput.value) fileInput.value.value = '';
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
    emit('saved');
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
    emit('saved');
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
    visible.value = false;
    emit('saved');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败');
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="isEdit ? '编辑题目' : '创建题目'" width="600px">
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
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="saveChallenge">保存</el-button>
    </template>
  </el-dialog>
</template>
