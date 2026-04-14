/** 角色定妆/衍生图提示词：拼接项目 visualStyle，供文生图队列使用。 */
export function buildCharacterImageStyledPrompt(
  visualStyle: string[] | undefined,
  core: string
): string {
  const vs = (visualStyle || []).filter(Boolean).join(', ')
  if (!vs) return core
  return `Visual style: ${vs}. ${core}`
}
