import { describe, it, expect, beforeEach } from 'vitest'
import { PromptTemplateEngine } from '../../src/services/prompts/template-engine.js'
import type { PromptTemplate } from '../../src/services/prompts/template-engine.js'

describe('PromptTemplateEngine', () => {
  let engine: PromptTemplateEngine

  beforeEach(() => {
    PromptTemplateEngine.reset()
    engine = PromptTemplateEngine.getInstance()
  })

  describe('register and getTemplate', () => {
    it('registers and retrieves a template', () => {
      const template: PromptTemplate = {
        id: 'test-template',
        version: '1.0.0',
        systemPrompt: 'You are a test assistant',
        userPromptTemplate: 'Hello {{name}}',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Test template'
        }
      }

      engine.register(template)
      const retrieved = engine.getTemplate('test-template')

      expect(retrieved.id).toBe('test-template')
      expect(retrieved.version).toBe('1.0.0')
    })

    it('throws error for non-existent template', () => {
      expect(() => engine.getTemplate('non-existent')).toThrow('Template "non-existent" not found')
    })

    it('supports multiple versions and returns latest by default', () => {
      engine.register({
        id: 'versioned-template',
        version: '1.0.0',
        systemPrompt: 'v1',
        userPromptTemplate: 'v1',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'v1'
        }
      })

      engine.register({
        id: 'versioned-template',
        version: '2.0.0',
        systemPrompt: 'v2',
        userPromptTemplate: 'v2',
        metadata: {
          category: 'script',
          creativity: 0.6,
          maxOutputTokens: 200,
          description: 'v2'
        }
      })

      const latest = engine.getTemplate('versioned-template')
      expect(latest.version).toBe('2.0.0')

      const v1 = engine.getTemplate('versioned-template', '1.0.0')
      expect(v1.version).toBe('1.0.0')
    })

    it('throws error for non-existent version', () => {
      engine.register({
        id: 'test',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'test',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'test'
        }
      })

      expect(() => engine.getTemplate('test', '9.9.9')).toThrow(
        'Template "test" version "9.9.9" not found'
      )
    })
  })

  describe('render - variable interpolation', () => {
    it('replaces simple variables', () => {
      engine.register({
        id: 'simple',
        version: '1.0.0',
        systemPrompt: 'You are helpful',
        userPromptTemplate: 'Hello {{name}}, welcome to {{place}}!',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Simple test'
        }
      })

      const result = engine.render('simple', {
        variables: { name: 'Alice', place: 'Wonderland' }
      })

      expect(result.userPrompt).toBe('Hello Alice, welcome to Wonderland!')
    })

    it('handles nested object paths', () => {
      engine.register({
        id: 'nested',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'User: {{user.name}}, Email: {{user.email}}',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Nested test'
        }
      })

      const result = engine.render('nested', {
        variables: {
          user: { name: 'Bob', email: 'bob@example.com' }
        }
      })

      expect(result.userPrompt).toBe('User: Bob, Email: bob@example.com')
    })

    it('replaces missing variables with empty string', () => {
      engine.register({
        id: 'missing',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'Hello {{name}}!',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Missing var test'
        }
      })

      const result = engine.render('missing', { variables: {} })
      expect(result.userPrompt).toBe('Hello !')
    })
  })

  describe('render - conditional blocks', () => {
    it('renders block when variable has value', () => {
      engine.register({
        id: 'conditional',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'Start{{#name}} Name: {{name}}{{/name}} End',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Conditional test'
        }
      })

      const result = engine.render('conditional', {
        variables: { name: 'Alice' }
      })

      expect(result.userPrompt).toBe('Start Name: Alice End')
    })

    it('removes block when variable is empty', () => {
      engine.register({
        id: 'conditional-empty',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'Start{{#name}} Name: {{name}}{{/name}} End',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Conditional empty test'
        }
      })

      const result = engine.render('conditional-empty', {
        variables: { name: '' }
      })

      expect(result.userPrompt).toBe('Start End')
    })

    it('removes block when variable is null', () => {
      engine.register({
        id: 'conditional-null',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'Start{{#name}} Name: {{name}}{{/name}} End',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Conditional null test'
        }
      })

      const result = engine.render('conditional-null', {
        variables: { name: null }
      })

      expect(result.userPrompt).toBe('Start End')
    })
  })

  describe('render - array iteration', () => {
    it('iterates over array of strings', () => {
      engine.register({
        id: 'array-strings',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'Items:{{#items}}\n- {{.}}{{/items}}',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Array strings test'
        }
      })

      const result = engine.render('array-strings', {
        variables: { items: ['Apple', 'Banana', 'Cherry'] }
      })

      expect(result.userPrompt).toBe('Items:\n- Apple\n- Banana\n- Cherry')
    })

    it('iterates over array of objects', () => {
      engine.register({
        id: 'array-objects',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'Users:{{#users}}\n- {{name}} ({{email}}){{/users}}',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Array objects test'
        }
      })

      const result = engine.render('array-objects', {
        variables: {
          users: [
            { name: 'Alice', email: 'alice@test.com' },
            { name: 'Bob', email: 'bob@test.com' }
          ]
        }
      })

      expect(result.userPrompt).toBe('Users:\n- Alice (alice@test.com)\n- Bob (bob@test.com)')
    })

    it('renders empty for empty array', () => {
      engine.register({
        id: 'empty-array',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'Start{{#items}}- {{.}}{{/items}}End',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Empty array test'
        }
      })

      const result = engine.render('empty-array', {
        variables: { items: [] }
      })

      expect(result.userPrompt).toBe('StartEnd')
    })
  })

  describe('getByCategory', () => {
    it('returns all templates for a category', () => {
      engine.register({
        id: 'script-1',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'test',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Script 1'
        }
      })

      engine.register({
        id: 'script-2',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'test',
        metadata: {
          category: 'script',
          creativity: 0.6,
          maxOutputTokens: 200,
          description: 'Script 2'
        }
      })

      engine.register({
        id: 'character-1',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'test',
        metadata: {
          category: 'character',
          creativity: 0.7,
          maxOutputTokens: 150,
          description: 'Character 1'
        }
      })

      const scripts = engine.getByCategory('script')
      expect(scripts.length).toBe(2)
      expect(scripts.every((t) => t.metadata.category === 'script')).toBe(true)
    })
  })

  describe('static render method', () => {
    it('provides convenient static render method', () => {
      engine.register({
        id: 'static-test',
        version: '1.0.0',
        systemPrompt: 'System',
        userPromptTemplate: 'Hello {{name}}',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Static test'
        }
      })

      const result = PromptTemplateEngine.render('static-test', { name: 'World' })
      expect(result.userPrompt).toBe('Hello World')
    })
  })

  describe('hasTemplate', () => {
    it('returns true for registered template', () => {
      engine.register({
        id: 'exists',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'test',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'Test'
        }
      })

      expect(engine.hasTemplate('exists')).toBe(true)
    })

    it('returns false for non-existent template', () => {
      expect(engine.hasTemplate('does-not-exist')).toBe(false)
    })
  })

  describe('getTemplateIds', () => {
    it('returns all registered template IDs', () => {
      engine.register({
        id: 'template-a',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'test',
        metadata: {
          category: 'script',
          creativity: 0.5,
          maxOutputTokens: 100,
          description: 'A'
        }
      })

      engine.register({
        id: 'template-b',
        version: '1.0.0',
        systemPrompt: 'test',
        userPromptTemplate: 'test',
        metadata: {
          category: 'character',
          creativity: 0.6,
          maxOutputTokens: 200,
          description: 'B'
        }
      })

      const ids = engine.getTemplateIds()
      expect(ids).toContain('template-a')
      expect(ids).toContain('template-b')
      expect(ids.length).toBe(2)
    })
  })
})
