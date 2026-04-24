<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api'
import type { Character } from '@dreamer/shared/types'

interface SceneLocation {
  id: string
  name: string
  imageUrl?: string | null
}

interface Scene {
  id: string
  location?: SceneLocation | null
  dialogues?: Array<{ character?: { id: string } }>
  shots?: Array<{
    characterShots?: Array<{
      characterImage?: {
        id: string
        name: string
        avatarUrl?: string | null
        character?: { id: string; name: string }
      }
    }>
  }>
}

const props = defineProps<{
  scenes: Scene[]
}>()

const projectCharacters = ref<Character[]>([])

const characterAssetTiles = computed(() => {
  const list = props.scenes
  const characterIds = new Set<string>()
  const imageIdsByCharacter = new Map<string, Set<string>>()

  for (const sc of list) {
    for (const d of sc.dialogues ?? []) {
      const id = d.character?.id
      if (id) characterIds.add(id)
    }
    for (const sh of sc.shots ?? []) {
      for (const cs of sh.characterShots ?? []) {
        const img = cs.characterImage
        const cid = img?.character?.id
        if (!cid || !img?.id) continue
        characterIds.add(cid)
        if (!imageIdsByCharacter.has(cid)) imageIdsByCharacter.set(cid, new Set())
        imageIdsByCharacter.get(cid)!.add(img.id)
      }
    }
  }

  const out: { key: string; avatarUrl?: string; label: string }[] = []
  for (const c of projectCharacters.value) {
    if (!characterIds.has(c.id)) continue
    const used = imageIdsByCharacter.get(c.id)
    const imgs = c.images ?? []
    const pick = used && used.size > 0 ? imgs.filter((im) => used.has(im.id)) : imgs
    for (const img of pick) {
      out.push({
        key: `${c.id}-${img.id}`,
        avatarUrl: img.avatarUrl ?? undefined,
        label: `${c.name}-${img.name}`
      })
    }
  }
  return out
})

const episodeLocations = computed(() => {
  const map = new Map<string, SceneLocation>()
  for (const sc of props.scenes) {
    const loc = sc.location
    if (loc?.id && !map.has(loc.id)) {
      map.set(loc.id, { id: loc.id, name: loc.name, imageUrl: loc.imageUrl })
    }
  }
  return [...map.values()]
})

onMounted(async () => {
  // Load once on mount; parent can refresh if needed
  try {
    const ch = await api.get<Character[]>('/characters')
    projectCharacters.value = ch.data
  } catch {
    projectCharacters.value = []
  }
})
</script>

<template>
  <aside class="episode-asset-library">
    <div class="episode-asset-library__header">
      <span class="episode-asset-library__title">资产库</span>
    </div>

    <div class="episode-asset-library__content">
      <section class="episode-asset-library__block">
        <div class="episode-asset-library__label">本集角色（{{ characterAssetTiles.length }}）</div>
        <div class="episode-asset-library__grid">
          <div
            v-for="tile in characterAssetTiles"
            :key="tile.key"
            class="episode-asset-library__tile"
          >
            <div class="episode-asset-library__thumb-wrap">
              <img
                v-if="tile.avatarUrl"
                :src="tile.avatarUrl"
                alt=""
                class="episode-asset-library__thumb"
              />
              <div v-else class="episode-asset-library__placeholder" />
            </div>
            <div class="episode-asset-library__name">{{ tile.label }}</div>
          </div>
          <p v-if="!characterAssetTiles.length" class="episode-asset-library__empty">
            本集暂未出现角色（台词或分镜出镜后会显示）
          </p>
        </div>
      </section>

      <div class="episode-asset-library__divider" />

      <section class="episode-asset-library__block">
        <div class="episode-asset-library__label">本集场景（{{ episodeLocations.length }}）</div>
        <div class="episode-asset-library__grid episode-asset-library__grid--loc">
          <div v-for="loc in episodeLocations" :key="loc.id" class="episode-asset-library__tile">
            <div class="episode-asset-library__thumb-wrap episode-asset-library__thumb-wrap--loc">
              <img
                v-if="loc.imageUrl"
                :src="loc.imageUrl"
                alt=""
                class="episode-asset-library__thumb"
              />
              <div v-else class="episode-asset-library__placeholder" />
            </div>
            <div class="episode-asset-library__name">{{ loc.name }}</div>
          </div>
          <p v-if="!episodeLocations.length" class="episode-asset-library__empty">
            本集场次尚未绑定场地库场景
          </p>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.episode-asset-library {
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 280px;
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.episode-asset-library__header {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.episode-asset-library__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.episode-asset-library__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.episode-asset-library__block {
  margin-bottom: var(--spacing-md);
}

.episode-asset-library__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  font-weight: 500;
}

.episode-asset-library__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.episode-asset-library__grid--loc {
  grid-template-columns: 1fr;
}

.episode-asset-library__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.episode-asset-library__thumb-wrap {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-border-light);
}

.episode-asset-library__thumb-wrap--loc {
  aspect-ratio: 16 / 9;
}

.episode-asset-library__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.episode-asset-library__placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-border-light);
}

.episode-asset-library__name {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.episode-asset-library__empty {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-align: center;
  grid-column: 1 / -1;
}

.episode-asset-library__divider {
  height: 1px;
  background: var(--color-border-light);
  margin: var(--spacing-md) 0;
}
</style>
