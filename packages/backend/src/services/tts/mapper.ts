/**
 * 音色映射表
 * 将 VoiceConfig 映射为各 TTS 平台的 voice_id
 */

import type { VoiceConfig } from '@dreamer/shared/types'
import { logWarning } from '../../lib/error-logger.js'

// 阿里云 Qwen3-TTS 映射表
const ALIYUN_VOICE_MAP: Record<string, Record<string, Record<string, string>>> = {
  male: {
    young: {
      warm_solid: 'zh_male_qingrun',
      clear_bright: 'zh_male_qingse',
      default: 'zh_male_shaonian'
    },
    middle_aged: {
      warm_solid: 'zh_male_wenrun',
      warm_thick: 'zh_male_zhongnian',
      default: 'zh_male_zhongnian'
    },
    old: {
      default: 'zh_male_laonian'
    },
    teen: {
      default: 'zh_male_shaonian'
    }
  },
  female: {
    young: {
      warm_solid: 'zh_female_shuangkuai',
      soft_gentle: 'zh_female_wenrou',
      clear_bright: 'zh_female_qingxin',
      default: 'zh_female_qingxin'
    },
    middle_aged: {
      warm_solid: 'zh_female_wenhou',
      warm_thick: 'zh_female_zhongnian',
      default: 'zh_female_zhongnian'
    },
    old: {
      default: 'zh_female_laonian'
    },
    teen: {
      default: 'zh_female_qingxin'
    }
  }
}

// 火山引擎映射表 (示例，实际需要根据火山引擎API调整)
const VOLCANO_VOICE_MAP: Record<string, Record<string, Record<string, string>>> = {
  male: {
    young: {
      warm_solid: 'BV700_V2_male_qingrun',
      clear_bright: 'BV700_V2_male_qingse',
      default: 'BV700_V2_male_youth'
    },
    middle_aged: {
      warm_solid: 'BV700_V2_male_wenrou',
      warm_thick: 'BV700_V2_male_zhongnian',
      default: 'BV700_V2_male_zhongnian'
    },
    old: {
      default: 'BV700_V2_male_old'
    },
    teen: {
      default: 'BV700_V2_male_youth'
    }
  },
  female: {
    young: {
      warm_solid: 'BV700_V2_female_shuangkuai',
      soft_gentle: 'BV700_V2_female_wenrou',
      clear_bright: 'BV700_V2_female_qingxin',
      default: 'BV700_V2_female_youth'
    },
    middle_aged: {
      warm_solid: 'BV700_V2_female_wenhou',
      warm_thick: 'BV700_V2_female_zhongnian',
      default: 'BV700_V2_female_zhongnian'
    },
    old: {
      default: 'BV700_V2_female_old'
    },
    teen: {
      default: 'BV700_V2_female_youth'
    }
  }
}

export type TTSPlatform = 'aliyun' | 'volcano'

const PLATFORM_MAPS: Record<TTSPlatform, Record<string, Record<string, Record<string, string>>>> = {
  aliyun: ALIYUN_VOICE_MAP,
  volcano: VOLCANO_VOICE_MAP
}

const DEFAULT_VOICE: Record<TTSPlatform, string> = {
  aliyun: 'zh_female_qingxin',
  volcano: 'BV700_V2_female_youth'
}

/**
 * 根据 VoiceConfig 获取平台对应的 voice_id
 */
export function getVoiceIdFromConfig(
  voiceConfig: VoiceConfig,
  platform: TTSPlatform = 'aliyun'
): string {
  const { gender, age, timbre } = voiceConfig

  const platformMap = PLATFORM_MAPS[platform]

  try {
    // 按优先级逐层匹配：gender -> age -> timbre
    if (platformMap[gender] && platformMap[gender][age]) {
      return platformMap[gender][age][timbre] || platformMap[gender][age].default
    }
    // 降级：只按性别匹配
    if (platformMap[gender]) {
      const genderVoices = platformMap[gender]
      for (const ageGroup of Object.values(genderVoices)) {
        if (ageGroup.default) {
          return ageGroup.default
        }
      }
    }
  } catch {
    // 忽略错误
  }

  // 最终降级
  logWarning('TTS', `Voice mapping failed for ${gender}/${age}/${timbre}, using default voice`)
  return DEFAULT_VOICE[platform]
}
