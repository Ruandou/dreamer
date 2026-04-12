<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  NCard,
  NButton,
  NSpace,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NTag,
  NDropdown,
  useMessage,
  useDialog,
} from "naive-ui";
import { api } from "@/api";
import { useProjectStore } from "@/stores/project";
import EmptyState from "@/components/EmptyState.vue";
import StatusBadge from "@/components/StatusBadge.vue";

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const projectStore = useProjectStore();

const showCreateModal = ref(false);
const newProject = ref({ name: "", description: "" });
const searchQuery = ref("");
const quickIdea = ref("");
const isCreating = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  projectStore.fetchProjects();
});

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) {
    return projectStore.projects;
  }
  const query = searchQuery.value.toLowerCase();
  return projectStore.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query)),
  );
});

const handleCreate = () => {
  showCreateModal.value = true;
};

const handleFileChange = (options: { file: UploadFileInfo }) => {
  const file = options.file;
  if (!file.file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    quickIdea.value = e.target?.result as string;
    message.success("剧本已导入");
  };
  reader.readAsText(file.file);
};

const handleFileUpload = (fileList: { file: UploadFileInfo }[]) => {
  const file = fileList[0]?.file;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    quickIdea.value = e.target?.result as string;
    message.success("剧本已导入");
  };
  reader.readAsText(file);
};

const handleFileInputClick = () => {
  fileInputRef.value?.click();
};

const handleFileInputChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    quickIdea.value = ev.target?.result as string;
    message.success("剧本已导入");
  };
  reader.readAsText(file);
};

const handleDrop = (e: DragEvent) => {
  const files = e.dataTransfer?.files;
  if (!files?.length) return;

  const file = files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    quickIdea.value = ev.target?.result as string;
    message.success("剧本已导入");
  };
  reader.readAsText(file);
};

const handleQuickCreate = async () => {
  if (!quickIdea.value.trim()) {
    message.warning("请输入剧本想法");
    return;
  }
  isCreating.value = true;
  try {
    const response = await api.post("/projects/generate-outline", {
      idea: quickIdea.value,
    });
    const jobId = response.data.jobId;
    router.push(`/generate?jobId=${jobId}`);
  } catch (e: any) {
    message.error(e.message || "创建任务失败");
    isCreating.value = false;
  }
};

const handleSubmit = async () => {
  if (!newProject.value.name.trim()) {
    message.warning("请输入项目名称");
    return;
  }
  const project = await projectStore.createProject(newProject.value);
  showCreateModal.value = false;
  newProject.value = { name: "", description: "" };
  router.push(`/project/${project.id}`);
};

const handleProjectClick = (id: string) => {
  router.push(`/project/${id}`);
};

const handleDelete = (id: string) => {
  dialog.warning({
    title: "确认删除",
    content: "确定要删除这个项目吗？此操作不可撤销。",
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      await projectStore.deleteProject(id);
      message.success("项目已删除");
    },
  });
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const dropdownOptions = [{ label: "删除", key: "delete" }];

const handleDropdownSelect = (key: string, projectId: string) => {
  if (key === "delete") {
    handleDelete(projectId);
  }
};
</script>

<template>
  <div class="projects-page">
    <!-- Header -->
    <header class="projects-header">
      <div class="projects-header__info">
        <h1 class="projects-header__title">我的项目</h1>
        <p class="projects-header__count" v-if="projectStore.projects.length">
          共 {{ projectStore.projects.length }} 个项目
        </p>
      </div>
      <div class="projects-header__actions">
        <NSpace>
          <NInput
            v-model:value="searchQuery"
            placeholder="搜索项目..."
            clearable
            style="width: 200px"
          >
            <template #prefix>
              <span class="search-icon">🔍</span>
            </template>
          </NInput>
          <NButtonGroup>
            <NButton @click="router.push('/jobs')"> 📋 任务 </NButton>
            <NButton @click="router.push('/stats')"> 📊 统计 </NButton>
            <NButton @click="router.push('/settings')"> ⚙️ 设置 </NButton>
          </NButtonGroup>
        </NSpace>
      </div>
    </header>

    <!-- Quick Create -->
    <div
      class="quick-create"
      @drop.prevent="handleDrop"
      @dragover.prevent
      @dragenter.prevent
    >
      <div class="quick-create__input-wrap">
        <NInput
          v-model:value="quickIdea"
          type="textarea"
          placeholder="✨ 输入想法，快速创建短剧... 或 拖拽剧本文件到此处"
          :rows="3"
          @keydown.enter.ctrl="handleQuickCreate"
        />
      </div>
      <div class="quick-create__actions">
        <NSpace justify="center">
          <NButton secondary @click="handleFileInputClick">导入剧本</NButton>
          <NButton
            type="primary"
            @click="handleQuickCreate"
            :disabled="!quickIdea.trim()"
            :loading="isCreating"
          >
            生成大纲 →
          </NButton>
        </NSpace>
      </div>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept=".md,.txt,.json"
      style="display: none"
      @change="handleFileInputChange"
    />

    <!-- Content -->
    <div class="projects-content">
      <!-- Empty State -->
      <EmptyState
        v-if="!projectStore.projects.length"
        title="暂无项目"
        description="创建你的第一个短剧项目，开始 AI 创作之旅"
        icon="🎬"
      >
        <template #action>
          <NSpace>
            <NButton @click="handleImport">导入剧本</NButton>
            <NButton type="primary" @click="handleCreate">新建项目</NButton>
          </NSpace>
        </template>
      </EmptyState>

      <!-- Search Empty -->
      <EmptyState
        v-else-if="!filteredProjects.length"
        title="未找到项目"
        description="尝试其他搜索词"
        icon="🔍"
      />

      <!-- Grid View -->
      <template v-else>
        <div class="projects-grid">
          <NCard
            v-for="project in filteredProjects"
            :key="project.id"
            class="project-card"
            hoverable
            @click="handleProjectClick(project.id)"
          >
            <div class="project-card__cover">
              <div class="project-card__cover-placeholder">🎬</div>
              <StatusBadge status="draft" class="project-card__status" />
            </div>

            <div class="project-card__body">
              <h3 class="project-card__title">{{ project.name }}</h3>
              <p class="project-card__desc">
                {{ project.description || "暂无描述" }}
              </p>
            </div>

            <div class="project-card__footer">
              <span class="project-card__date">{{
                formatDate(project.createdAt)
              }}</span>
              <NDropdown
                :options="dropdownOptions"
                @select="(key) => handleDropdownSelect(key, project.id)"
                trigger="click"
                @click.stop
              >
                <NButton text size="small" @click.stop> ⋮ </NButton>
              </NDropdown>
            </div>
          </NCard>
        </div>
      </template>
    </div>

    <!-- Create Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="新建项目"
      style="width: 480px"
      :bordered="false"
    >
      <NForm :model="newProject" label-placement="top">
        <NFormItem label="项目名称" path="name">
          <NInput
            v-model:value="newProject.name"
            placeholder="给你的短剧起个名字"
          />
        </NFormItem>
        <NFormItem label="项目描述" path="description">
          <NInput
            v-model:value="newProject.description"
            type="textarea"
            placeholder="简要描述故事背景或创作方向（可选）"
            :rows="3"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit">创建项目</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.projects-page {
  min-height: 100vh;
  padding: var(--spacing-lg);
  background: var(--color-bg-base);
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.projects-header__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.projects-header__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.projects-content {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  min-height: 400px;
}

.quick-create {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
}

.quick-create__input-wrap {
  width: 100%;
}

.quick-create__actions {
  display: flex;
  justify-content: center;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.project-card {
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.project-card__cover {
  position: relative;
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-card__cover-placeholder {
  font-size: 48px;
  opacity: 0.8;
}

.project-card__status {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
}

.project-card__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.project-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.project-card__date {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
</style>
