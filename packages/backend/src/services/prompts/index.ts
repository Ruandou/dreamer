/**
 * 提示词模块统一导出
 */

export { PromptTemplateEngine } from './template-engine.js'
export type { PromptTemplate, RenderedPrompt, TemplateRenderOptions } from './template-engine.js'

export { PromptRegistry } from './registry.js'

export {
  SCRIPT_TEMPLATES,
  SCRIPT_WRITER_TEMPLATE,
  EPISODE_WRITER_TEMPLATE,
  SCRIPT_EXPAND_TEMPLATE,
  STORYBOARD_GENERATE_TEMPLATE
} from './script-templates.js'

export {
  CHARACTER_TEMPLATES,
  CHARACTER_BASE_PROMPT_TEMPLATE,
  CHARACTER_OUTFIT_PROMPT_TEMPLATE,
  CHARACTER_EXPRESSION_PROMPT_TEMPLATE
} from './character-templates.js'

export {
  LOCATION_TEMPLATES,
  VISUAL_ENRICHMENT_TEMPLATE,
  LOCATION_ESTABLISHING_TEMPLATE
} from './location-templates.js'
