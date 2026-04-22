/**
 * 剧本处理模块统一导出
 * 保持向后兼容，同时提供新的模块化 API
 */

// 新模块导出
export { scriptModeRouter } from './script-mode-router.js'
export { firstEpisodeGenerator } from './first-episode-generator.js'
export type {
  FirstEpisodeOptions,
  FirstEpisodeResult,
  BatchEpisodeOptions,
  BatchEpisodeResult,
  ScriptParseOptions,
  ScriptParseResult
} from './types.js'
