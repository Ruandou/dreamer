import { describe, it, expect, beforeEach } from 'vitest'
import { PromptTemplateEngine } from '../../src/services/prompts/template-engine.js'
import {
  SCRIPT_TEMPLATES,
  SCRIPT_WRITER_TEMPLATE,
  EPISODE_WRITER_TEMPLATE,
  SCRIPT_EXPAND_TEMPLATE,
  STORYBOARD_GENERATE_TEMPLATE
} from '../../src/services/prompts/script-templates.js'

describe('Script Templates', () => {
  beforeEach(() => {
    PromptTemplateEngine.reset()
  })

  describe('template registration', () => {
    it('exports all script templates', () => {
      expect(SCRIPT_TEMPLATES).toHaveLength(4)
      expect(SCRIPT_TEMPLATES).toContain(SCRIPT_WRITER_TEMPLATE)
      expect(SCRIPT_TEMPLATES).toContain(EPISODE_WRITER_TEMPLATE)
      expect(SCRIPT_TEMPLATES).toContain(SCRIPT_EXPAND_TEMPLATE)
      expect(SCRIPT_TEMPLATES).toContain(STORYBOARD_GENERATE_TEMPLATE)
    })

    it('each template has required fields', () => {
      SCRIPT_TEMPLATES.forEach((template) => {
        expect(template.id).toBeDefined()
        expect(template.version).toBeDefined()
        expect(template.systemPrompt).toBeDefined()
        expect(template.userPromptTemplate).toBeDefined()
        expect(template.metadata).toBeDefined()
        // storyboard template has different category
        if (template.id !== 'storyboard-generate') {
          expect(template.metadata.category).toBe('script')
        }
        expect(template.metadata.creativity).toBeGreaterThanOrEqual(0)
        expect(template.metadata.creativity).toBeLessThanOrEqual(1)
        expect(template.metadata.maxOutputTokens).toBeGreaterThan(0)
        expect(template.metadata.description).toBeDefined()
      })
    })
  })

  describe('SCRIPT_WRITER_TEMPLATE', () => {
    it('renders with basic idea', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(SCRIPT_WRITER_TEMPLATE)

      const result = engine.render('script-writer', {
        variables: {
          idea: '都市爱情故事'
        }
      })

      expect(result.systemPrompt).toContain('短视频剧本作家')
      expect(result.userPrompt).toContain('都市爱情故事')
      expect(result.userPrompt).toContain('想法：')
    })

    it('renders with characters and project context', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(SCRIPT_WRITER_TEMPLATE)

      const result = engine.render('script-writer', {
        variables: {
          idea: '科幻悬疑剧',
          characters: '- 李明：30岁科学家\n- 王芳：28岁记者',
          projectContext: '现代都市背景'
        }
      })

      expect(result.userPrompt).toContain('科幻悬疑剧')
      expect(result.userPrompt).toContain('角色设定：')
      expect(result.userPrompt).toContain('李明：30岁科学家')
      expect(result.userPrompt).toContain('项目背景：')
      expect(result.userPrompt).toContain('现代都市背景')
    })

    it('omits optional sections when empty', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(SCRIPT_WRITER_TEMPLATE)

      const result = engine.render('script-writer', {
        variables: {
          idea: '简单想法'
        }
      })

      expect(result.userPrompt).not.toContain('角色设定：')
      expect(result.userPrompt).not.toContain('项目背景：')
    })
  })

  describe('EPISODE_WRITER_TEMPLATE', () => {
    it('renders episode script prompt', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(EPISODE_WRITER_TEMPLATE)

      const result = engine.render('episode-writer', {
        variables: {
          seriesTitle: '都市传奇',
          seriesSynopsis: '一个普通人的逆袭故事',
          rollingContext: '第一集主角遇到了神秘老人',
          episodeNum: 2
        }
      })

      expect(result.systemPrompt).toContain('分集编剧')
      expect(result.userPrompt).toContain('剧名：都市传奇')
      expect(result.userPrompt).toContain('全剧梗概：一个普通人的逆袭故事')
      expect(result.userPrompt).toContain('前情与已发生剧情摘要：第一集主角遇到了神秘老人')
      expect(result.userPrompt).toContain('第 2 集')
    })

    it('handles empty rolling context', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(EPISODE_WRITER_TEMPLATE)

      const result = engine.render('episode-writer', {
        variables: {
          seriesTitle: '测试剧集',
          seriesSynopsis: '测试梗概',
          rollingContext: '',
          episodeNum: 1
        }
      })

      expect(result.userPrompt).toContain('前情与已发生剧情摘要：')
    })
  })

  describe('SCRIPT_EXPAND_TEMPLATE', () => {
    it('renders with summary only', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(SCRIPT_EXPAND_TEMPLATE)

      const result = engine.render('script-expand', {
        variables: {
          summary: '一个关于时间旅行的故事'
        }
      })

      expect(result.systemPrompt).toContain('短剧剧本作家')
      expect(result.userPrompt).toContain('故事梗概：一个关于时间旅行的故事')
    })

    it('renders with project context and summary', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(SCRIPT_EXPAND_TEMPLATE)

      const result = engine.render('script-expand', {
        variables: {
          summary: '都市爱情故事',
          projectContext: '现代都市，现实主义风格'
        }
      })

      expect(result.userPrompt).toContain('项目背景：现代都市，现实主义风格')
      expect(result.userPrompt).toContain('故事梗概：都市爱情故事')
    })

    it('system prompt contains JSON format requirements', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(SCRIPT_EXPAND_TEMPLATE)

      expect(SCRIPT_EXPAND_TEMPLATE.systemPrompt).toContain('title')
      expect(SCRIPT_EXPAND_TEMPLATE.systemPrompt).toContain('summary')
      expect(SCRIPT_EXPAND_TEMPLATE.systemPrompt).toContain('scenes')
      expect(SCRIPT_EXPAND_TEMPLATE.systemPrompt).toContain('dialogues')
    })
  })

  describe('STORYBOARD_GENERATE_TEMPLATE', () => {
    it('renders with episode synopsis', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(STORYBOARD_GENERATE_TEMPLATE)

      const result = engine.render('storyboard-generate', {
        variables: {
          synopsis: '第二集：主角发现真相'
        }
      })

      expect(result.systemPrompt).toContain('分镜脚本导演')
      expect(result.userPrompt).toContain('分集梗概：第二集：主角发现真相')
    })

    it('renders with full script content', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(STORYBOARD_GENERATE_TEMPLATE)

      const result = engine.render('storyboard-generate', {
        variables: {
          episodeTitle: '第三集',
          scriptContent: '场景1：咖啡馆\n场景2：办公室'
        }
      })

      expect(result.userPrompt).toContain('分集标题：第三集')
      expect(result.userPrompt).toContain('已有剧本内容：')
      expect(result.userPrompt).toContain('场景1：咖啡馆')
    })

    it('renders with additional hint', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(STORYBOARD_GENERATE_TEMPLATE)

      const result = engine.render('storyboard-generate', {
        variables: {
          synopsis: '测试梗概',
          hint: '需要更多动作戏'
        }
      })

      expect(result.userPrompt).toContain('额外提示/要求：')
      expect(result.userPrompt).toContain('需要更多动作戏')
    })

    it('system prompt contains shot structure requirements', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(STORYBOARD_GENERATE_TEMPLATE)

      expect(STORYBOARD_GENERATE_TEMPLATE.systemPrompt).toContain('shots')
      expect(STORYBOARD_GENERATE_TEMPLATE.systemPrompt).toContain('shotNum')
      expect(STORYBOARD_GENERATE_TEMPLATE.systemPrompt).toContain('cameraAngle')
      expect(STORYBOARD_GENERATE_TEMPLATE.systemPrompt).toContain('cameraMovement')
    })

    it('metadata has correct category and settings', () => {
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.category).toBe('storyboard')
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.creativity).toBe(0.65)
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.maxOutputTokens).toBe(6000)
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.description).toContain('分镜')
    })
  })

  describe('template metadata validation', () => {
    it('SCRIPT_WRITER_TEMPLATE has correct metadata', () => {
      expect(SCRIPT_WRITER_TEMPLATE.metadata.category).toBe('script')
      expect(SCRIPT_WRITER_TEMPLATE.metadata.creativity).toBe(0.7)
      expect(SCRIPT_WRITER_TEMPLATE.metadata.maxOutputTokens).toBe(4000)
      expect(SCRIPT_WRITER_TEMPLATE.metadata.tags).toContain('writing')
    })

    it('EPISODE_WRITER_TEMPLATE has correct metadata', () => {
      expect(EPISODE_WRITER_TEMPLATE.metadata.category).toBe('script')
      expect(EPISODE_WRITER_TEMPLATE.metadata.creativity).toBe(0.75)
      expect(EPISODE_WRITER_TEMPLATE.metadata.maxOutputTokens).toBe(4000)
      expect(EPISODE_WRITER_TEMPLATE.metadata.tags).toContain('episode')
    })

    it('SCRIPT_EXPAND_TEMPLATE has correct metadata', () => {
      expect(SCRIPT_EXPAND_TEMPLATE.metadata.category).toBe('script')
      expect(SCRIPT_EXPAND_TEMPLATE.metadata.creativity).toBe(0.7)
      expect(SCRIPT_EXPAND_TEMPLATE.metadata.maxOutputTokens).toBe(4000)
      expect(SCRIPT_EXPAND_TEMPLATE.metadata.tags).toContain('expansion')
    })

    it('STORYBOARD_GENERATE_TEMPLATE has correct metadata', () => {
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.category).toBe('storyboard')
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.creativity).toBe(0.65)
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.maxOutputTokens).toBe(6000)
      expect(STORYBOARD_GENERATE_TEMPLATE.metadata.tags).toContain('storyboard')
    })
  })
})
