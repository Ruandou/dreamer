/**
 * 大纲页：生成第一集 / 批量剩余集 / 解析剧本（异步 Job 实现）
 */

import { Prisma } from "@prisma/client";
import { pipelineRepository } from "../repositories/pipeline-repository.js";
import { projectRepository } from "../repositories/project-repository.js";
import {
  writeScriptFromIdea,
  writeEpisodeForProject,
} from "./script-writer.js";
import { applyScriptVisualEnrichment } from "./script-visual-enrich.js";
import { runParseScriptEntityPipeline } from "./parse-script-entity-pipeline.js";
import { getMemoryService } from "./memory/index.js";
import type {
  ScriptContent,
  ScriptScene,
  EpisodePlan,
} from "@dreamer/shared/types";

export const DEFAULT_TARGET_EPISODES = 36;

/**
 * 是否存在进行中的批量剧本或解析任务，用于避免与另一路并发写同一项目。
 */
export async function hasConcurrentOutlinePipelineJob(
  projectId: string,
): Promise<boolean> {
  const n = await pipelineRepository.countOutlineAsyncJobs(projectId);
  return n > 0;
}

/**
 * 当前进行中的大纲页异步任务（第一集 / 批量 / 解析），用于前端刷新后恢复状态。
 * 优先返回 parse-script，再 script-batch，再 script-first，避免误取非解析任务。
 */
export async function getActiveOutlinePipelineJob(projectId: string) {
  return pipelineRepository.getActiveOutlinePipelineJob(projectId);
}

/** 将分集 `Episode.script` 转为 ScriptContent（无效则 null） */
export function scriptFromJson(raw: unknown): ScriptContent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray((o as any).scenes)) return null;
  return raw as ScriptContent;
}

/** 判断 1..targetEpisodes 是否均有有效剧本 JSON（`Episode.script`） */
export function areEpisodeScriptsComplete(
  episodes: { episodeNum: number; script: unknown }[],
  targetEpisodes: number,
): boolean {
  for (let n = 1; n <= targetEpisodes; n++) {
    const ep = episodes.find((e) => e.episodeNum === n);
    if (!ep || !scriptFromJson(ep.script)) return false;
  }
  return true;
}

/** 从已落库分集构建 EpisodePlan（sceneIndices 指向 mergeEpisodesToScriptContent 后的全局 scenes 下标） */
export function buildEpisodePlansFromDbEpisodes(
  episodes: {
    episodeNum: number;
    title: string | null;
    synopsis: string | null;
    script: unknown;
  }[],
  merged: ScriptContent,
): EpisodePlan[] {
  const ordered = [...episodes].sort((a, b) => a.episodeNum - b.episodeNum);
  let offset = 0;
  const plans: EpisodePlan[] = [];
  for (const ep of ordered) {
    const sc = scriptFromJson(ep.script);
    if (!sc) continue;
    const len = sc.scenes.length;
    plans.push({
      episodeNum: ep.episodeNum,
      title: ep.title || `${merged.title} 第${ep.episodeNum}集`,
      synopsis: ep.synopsis || sc.summary || "",
      sceneCount: len,
      estimatedDuration: len * 12,
      keyMoments: [],
      sceneIndices: Array.from({ length: len }, (_, i) => offset + i),
    });
    offset += len;
  }
  return plans;
}

async function updateJob(
  jobId: string,
  data: {
    status?: string;
    currentStep?: string;
    progress?: number;
    progressMeta?: object | null;
    error?: string | null;
  },
) {
  const payload: Prisma.PipelineJobUpdateInput = {};
  if (data.status !== undefined) payload.status = data.status;
  if (data.currentStep !== undefined) payload.currentStep = data.currentStep;
  if (data.progress !== undefined) payload.progress = data.progress;
  if (data.error !== undefined) payload.error = data.error;
  if (data.progressMeta !== undefined) {
    payload.progressMeta =
      data.progressMeta === null
        ? Prisma.JsonNull
        : (data.progressMeta as Prisma.InputJsonValue);
  }

  await pipelineRepository.updateJob(jobId, payload);
}

/** 合并多集剧本 JSON 为单一 ScriptContent（供实体提取 / 分镜等） */
export function mergeEpisodesToScriptContent(
  episodes: { episodeNum: number; title: string | null; script: unknown }[],
): ScriptContent {
  const ordered = [...episodes].sort((a, b) => a.episodeNum - b.episodeNum);
  const allScenes: ScriptScene[] = [];
  let baseTitle = "剧本";
  let baseSummary = "";

  for (const ep of ordered) {
    const sc = scriptFromJson(ep.script);
    if (!sc) continue;
    if (ep.episodeNum === 1) {
      baseTitle = sc.title || ep.title || baseTitle;
      baseSummary = sc.summary || baseSummary;
    }
    const offset = allScenes.length;
    sc.scenes.forEach((scene, i) => {
      allScenes.push({
        ...scene,
        sceneNum: offset + i + 1,
      });
    });
  }

  return {
    title: baseTitle,
    summary: baseSummary,
    metadata: {},
    scenes: allScenes,
  };
}

async function fillEpisodeSynopses(projectId: string) {
  const episodes = await projectRepository.findManyEpisodesOrdered(projectId);
  for (const ep of episodes) {
    if (ep.synopsis?.trim()) continue;
    const sc = scriptFromJson(ep.script);
    if (!sc) continue;
    const synopsis =
      sc.summary?.trim() ||
      sc.scenes[0]?.description?.slice(0, 200) ||
      `第${ep.episodeNum}集`;
    await projectRepository.updateEpisodeSynopsis(ep.id, synopsis);
  }
}

export async function runGenerateFirstEpisode(projectId: string) {
  const project = await projectRepository.findUniqueById(projectId);
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const idea = project.description?.trim() || project.name;
  const { script } = await writeScriptFromIdea(idea, {
    modelLog: {
      userId: project.userId,
      projectId,
      op: "generate_first_episode",
    },
  });

  const storyContext = [project.synopsis || script.summary, script.summary]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);

  await projectRepository.update(projectId, {
    synopsis: script.summary,
    storyContext,
  });

  const episode = await projectRepository.upsertEpisodeFirstFromScript(
    projectId,
    script,
  );

  // 提取第一集的记忆
  try {
    const memoryService = getMemoryService();
    await memoryService.extractAndSaveMemories(
      projectId,
      1,
      episode.id,
      script,
      {
        userId: project.userId,
        projectId,
        op: "extract_first_episode_memories",
      },
    );
  } catch (error) {
    console.error("Failed to extract memories for first episode:", error);
    // 不阻断流程，继续执行
  }
}

/**
 * 将「生成第一集」绑定到 PipelineJob（互斥与刷新恢复）。
 * 仅由 `POST .../episodes/generate-first` 调用；`ensureAllEpisodeScripts` 内请直接调 `runGenerateFirstEpisode`。
 */
export async function runGenerateFirstEpisodePipelineJob(
  jobId: string,
  projectId: string,
) {
  await updateJob(jobId, {
    status: "running",
    currentStep: "script-first",
    progress: 5,
  });
  try {
    await runGenerateFirstEpisode(projectId);
    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "completed",
      progressMeta: { message: "第一集已生成" },
    });
  } catch (e: any) {
    await updateJob(jobId, {
      status: "failed",
      error: e?.message || "生成第一集失败",
      progressMeta: { message: e?.message },
    });
    throw e;
  }
}

export type RunScriptBatchJobOptions = {
  /** 嵌入「解析剧本」任务：不另建 script-batch，进度写在同一 job 上，且结束时保持 running 供后续解析步骤 */
  embeddedInParse?: boolean;
};

export async function runScriptBatchJob(
  jobId: string,
  projectId: string,
  targetEpisodes: number,
  opts?: RunScriptBatchJobOptions,
) {
  const embedded = Boolean(opts?.embeddedInParse);
  if (embedded) {
    await updateJob(jobId, {
      status: "running",
      currentStep: "parse-script",
      progress: 8,
      progressMeta: { message: "补全或批量生成剩余剧集…" },
    });
  } else {
    await updateJob(jobId, {
      status: "running",
      currentStep: "script-batch",
      progress: 0,
    });
  }

  const project =
    await projectRepository.findUniqueWithEpisodesOrdered(projectId);
  if (!project) {
    await updateJob(jobId, { status: "failed", error: "项目不存在" });
    return;
  }

  const synopsis = project.synopsis || "";
  let rolling = project.storyContext || synopsis;
  const memoryService = getMemoryService();

  const mapBatchProgressToParseRange = (batchPct: number) =>
    Math.min(28, 8 + Math.round((Math.min(100, batchPct) / 100) * 20));

  try {
    for (let n = 2; n <= targetEpisodes; n++) {
      const existing = await projectRepository.findEpisodeByProjectNum(
        projectId,
        n,
      );
      if (existing && scriptFromJson(existing.script)) {
        const pct = Math.round(
          ((n - 1) / Math.max(1, targetEpisodes - 1)) * 100,
        );
        const progress = embedded
          ? mapBatchProgressToParseRange(pct)
          : Math.min(99, pct);
        await updateJob(jobId, {
          progress,
          progressMeta: {
            current: n,
            total: targetEpisodes,
            message: `第 ${n} 集已存在，跳过`,
          },
        });
        continue;
      }

      // 使用记忆系统构建上下文（如果有记忆）
      let episodeContext = rolling;
      try {
        const memoryContext = await memoryService.getEpisodeWritingContext(
          projectId,
          n,
        );
        // 如果记忆上下文不为空，使用它；否则使用原来的 rolling context
        if (
          memoryContext.fullContext &&
          !memoryContext.fullContext.includes("（暂无）")
        ) {
          episodeContext = memoryContext.fullContext;
        }
      } catch (error) {
        console.error(
          "Failed to build memory context, falling back to rolling context:",
          error,
        );
      }

      const { script } = await writeEpisodeForProject(
        n,
        synopsis,
        episodeContext,
        project.name,
        {
          userId: project.userId,
          projectId,
          op: "script_batch_write_episode",
        },
      );

      const episode = await projectRepository.upsertEpisodeBatchFromScript(
        projectId,
        n,
        script,
      );

      rolling = [rolling, `第${n}集：${script.summary}`]
        .join("\n")
        .slice(-12000);
      await projectRepository.update(projectId, { storyContext: rolling });

      // 提取本集的记忆
      try {
        await memoryService.extractAndSaveMemories(
          projectId,
          n,
          episode.id,
          script,
          { userId: project.userId, projectId, op: "extract_episode_memories" },
        );
      } catch (error) {
        console.error(`Failed to extract memories for episode ${n}:`, error);
      }

      const pct = Math.round(((n - 1) / Math.max(1, targetEpisodes - 1)) * 100);
      const progress = embedded
        ? mapBatchProgressToParseRange(pct)
        : Math.min(99, pct);
      await updateJob(jobId, {
        progress,
        progressMeta: {
          current: n,
          total: targetEpisodes,
          message: `正在生成第 ${n}/${targetEpisodes} 集`,
        },
      });
    }

    if (embedded) {
      await updateJob(jobId, {
        status: "running",
        currentStep: "parse-script",
        progress: 28,
        progressMeta: {
          current: targetEpisodes,
          total: targetEpisodes,
          message: "剧集已齐备，继续解析…",
        },
      });
    } else {
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        currentStep: "completed",
        progressMeta: {
          current: targetEpisodes,
          total: targetEpisodes,
          message: "批量剧本已完成",
        },
      });
    }
  } catch (e: any) {
    await updateJob(jobId, {
      status: "failed",
      error: e?.message || "批量生成失败",
      progressMeta: { message: e?.message },
    });
  }
}

/**
 * 补全缺失集剧本（在解析前调用）。
 * @param reusePipelineJobId 若传入（通常为当前 parse-script 的 jobId），则不再新建 script-batch，把批量进度写到同一任务上，避免前端优先展示 parse 时长期卡在 5%。
 */
export async function ensureAllEpisodeScripts(
  projectId: string,
  targetEpisodes: number,
  reusePipelineJobId?: string,
) {
  const ep1 = await projectRepository.findEpisodeByProjectNum(projectId, 1);
  if (!ep1 || !scriptFromJson(ep1.script)) {
    await runGenerateFirstEpisode(projectId);
    if (reusePipelineJobId) {
      await updateJob(reusePipelineJobId, {
        progress: 7,
        progressMeta: { message: "已补全第一集，检查其余剧集…" },
      });
    }
  }

  let needBatch = false;
  for (let n = 2; n <= targetEpisodes; n++) {
    const ep = await projectRepository.findEpisodeByProjectNum(projectId, n);
    if (!ep || !scriptFromJson(ep.script)) {
      needBatch = true;
      break;
    }
  }
  if (!needBatch) return;

  if (reusePipelineJobId) {
    await runScriptBatchJob(reusePipelineJobId, projectId, targetEpisodes, {
      embeddedInParse: true,
    });
    return;
  }

  const job = await pipelineRepository.createPipelineJob({
    projectId,
    status: "running",
    jobType: "script-batch",
    currentStep: "script-batch",
    progress: 0,
  });
  try {
    await runScriptBatchJob(job.id, projectId, targetEpisodes);
  } finally {
    const j = await pipelineRepository.findUniqueJob(job.id);
    if (j?.status === "running") {
      await pipelineRepository.updateJob(job.id, {
        status: "completed",
        progress: 100,
      });
    }
  }
}

export async function runParseScriptJob(
  jobId: string,
  projectId: string,
  targetEpisodes: number,
) {
  await updateJob(jobId, {
    status: "running",
    currentStep: "parse-script",
    progress: 5,
  });

  try {
    await ensureAllEpisodeScripts(projectId, targetEpisodes, jobId);

    const project =
      await projectRepository.findUniqueWithEpisodesOrdered(projectId);
    if (!project) {
      await updateJob(jobId, { status: "failed", error: "项目不存在" });
      return;
    }

    const ep1 = project.episodes.find((e) => e.episodeNum === 1);
    if (!scriptFromJson(ep1?.script)) {
      await updateJob(jobId, { status: "failed", error: "第一集剧本不存在" });
      return;
    }

    await updateJob(jobId, {
      progress: 30,
      progressMeta: { message: "提取角色与场景…" },
    });

    const merged = await runParseScriptEntityPipeline(
      projectId,
      project.userId,
      targetEpisodes,
    );
    await updateJob(jobId, {
      progress: 60,
      progressMeta: { message: "生成形象与场地提示词…" },
    });
    await applyScriptVisualEnrichment(projectId, merged);
    await fillEpisodeSynopses(projectId);

    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "completed",
      progressMeta: { message: "解析完成" },
    });
  } catch (e: any) {
    await updateJob(jobId, {
      status: "failed",
      error: e?.message || "解析失败",
      progressMeta: { message: e?.message },
    });
  }
}
