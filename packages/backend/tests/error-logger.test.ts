import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  logError,
  logWarning,
  logOperationStart,
  logOperationComplete
} from '../src/lib/error-logger.ts'

describe('Error Logger', () => {
  let consoleErrorSpy: any
  let consoleWarnSpy: any
  let consoleLogSpy: any

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('logError', () => {
    it('should log error message with context', () => {
      const error = new Error('Test error')
      logError('TestContext', error)

      expect(consoleErrorSpy).toHaveBeenCalled()
      const callArgs = consoleErrorSpy.mock.calls[0]
      expect(callArgs[0]).toContain('[TestContext]')
      expect(callArgs[0]).toContain('Test error')
    })

    it('should log error with metadata', () => {
      const error = new Error('Database error')
      logError('Database', error, { userId: '123', query: 'SELECT *' })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const callArgs = consoleErrorSpy.mock.calls[0]
      expect(callArgs[1]).toHaveProperty('userId', '123')
      expect(callArgs[1]).toHaveProperty('query', 'SELECT *')
    })

    it('should include stack trace', () => {
      const error = new Error('Test error')
      logError('TestContext', error)

      expect(consoleErrorSpy).toHaveBeenCalled()
      const callArgs = consoleErrorSpy.mock.calls[0]
      expect(callArgs[1]).toHaveProperty('stack')
    })

    it('should handle non-Error objects', () => {
      logError('TestContext', 'String error')

      expect(consoleErrorSpy).toHaveBeenCalled()
      const callArgs = consoleErrorSpy.mock.calls[0]
      expect(callArgs[0]).toContain('String error')
    })
  })

  describe('logWarning', () => {
    it('should log warning message with context', () => {
      logWarning('API', 'Deprecated endpoint called')

      expect(consoleWarnSpy).toHaveBeenCalled()
      const callArgs = consoleWarnSpy.mock.calls[0]
      expect(callArgs[0]).toContain('[API]')
      expect(callArgs[0]).toContain('Deprecated endpoint called')
    })

    it('should log warning with metadata', () => {
      logWarning('Auth', 'Failed login attempt', { ip: '192.168.1.1' })

      expect(consoleWarnSpy).toHaveBeenCalled()
      const callArgs = consoleWarnSpy.mock.calls[0]
      expect(callArgs[1]).toHaveProperty('ip', '192.168.1.1')
    })
  })

  describe('logOperationStart', () => {
    it('should log operation start', () => {
      logOperationStart('DataSync')

      expect(consoleLogSpy).toHaveBeenCalled()
      const callArgs = consoleLogSpy.mock.calls[0]
      expect(callArgs[0]).toContain('[DataSync]')
      expect(callArgs[0]).toContain('Operation started')
    })

    it('should include metadata', () => {
      logOperationStart('Import', { fileName: 'data.csv' })

      expect(consoleLogSpy).toHaveBeenCalled()
      const callArgs = consoleLogSpy.mock.calls[0]
      expect(callArgs[1]).toHaveProperty('fileName', 'data.csv')
    })
  })

  describe('logOperationComplete', () => {
    it('should log operation completion', () => {
      logOperationComplete('DataSync')

      expect(consoleLogSpy).toHaveBeenCalled()
      const callArgs = consoleLogSpy.mock.calls[0]
      expect(callArgs[0]).toContain('[DataSync]')
      expect(callArgs[0]).toContain('Operation completed')
    })

    it('should include duration when provided', () => {
      logOperationComplete('DataSync', 1500)

      expect(consoleLogSpy).toHaveBeenCalled()
      const callArgs = consoleLogSpy.mock.calls[0]
      expect(callArgs[1]).toHaveProperty('durationMs', 1500)
    })

    it('should not include duration when undefined', () => {
      logOperationComplete('DataSync', undefined)

      expect(consoleLogSpy).toHaveBeenCalled()
      const callArgs = consoleLogSpy.mock.calls[0]
      expect(callArgs[1]).not.toHaveProperty('durationMs')
    })

    it('should include additional metadata', () => {
      logOperationComplete('Import', 2000, { recordsProcessed: 100 })

      expect(consoleLogSpy).toHaveBeenCalled()
      const callArgs = consoleLogSpy.mock.calls[0]
      expect(callArgs[1]).toHaveProperty('recordsProcessed', 100)
      expect(callArgs[1]).toHaveProperty('durationMs', 2000)
    })
  })
})
