/**
 * 项目名规范化工具
 * 用于清洗和限制项目名称，确保显示一致性
 */

/**
 * 清洗并规范化项目名
 * - 去除 Markdown 标记（#、*、_ 等）
 * - 去除首尾空白
 * - 限制最大长度（40 字符）
 * - 去除多余空白（连续空格合并为一个）
 */
export function normalizeProjectName(raw: string): string {
  if (!raw) return '未命名项目'

  let name = raw.trim()

  // 如果包含管道符或换行，只取第一部分
  const splitChars = ['|', '\n', '\r']
  for (const char of splitChars) {
    if (name.includes(char)) {
      name = name.split(char)[0]
    }
  }

  // 去除 Markdown 标题标记
  name = name.replace(/^#+\s*/, '')
  name = name.replace(/\s*#+$/, '')
  name = name.trim()

  // 去除粗体/斜体标记
  name = name.replace(/\*\*([^*]+)\*\*/g, '$1')
  name = name.replace(/\*([^*]+)\*/g, '$1')
  name = name.replace(/__([^_]+)__/g, '$1')
  name = name.replace(/_([^_]+)_/g, '$1')

  // 去除引号（《》、""、''、``）
  // 处理配对引号
  if (name.startsWith('《') && name.includes('》')) {
    const endIndex = name.indexOf('》')
    name = name.slice(1, endIndex) + name.slice(endIndex + 1)
  }
  if (name.startsWith('"') && name.indexOf('"', 1) > 0) {
    const endIndex = name.indexOf('"', 1)
    name = name.slice(1, endIndex) + name.slice(endIndex + 1)
  }
  if (name.startsWith("'") && name.indexOf("'", 1) > 0) {
    const endIndex = name.indexOf("'", 1)
    name = name.slice(1, endIndex) + name.slice(endIndex + 1)
  }
  if (name.startsWith('`') && name.indexOf('`', 1) > 0) {
    const endIndex = name.indexOf('`', 1)
    name = name.slice(1, endIndex) + name.slice(endIndex + 1)
  }

  // 合并连续空白并trim
  name = name.replace(/\s+/g, ' ').trim()

  // 限制最大长度为 40 字符
  if (name.length > 40) {
    name = name.slice(0, 37) + '…'
  }

  return name || '未命名项目'
}
