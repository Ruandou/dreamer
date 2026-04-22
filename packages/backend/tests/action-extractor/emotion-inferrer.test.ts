import { describe, it, expect } from 'vitest'
import {
  inferEmotionFromDialogue,
  inferEmotionFromAction
} from '../../src/services/action-extractor/emotion-inferrer.ts'

describe('Emotion Inferrer', () => {
  describe('inferEmotionFromDialogue', () => {
    it('should detect shock emotion', () => {
      expect(inferEmotionFromDialogue('什么！这不可能！')).toBe('震惊')
      expect(inferEmotionFromDialogue('太惊讶了！')).toBe('震惊')
      expect(inferEmotionFromDialogue("I can't believe it!")).toBe('震惊')
    })

    it('should detect sadness emotion', () => {
      expect(inferEmotionFromDialogue('他哭了')).toBe('悲伤')
      expect(inferEmotionFromDialogue('她流下了眼泪')).toBe('悲伤')
      expect(inferEmotionFromDialogue('She started to cry')).toBe('悲伤')
    })

    it('should detect happiness emotion', () => {
      expect(inferEmotionFromDialogue('他开心地笑了')).toBe('开心')
      expect(inferEmotionFromDialogue('他笑了')).toBe('开心')
      expect(inferEmotionFromDialogue('太开心了')).toBe('开心')
    })

    it('should detect anger emotion', () => {
      expect(inferEmotionFromDialogue('他很愤怒')).toBe('愤怒')
      expect(inferEmotionFromDialogue('气愤不已')).toBe('愤怒')
      expect(inferEmotionFromDialogue('怒不可遏')).toBe('愤怒')
    })

    it('should detect love emotion', () => {
      expect(inferEmotionFromDialogue('我爱你')).toBe('爱慕')
      expect(inferEmotionFromDialogue('I love you')).toBe('爱慕')
      expect(inferEmotionFromDialogue('我喜欢你')).toBe('爱慕')
    })

    it('should return calm for neutral dialogue', () => {
      expect(inferEmotionFromDialogue('今天天气不错')).toBe('平静')
      expect(inferEmotionFromDialogue('The weather is nice')).toBe('平静')
    })
  })

  describe('inferEmotionFromAction', () => {
    it('should detect nervousness', () => {
      expect(inferEmotionFromAction('他颤抖着伸出手')).toBe('紧张')
      expect(inferEmotionFromAction('Her hands tremble')).toBe('nervous')
    })

    it('should detect sadness from actions', () => {
      expect(inferEmotionFromAction('她流泪了')).toBe('悲伤')
      expect(inferEmotionFromAction('He began to cry')).toBe('sad')
    })

    it('should detect happiness from actions', () => {
      expect(inferEmotionFromAction('他微笑着')).toBe('开心')
      expect(inferEmotionFromAction('She smile brightly')).toBe('happy')
      expect(inferEmotionFromAction('他大笑起来')).toBe('欢乐')
    })

    it('should detect worry', () => {
      expect(inferEmotionFromAction('他皱眉')).toBe('忧虑')
      expect(inferEmotionFromAction('She frown')).toBe('worried')
    })

    it('should detect determination', () => {
      expect(inferEmotionFromAction('他抬头')).toBe('坚定')
      expect(inferEmotionFromAction('He look up')).toBe('determined')
    })

    it('should detect depression', () => {
      expect(inferEmotionFromAction('他低头')).toBe('沮丧')
      expect(inferEmotionFromAction('She head down')).toBe('depressed')
    })

    it('should detect anger from actions', () => {
      expect(inferEmotionFromAction('他握拳')).toBe('愤怒')
      expect(inferEmotionFromAction('He clench')).toBe('angry')
    })

    it('should detect intimacy', () => {
      expect(inferEmotionFromAction('他们拥抱在一起')).toBe('亲密')
      expect(inferEmotionFromAction('They hug')).toBe('intimate')
    })

    it('should detect farewell', () => {
      expect(inferEmotionFromAction('他挥手告别')).toBe('告别')
      expect(inferEmotionFromAction('She wave goodbye')).toBe('goodbye')
    })

    it('should return neutral for unknown actions', () => {
      expect(inferEmotionFromAction('他站着')).toBe('中性')
      expect(inferEmotionFromAction('He stood there')).toBe('中性')
    })
  })
})
