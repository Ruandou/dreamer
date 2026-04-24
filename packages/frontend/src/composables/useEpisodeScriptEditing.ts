import { ref, toValue } from 'vue'
import { useMessage } from 'naive-ui'
import type { MaybeRefOrGetter } from 'vue'
import type { ScriptContent, ScriptScene } from '@dreamer/shared/types'
import { parseEditorDocToScene } from '@/lib/storyboard-editor/script-to-doc'

interface UseEpisodeScriptEditingOptions {
  episodeScript: MaybeRefOrGetter<ScriptContent | null | undefined>
  selectedSceneNum: MaybeRefOrGetter<number | undefined>
  updateEpisode: (episodeId: string, data: { script: ScriptContent }) => Promise<unknown>
  reload: () => Promise<void>
  episodeId: MaybeRefOrGetter<string>
}

export function useEpisodeScriptEditing(options: UseEpisodeScriptEditingOptions) {
  const message = useMessage()

  const scriptEditing = ref(false)
  const scriptSaving = ref(false)

  async function onSaveScript(script: ScriptContent) {
    scriptSaving.value = true
    try {
      const fullScript = toValue(options.episodeScript) as ScriptContent | undefined
      const currentSceneNum = toValue(options.selectedSceneNum)
      let finalScript = script

      if (fullScript?.scenes?.length && currentSceneNum) {
        const currentScene = fullScript.scenes.find((s) => s.sceneNum === currentSceneNum)
        const parsedScene = parseEditorDocToScene(
          script.editorDoc || null,
          currentSceneNum,
          currentScene || undefined
        )

        const otherScenes = fullScript.scenes.filter((s) => s.sceneNum !== currentSceneNum)
        finalScript = {
          ...fullScript,
          editorDoc: script.editorDoc,
          scenes: [...otherScenes, parsedScene as ScriptScene]
        }
      }

      await options.updateEpisode(toValue(options.episodeId), { script: finalScript })
      scriptEditing.value = false
      await options.reload()
      message.success('分镜脚本已保存')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      message.error(err?.response?.data?.error || '保存失败')
    } finally {
      scriptSaving.value = false
    }
  }

  function onCancelScriptEdit() {
    scriptEditing.value = false
    void options.reload()
  }

  function onStartEdit() {
    scriptEditing.value = true
  }

  return {
    scriptEditing,
    scriptSaving,
    onSaveScript,
    onCancelScriptEdit,
    onStartEdit
  }
}
