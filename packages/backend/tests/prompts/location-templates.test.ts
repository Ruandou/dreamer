import { describe, it, expect, beforeEach } from 'vitest'
import { PromptTemplateEngine } from '../../src/services/prompts/template-engine.js'
import {
  LOCATION_TEMPLATES,
  VISUAL_ENRICHMENT_TEMPLATE,
  LOCATION_ESTABLISHING_TEMPLATE
} from '../../src/services/prompts/location-templates.js'

describe('Location Templates', () => {
  beforeEach(() => {
    PromptTemplateEngine.reset()
  })

  describe('template registration', () => {
    it('exports all location templates', () => {
      expect(LOCATION_TEMPLATES).toHaveLength(2)
      expect(LOCATION_TEMPLATES).toContain(VISUAL_ENRICHMENT_TEMPLATE)
      expect(LOCATION_TEMPLATES).toContain(LOCATION_ESTABLISHING_TEMPLATE)
    })

    it('each template has required fields', () => {
      LOCATION_TEMPLATES.forEach((template) => {
        expect(template.id).toBeDefined()
        expect(template.version).toBe('1.0.0')
        expect(template.systemPrompt).toBeDefined()
        expect(template.userPromptTemplate).toBeDefined()
        expect(template.metadata).toBeDefined()
        expect(template.metadata.maxOutputTokens).toBeGreaterThan(0)
        expect(template.metadata.description).toBeDefined()
      })
    })
  })

  describe('VISUAL_ENRICHMENT_TEMPLATE', () => {
    it('renders with basic script summary', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(VISUAL_ENRICHMENT_TEMPLATE)

      const result = engine.render('visual-enrichment', {
        variables: {
          scriptSummary: '都市爱情故事',
          locationLines: '咖啡馆 | 时间：日 | 描述：温馨的小咖啡馆',
          characterLines: '李明 | 30岁企业家',
          projectVisualStyleLine: '现实主义，暖色调'
        }
      })

      expect(result.systemPrompt).toContain('紧凑的合法 JSON')
      expect(result.userPrompt).toContain('都市爱情故事')
      expect(result.userPrompt).toContain('咖啡馆')
      expect(result.userPrompt).toContain('李明')
      expect(result.userPrompt).toContain('现实主义，暖色调')
    })

    it('renders with exact location names whitelist', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(VISUAL_ENRICHMENT_TEMPLATE)

      const result = engine.render('visual-enrichment', {
        variables: {
          scriptSummary: '测试故事',
          locationLines: '咖啡馆 | 时间：日',
          characterLines: '角色A',
          projectVisualStyleLine: '写实',
          exactLocationNames: ['咖啡馆（朝阳区）', '办公室（海淀区）']
        }
      })

      expect(result.userPrompt).toContain('【场地名白名单】')
      expect(result.userPrompt).toContain('咖啡馆（朝阳区）')
      expect(result.userPrompt).toContain('办公室（海淀区）')
      expect(result.userPrompt).toContain('勿改写、勿缩写')
    })

    it('renders without location whitelist when not provided', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(VISUAL_ENRICHMENT_TEMPLATE)

      const result = engine.render('visual-enrichment', {
        variables: {
          scriptSummary: '简单故事',
          locationLines: '场景1',
          characterLines: '角色1',
          projectVisualStyleLine: '风格'
        }
      })

      expect(result.userPrompt).not.toContain('【场地名白名单】')
    })

    it('system prompt contains JSON structure requirements', () => {
      expect(VISUAL_ENRICHMENT_TEMPLATE.systemPrompt).toContain('locations')
      expect(VISUAL_ENRICHMENT_TEMPLATE.systemPrompt).toContain('characters')
      expect(VISUAL_ENRICHMENT_TEMPLATE.systemPrompt).toContain('imagePrompt')
    })

    it('user prompt contains location image rules', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(VISUAL_ENRICHMENT_TEMPLATE)

      const result = engine.render('visual-enrichment', {
        variables: {
          scriptSummary: '测试',
          locationLines: '场地',
          characterLines: '角色',
          projectVisualStyleLine: '风格'
        }
      })

      expect(result.userPrompt).toContain('【定场图 imagePrompt】')
      expect(result.userPrompt).toContain('顶级电影勘景摄影师')
      expect(result.userPrompt).toContain('绝对禁止')
      expect(result.userPrompt).toContain('人物、动物、影子')
    })

    it('user prompt contains character image rules', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(VISUAL_ENRICHMENT_TEMPLATE)

      const result = engine.render('visual-enrichment', {
        variables: {
          scriptSummary: '测试',
          locationLines: '场地',
          characterLines: '角色',
          projectVisualStyleLine: '风格'
        }
      })

      expect(result.userPrompt).toContain('base')
      expect(result.userPrompt).toContain('outfit')
      expect(result.userPrompt).toContain('expression')
      expect(result.userPrompt).toContain('pose')
      expect(result.userPrompt).toContain('七分身构图')
      expect(result.userPrompt).toContain('纯色影棚背景')
    })

    it('user prompt contains compliance warnings', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(VISUAL_ENRICHMENT_TEMPLATE)

      const result = engine.render('visual-enrichment', {
        variables: {
          scriptSummary: '刑侦故事',
          locationLines: '审讯室',
          characterLines: '警察',
          projectVisualStyleLine: '写实'
        }
      })

      expect(result.userPrompt).toContain('【文生图合规】')
      expect(result.userPrompt).toContain('审讯室')
      expect(result.userPrompt).toContain('会谈室')
      expect(result.userPrompt).toContain('中性置景词')
    })

    it('metadata has correct category and settings', () => {
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.category).toBe('visual')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.creativity).toBe(0.4)
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.maxOutputTokens).toBe(4096)
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.description).toContain('批量')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('enrichment')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('batch')
    })
  })

  describe('LOCATION_ESTABLISHING_TEMPLATE', () => {
    it('renders with all location details', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(LOCATION_ESTABLISHING_TEMPLATE)

      const result = engine.render('location-establishing', {
        variables: {
          locationName: '古庙',
          locationDescription: '破旧的寺庙，香火已断',
          timeOfDay: '夜',
          visualStyle: '古风，写实'
        }
      })

      expect(result.systemPrompt).toContain('电影勘景摄影师')
      expect(result.systemPrompt).toContain('绝对禁止')
      expect(result.userPrompt).toContain('场地名称：古庙')
      expect(result.userPrompt).toContain('场地描述：破旧的寺庙，香火已断')
      expect(result.userPrompt).toContain('时间：夜')
      expect(result.userPrompt).toContain('视觉风格：古风，写实')
    })

    it('system prompt contains core iron rules', () => {
      expect(LOCATION_ESTABLISHING_TEMPLATE.systemPrompt).toContain('核心铁律')
      expect(LOCATION_ESTABLISHING_TEMPLATE.systemPrompt).toContain('绝对禁止')
      expect(LOCATION_ESTABLISHING_TEMPLATE.systemPrompt).toContain('人物、动物、影子')
      expect(LOCATION_ESTABLISHING_TEMPLATE.systemPrompt).toContain('人类活动')
    })

    it('user prompt contains four-part structure', () => {
      const engine = PromptTemplateEngine.getInstance()
      engine.register(LOCATION_ESTABLISHING_TEMPLATE)

      const result = engine.render('location-establishing', {
        variables: {
          locationName: '测试场地',
          locationDescription: '描述',
          timeOfDay: '日',
          visualStyle: '风格'
        }
      })

      expect(result.userPrompt).toContain('空间与环境')
      expect(result.userPrompt).toContain('光影与氛围')
      expect(result.userPrompt).toContain('构图与视角')
      expect(result.userPrompt).toContain('风格与画质')
    })

    it('metadata has correct category', () => {
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.category).toBe('location')
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.creativity).toBe(0.5)
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.maxOutputTokens).toBe(400)
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.description).toContain('定场图')
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.tags).toContain('establishing')
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.tags).toContain('empty-scene')
    })
  })

  describe('template comparison', () => {
    it('visual enrichment has lower creativity than establishing', () => {
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.creativity).toBe(0.4)
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.creativity).toBe(0.5)
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.creativity).toBeLessThan(
        LOCATION_ESTABLISHING_TEMPLATE.metadata.creativity
      )
    })

    it('visual enrichment allows more output tokens', () => {
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.maxOutputTokens).toBe(4096)
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.maxOutputTokens).toBe(400)
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.maxOutputTokens).toBeGreaterThan(
        LOCATION_ESTABLISHING_TEMPLATE.metadata.maxOutputTokens
      )
    })

    it('templates have different categories', () => {
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.category).toBe('visual')
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.category).toBe('location')
    })

    it('each template has unique ID', () => {
      const ids = LOCATION_TEMPLATES.map((t) => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(LOCATION_TEMPLATES.length)
    })
  })

  describe('template tags', () => {
    it('visual enrichment has comprehensive tags', () => {
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('visual')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('enrichment')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('batch')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('extraction')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('location')
      expect(VISUAL_ENRICHMENT_TEMPLATE.metadata.tags).toContain('character')
    })

    it('establishing has location-specific tags', () => {
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.tags).toContain('location')
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.tags).toContain('establishing')
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.tags).toContain('empty-scene')
      expect(LOCATION_ESTABLISHING_TEMPLATE.metadata.tags).toContain('single')
    })
  })
})
