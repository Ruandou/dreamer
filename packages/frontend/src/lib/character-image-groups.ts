import type { CharacterImage } from '@dreamer/shared/types'

function byOrder(a: CharacterImage, b: CharacterImage): number {
  return (a.order ?? 0) - (b.order ?? 0)
}

/** 是否已有「无父级 + type=base」的定妆槽（每角色仅允许一个） */
export function hasRootBaseImage(images: CharacterImage[] | undefined): boolean {
  if (!images?.length) return false
  return images.some((img) => img.type === 'base' && !img.parentId)
}

/** 无父级且 type=base：唯一基础定妆，不可删除 */
export function isRootBaseImage(img: CharacterImage | undefined | null): boolean {
  return Boolean(img && img.type === 'base' && !img.parentId)
}

/** 主栏展示的基础形象：仅 type=base 且无父；若无则退化为全部无父节点（兼容旧数据） */
export function getDisplayBaseImages(images: CharacterImage[]): CharacterImage[] {
  const sorted = [...images].sort(byOrder)
  const bases = sorted.filter((img) => img.type === 'base' && !img.parentId)
  if (bases.length > 0) return bases
  return sorted.filter((img) => !img.parentId)
}

/**
 * 挂在某个基础下的衍生：parentId 指向该基础；
 * 无父且非 base 的「松散根」仅归并到首个基础下，避免与主形象割裂。
 */
export function getDisplayDerivedImages(
  images: CharacterImage[],
  baseId: string
): CharacterImage[] {
  const sorted = [...images].sort(byOrder)
  const bases = getDisplayBaseImages(images)
  const primaryId = bases[0]?.id
  const primaryRow = primaryId ? bases.find((b) => b.id === primaryId) : undefined
  const primaryIsBase = primaryRow?.type === 'base'

  const direct = sorted.filter((img) => img.parentId === baseId)
  const looseRootsOnPrimary =
    primaryIsBase && primaryId === baseId
      ? sorted.filter((img) => !img.parentId && img.type !== 'base')
      : []
  const seen = new Set<string>()
  const out: CharacterImage[] = []
  for (const img of [...direct, ...looseRootsOnPrimary]) {
    if (seen.has(img.id)) continue
    seen.add(img.id)
    out.push(img)
  }
  return out.sort(byOrder)
}
