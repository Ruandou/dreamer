/**
 * 视觉风格预设包
 * 常用组合，一键配置
 */

import type { VisualStylePreset } from '../types/visual-style.js'

export const VISUAL_STYLE_PRESETS: VisualStylePreset[] = [
  {
    id: 'xianxia_cultivation',
    name: '仙侠修仙',
    description: '缥缈仙境、修仙世界、仙侠奇幻',
    era: 'xianxia',
    artStyle: ['ethereal', 'stylized_realism'],
    colorMood: ['vibrant', 'golden_hour'],
    quality: 'cinema',
    keywords: ['仙侠', '缥缈', '仙境', '灵气', '云海', '仙鹤'],
    examplePrompt:
      '悬浮于云海之上的仙山主峰，白玉栏杆与盘旋石阶，凌霄殿琉璃瓦散发七彩光芒，清晨霞光照射，云海翻腾金色边缘，仙鹤翱翔，缥缈仙境氛围，仙侠奇幻风格，8K超高清'
  },
  {
    id: 'ancient_palace',
    name: '古装宫廷',
    description: '古代宫廷、皇室、权谋',
    era: 'ancient_china',
    artStyle: ['cinematic', 'photorealistic'],
    colorMood: ['warm', 'high_contrast'],
    quality: 'cinema',
    keywords: ['宫廷', '华丽', '庄严', '金碧辉煌', '朱红宫墙', '金龙彩画'],
    examplePrompt:
      '宏伟的宫殿正殿，三层汉白玉须弥座台基与蟠龙金柱，九龙金漆宝座与龙纹屏风，正午阳光照亮宝座区域，庄严肃穆皇家氛围，广角仰视构图，宫廷写实风格，8K超高清'
  },
  {
    id: 'wuxia_martial',
    name: '武侠江湖',
    description: '古代武侠、江湖恩怨、武林高手',
    era: 'wuxia',
    artStyle: ['cinematic', 'stylized_realism'],
    colorMood: ['high_contrast', 'cool'],
    quality: 'cinema',
    keywords: ['武侠', '苍凉', '豪放', '江湖', '古道西风', '客栈', '竹林'],
    examplePrompt:
      '宽敞的两层木质客栈大堂，八仙桌与长条凳，柜台与木楼梯，门口悬挂酒旗，黄昏烛光与火把暖光，光影摇曳，江湖烟火气息，武侠写实风格，8K超高清，低调光照'
  },
  {
    id: 'modern_city',
    name: '现代都市',
    description: '当代城市生活、职场、爱情',
    era: 'modern',
    artStyle: ['photorealistic', 'cinematic'],
    colorMood: ['cool', 'low_contrast'],
    quality: 'high',
    keywords: ['现代', '都市', '写字楼', '咖啡厅', '公寓', '街道'],
    examplePrompt:
      '现代咖啡厅空间，红砖墙面与原木横梁，黄铜工业风吊灯，做旧木地板，下午侧光透过百叶窗投射条纹光影，温馨慵懒氛围，电影质感，8K超高清'
  },
  {
    id: 'dark_fantasy',
    name: '暗黑奇幻',
    description: '暗黑、神秘、超自然',
    era: 'custom',
    artStyle: ['dark_fantasy', 'cinematic'],
    colorMood: ['high_contrast', 'desaturated', 'moonlight'],
    quality: 'cinema',
    keywords: ['暗黑', '神秘', '阴森', '恐怖', '哥特', '超自然'],
    examplePrompt:
      '阴森洞穴，瘴气弥漫，白骨累累，血池与魔阵，幽暗光线与血光交织，阴森恐怖氛围，暗黑奇幻风格，8K超高清，低调光照，volumetric fog'
  },
  {
    id: 'romantic_ancient',
    name: '古言 romance',
    description: '古代爱情、唯美、浪漫',
    era: 'ancient_china',
    artStyle: ['stylized_realism', 'ethereal'],
    colorMood: ['warm', 'golden_hour'],
    quality: 'cinema',
    keywords: ['唯美', '浪漫', '古风', '花前月下', '桃花', '流水'],
    examplePrompt:
      '桃花林中的古典庭院，粉白花瓣飘落，青石小径蜿蜒至池塘，六角亭立于水边，黄昏暖光穿透花枝，在水面投下斑驳光影，浪漫唯美氛围，古风写实风格，8K超高清'
  },
  {
    id: 'sci_fi_cyberpunk',
    name: '科幻赛博',
    description: '未来世界、赛博朋克、高科技',
    era: 'futuristic',
    artStyle: ['cinematic', 'dark_fantasy'],
    colorMood: ['cool', 'high_contrast', 'vibrant'],
    quality: 'cinema',
    keywords: ['赛博朋克', '霓虹灯', '高科技', '未来都市', '雨夜', '机械'],
    examplePrompt:
      '未来都市夜景，高耸摩天大楼与全息广告牌，霓虹灯光在雨夜街道反射，飞行汽车穿梭其间，冷蓝色调与霓虹彩光对比，赛博朋克风格，8K超高清，cinematic lighting'
  }
]

/** 根据 ID 查找预设 */
export function findPresetById(id: string): VisualStylePreset | undefined {
  return VISUAL_STYLE_PRESETS.find((p) => p.id === id)
}

/** 获取所有预设 ID 列表 */
export function getPresetIds(): string[] {
  return VISUAL_STYLE_PRESETS.map((p) => p.id)
}
