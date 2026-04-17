import type { ScriptContent } from "@dreamer/shared/types";
import type { ModelCallLogContext } from "./api-logger.js";
import { getDeepSeekClient, type DeepSeekCost } from "./deepseek-client.js";
import {
  DEEPSEEK_TEMPERATURE,
  DEEPSEEK_MAX_TOKENS
} from './ai.constants.js'
import { convertDeepSeekResponse } from "./script-expand.js";
import {
  callDeepSeekWithRetry,
  cleanMarkdownCodeBlocks,
  type DeepSeekCallOptions
} from './deepseek-call-wrapper.js';

/** 与 Prisma Episode / shared Episode 兼容，用于分镜生成入参 */
export interface EpisodeStoryboardInput {
  title?: string | null;
  synopsis?: string | null;
  script?: unknown;
}

/** 至少需要梗概或 `Episode.script` 中有 summary/场次，才能调用 AI 生成分镜剧本 */
export function hasEpisodeContentForStoryboard(
  episode: EpisodeStoryboardInput,
): boolean {
  if (episode.synopsis?.trim()) return true;
  const rs = episode.script as ScriptContent | undefined;
  if (!rs || typeof rs !== "object") return false;
  if (rs.summary?.trim()) return true;
  if (Array.isArray(rs.scenes) && rs.scenes.length > 0) return true;
  return false;
}

const STORYBOARD_SYSTEM_PROMPT = `你是一个专业的短剧分镜导演与编剧，擅长把本集梗概与/或已有剧本转化为结构化「分镜剧本」。
输出必须为 JSON，格式如下（必须严格遵循）：
{
  "title": "剧集标题",
  "summary": "故事梗概",
  "scenes": [
    {
      "sceneNum": 1,
      "location": "场景地点",
      "timeOfDay": "日/夜/晨/昏",
      "characters": ["角色1", "角色2"],
      "description": "本场次整体概述",
      "dialogues": [
        {"character": "角色名", "content": "对话内容"}
      ],
      "actions": ["动作1", "动作2"],
      "shots": [
        {
          "shotNum": 1,
          "order": 1,
          "description": "本镜画面与叙事（可含台词原文）",
          "cameraAngle": "景别，可为空字符串",
          "cameraMovement": "运镜，可为空字符串",
          "duration": 5000,
          "characters": [
            { "characterName": "角色名（须与项目角色一致）", "imageName": "基础形象", "action": "本镜中该角色的动作或状态" }
          ]
        }
      ]
    }
  ]
}
要求：
- 每个场次必须包含 "shots" 数组，至少 1 个镜头；镜头按叙事顺序排列。
- **【重要】每个场次总时长不能超过 15 秒**（所有 shots 的 duration 加起来不超过 15000ms）。
- 镜头数量 2-4 个，每镜 3-5 秒。
- "imageName" 须对应项目中该角色已存在的形象名称（无则填「基础形象」）；用于关联定妆图。
- dialogues 仍写在场次级，便于台词与时间轴；shots 内可引用对白要点。
场次数量应覆盖本集叙事节奏，便于逐场生成视频。
请直接返回 JSON 格式，不要包含其他文字。`;

const MAX_USER_CHARS = 24000;

function truncateForPrompt(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[以上内容过长已截断]`;
}

export function buildStoryboardUserPrompt(
  episode: EpisodeStoryboardInput,
  projectContext: string | undefined,
  hint?: string | null,
): string {
  const parts: string[] = [];
  if (projectContext) {
    parts.push(`项目背景：\n${projectContext}`);
  }
  parts.push(`本集标题：${episode.title?.trim() || "未命名"}`);
  if (episode.synopsis?.trim()) {
    parts.push(`本集梗概：\n${episode.synopsis.trim()}`);
  }
  const rs = episode.script as ScriptContent | undefined;
  if (rs) {
    if (rs.summary?.trim()) {
      parts.push(`剧本 summary 字段：\n${rs.summary.trim()}`);
    }
    if (rs.scenes?.length) {
      parts.push(
        `已有剧本场次（可在此基础上细化分镜，也可合理调整）：\n${truncateForPrompt(JSON.stringify(rs.scenes, null, 2), MAX_USER_CHARS)}`,
      );
    }
  }
  if (hint?.trim()) {
    parts.push(`额外要求：\n${hint.trim()}`);
  }
  return parts.join("\n\n");
}

export async function generateStoryboardScriptFromEpisode(
  episode: EpisodeStoryboardInput,
  projectContext: string | undefined,
  log: ModelCallLogContext | undefined,
  hint?: string | null,
): Promise<{ script: ScriptContent; cost: DeepSeekCost }> {
  const userPrompt = buildStoryboardUserPrompt(episode, projectContext, hint);
  const deepseek = getDeepSeekClient();

  // Parser function for the wrapper
  const parseStoryboard = (content: string): ScriptContent => {
    const cleanContent = cleanMarkdownCodeBlocks(content);
    const parsed = JSON.parse(cleanContent);
    const script = convertDeepSeekResponse(parsed);

    if (!script.title || !Array.isArray(script.scenes)) {
      throw new Error("分镜剧本格式不正确");
    }

    return script;
  }

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: "deepseek-chat",
    systemPrompt: STORYBOARD_SYSTEM_PROMPT,
    userPrompt,
    temperature: DEEPSEEK_TEMPERATURE.STORYBOARD_GENERATE,
    maxTokens: DEEPSEEK_MAX_TOKENS.STORYBOARD_GENERATE,
    modelLog: log
  }

  const result = await callDeepSeekWithRetry(options, parseStoryboard)

  return {
    script: result.content,
    cost: result.cost
  }
}
