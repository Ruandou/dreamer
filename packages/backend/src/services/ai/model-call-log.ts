/**
 * @deprecated 已迁移到 llm/model-call-log.ts，请从该路径导入
 * 保留此文件以兼容现有调用方
 */

export { logLLMCall, logDeepSeekChat } from './llm/model-call-log.js'
export type {
  ModelCallLogContext,
  LogLLMCallOptions,
  LogLLMCallResult
} from './llm/model-call-log.js'
