/** 登录 / 注册页左侧展示的平台介绍（与 README 产品定位一致） */
export const AUTH_PLATFORM = {
  product: 'Dreamer',
  title: 'AI 短剧工作台',
  tagline:
    '从一句话创意到可发布短视频：剧本结构化、分镜与提示词、多模型视频生成与成片导出，全程可控、可干预。',
  features: [
    {
      key: 'script' as const,
      text: '剧本导入与多集拆解，角色、场景、台词与语音配置一体化管理'
    },
    {
      key: 'video' as const,
      text: 'Wan 2.6 低成本试错与 Seedance 2.0 精修，队列与 SSE 实时掌握生成进度'
    },
    {
      key: 'pipeline' as const,
      text: '任务中心聚合视频、剧本导入与 Pipeline，便于排障与复盘'
    },
    {
      key: 'compose' as const,
      text: '分镜挑选、合成导出，FFmpeg 串联镜头产出成品'
    }
  ]
}
