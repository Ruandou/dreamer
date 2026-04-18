import { describe, it, expect, beforeEach } from 'vitest'
import { PromptTemplateEngine } from '../../src/services/prompts/template-engine.js'
import {
  CHARACTER_TEMPLATES,
  CHARACTER_BASE_PROMPT_TEMPLATE,
  CHARACTER_OUTFIT_PROMPT_TEMPLATE,
  CHARACTER_EXPRESSION_PROMPT_TEMPLATE
} from '../../src/services/prompts/character-templates.js'

describe('Character Templates', () => {
  beforeEach(() => {
    PromptTemplateEngine.reset()
  })

  describe('template registration', () => {
    it('exports all character templates', () => {
      expect(CHARACTER_TEMPLATES).toHaveLength(3)
      expect(CHARACTER_TEMPLATES).toContain(CHARACTER_BASE_PROMPT_TEMPLATE)
      expect(CHARACTER_TEMPLATES).toContain(CHARACTER_OUTFIT_PROMPT_TEMPLATE)
      expect(CHARACTER_TEMPLATES).toContain(CHARACTER_EXPRESSION_PROMPT_TEMPLATE)
    })

    it('each template has required fields', () => {
      CHARACTER_TEMPLATES.forEach((template) => {
        expect(template.id).toBeDefined()
        expect(template.version).toMatch(/\d+\.\d+\.\d+/)
        expect(template.systemPrompt).toBeDefined()
        expect(template.userPromptTemplate).toBeDefined()
        expect(template.metadata).toBeDefined()
        expect(template.metadata.category).toBe('character')
        expect(template.metadata.creativity).toBe(0.6)
        expect(template.metadata.maxOutputTokens).toBe(400)
        expect(template.metadata.description).toBeDefined()
      })
    })
  })

  describe('CHARACTER_BASE_PROMPT_TEMPLATE', () => {
    it('renders base prompt with character name only', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_BASE_PROMPT_TEMPLATE)

      const result = engine.render('character-base-prompt', {
        variables: {
          characterName: '李明',
          slotName: '基础形象'
        }
      })

      expect(result.systemPrompt).toContain('基础定妆提示词撰写助手')
      expect(result.userPrompt).toContain('角色名：李明')
      expect(result.userPrompt).toContain('形象槽位名称：基础形象')
      expect(result.userPrompt).toContain('槽位类型：base')
    })

    it('renders with character description', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_BASE_PROMPT_TEMPLATE)

      const result = engine.render('character-base-prompt', {
        variables: {
          characterName: '王芳',
          characterDescription: '28岁，记者，聪明机智',
          slotName: '基础形象'
        }
      })

      expect(result.userPrompt).toContain('角色设定：28岁，记者，聪明机智')
    })

    it('system prompt contains key requirements', () => {
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.systemPrompt).toContain('纯色影棚背景')
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.systemPrompt).toContain('正面全身')
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.systemPrompt).toContain('面部特征')
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.systemPrompt).toContain('不要使用英文')
    })

    it('user prompt contains base-specific rules', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_BASE_PROMPT_TEMPLATE)

      const result = engine.render('character-base-prompt', {
        variables: {
          characterName: '测试角色',
          slotName: '基础形象'
        }
      })

      expect(result.userPrompt).toContain('【基础定妆】')
      expect(result.userPrompt).toContain('四段意合为一段')
      expect(result.userPrompt).toContain('面部特征')
      expect(result.userPrompt).toContain('整体外貌与发型')
      expect(result.userPrompt).toContain('服装与姿态')
      expect(result.userPrompt).toContain('构图与背景')
      expect(result.userPrompt).toContain('禁止只写剧情动作')
    })
  })

  describe('CHARACTER_OUTFIT_PROMPT_TEMPLATE', () => {
    it('renders outfit prompt with all fields', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_OUTFIT_PROMPT_TEMPLATE)

      const result = engine.render('character-outfit-prompt', {
        variables: {
          characterName: '张伟',
          characterDescription: '35岁，企业家',
          slotName: '商务谈判',
          slotType: 'outfit',
          slotDescription: '黑色西装，白色衬衫',
          parentSlotSummary: '基础形象：蓝色休闲装'
        }
      })

      expect(result.systemPrompt).toContain('换装提示词撰写助手')
      expect(result.userPrompt).toContain('角色名：张伟')
      expect(result.userPrompt).toContain('角色设定：35岁，企业家')
      expect(result.userPrompt).toContain('形象槽位名称：商务谈判')
      expect(result.userPrompt).toContain('槽位类型：outfit')
      expect(result.userPrompt).toContain('槽位说明：黑色西装，白色衬衫')
      expect(result.userPrompt).toContain('父级基础形象参考：基础形象：蓝色休闲装')
    })

    it('system prompt emphasizes consistency', () => {
      expect(CHARACTER_OUTFIT_PROMPT_TEMPLATE.systemPrompt).toContain('面部特征')
      expect(CHARACTER_OUTFIT_PROMPT_TEMPLATE.systemPrompt).toContain('发型')
      expect(CHARACTER_OUTFIT_PROMPT_TEMPLATE.systemPrompt).toContain('标志性细节完全不变')
      expect(CHARACTER_OUTFIT_PROMPT_TEMPLATE.systemPrompt).toContain('仅更换服装')
    })

    it('user prompt contains outfit-specific rules', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_OUTFIT_PROMPT_TEMPLATE)

      const result = engine.render('character-outfit-prompt', {
        variables: {
          characterName: '测试',
          slotName: '换装',
          slotType: 'outfit'
        }
      })

      expect(result.userPrompt).toContain('【换装】')
      expect(result.userPrompt).toContain('保持该角色面部特征')
      expect(result.userPrompt).toContain('仅将服装更换为')
      expect(result.userPrompt).toContain('勿写成新角色')
    })

    it('handles optional fields gracefully', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_OUTFIT_PROMPT_TEMPLATE)

      const result = engine.render('character-outfit-prompt', {
        variables: {
          characterName: '简单角色',
          slotName: '简单换装',
          slotType: 'outfit'
        }
      })

      // Should not contain empty sections
      expect(result.userPrompt).not.toContain('角色设定：')
      expect(result.userPrompt).not.toContain('槽位说明：')
      expect(result.userPrompt).not.toContain('父级基础形象参考：')
    })
  })

  describe('CHARACTER_EXPRESSION_PROMPT_TEMPLATE', () => {
    it('renders expression/pose prompt', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_EXPRESSION_PROMPT_TEMPLATE)

      const result = engine.render('character-expression-prompt', {
        variables: {
          characterName: '赵丽',
          characterDescription: '25岁，演员',
          slotName: '愤怒表情',
          slotType: 'expression',
          slotDescription: '愤怒的面部表情',
          parentSlotSummary: '基础：微笑形象'
        }
      })

      expect(result.systemPrompt).toContain('定妆提示词撰写助手')
      expect(result.userPrompt).toContain('角色名：赵丽')
      expect(result.userPrompt).toContain('槽位类型：expression')
      expect(result.userPrompt).toContain('表情或姿态')
    })

    it('renders pose type correctly', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_EXPRESSION_PROMPT_TEMPLATE)

      const result = engine.render('character-expression-prompt', {
        variables: {
          characterName: '刘强',
          slotName: '战斗姿态',
          slotType: 'pose'
        }
      })

      expect(result.userPrompt).toContain('槽位类型：pose')
    })

    it('system prompt emphasizes identity consistency', () => {
      expect(CHARACTER_EXPRESSION_PROMPT_TEMPLATE.systemPrompt).toContain('保持人物身份一致')
      expect(CHARACTER_EXPRESSION_PROMPT_TEMPLATE.systemPrompt).toContain('仅变化')
    })

    it('user prompt contains derivative rules', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(CHARACTER_EXPRESSION_PROMPT_TEMPLATE)

      const result = engine.render('character-expression-prompt', {
        variables: {
          characterName: '测试',
          slotName: '测试槽位',
          slotType: 'expression'
        }
      })

      expect(result.userPrompt).toContain('【衍生形象】')
      expect(result.userPrompt).toContain('相对父级基础形象保持身份一致')
      expect(result.userPrompt).toContain('仅变化部分')
    })
  })

  describe('template comparison', () => {
    it('base template has different system prompt than outfit', () => {
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.systemPrompt).not.toBe(
        CHARACTER_OUTFIT_PROMPT_TEMPLATE.systemPrompt
      )
    })

    it('base and outfit templates have same creativity level', () => {
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.metadata.creativity).toBe(
        CHARACTER_OUTFIT_PROMPT_TEMPLATE.metadata.creativity
      )
    })

    it('all templates have same max output tokens', () => {
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.metadata.maxOutputTokens).toBe(400)
      expect(CHARACTER_OUTFIT_PROMPT_TEMPLATE.metadata.maxOutputTokens).toBe(400)
      expect(CHARACTER_EXPRESSION_PROMPT_TEMPLATE.metadata.maxOutputTokens).toBe(400)
    })

    it('each template has unique ID', () => {
      const ids = CHARACTER_TEMPLATES.map((t) => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(CHARACTER_TEMPLATES.length)
    })
  })

  describe('template tags', () => {
    it('base template has correct tags', () => {
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.metadata.tags).toContain('character')
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.metadata.tags).toContain('base')
      expect(CHARACTER_BASE_PROMPT_TEMPLATE.metadata.tags).toContain('portrait')
    })

    it('outfit template has derivative tag', () => {
      expect(CHARACTER_OUTFIT_PROMPT_TEMPLATE.metadata.tags).toContain('derivative')
      expect(CHARACTER_OUTFIT_PROMPT_TEMPLATE.metadata.tags).toContain('outfit')
    })

    it('expression template has appropriate tags', () => {
      expect(CHARACTER_EXPRESSION_PROMPT_TEMPLATE.metadata.tags).toContain('expression')
      expect(CHARACTER_EXPRESSION_PROMPT_TEMPLATE.metadata.tags).toContain('pose')
    })
  })
})
