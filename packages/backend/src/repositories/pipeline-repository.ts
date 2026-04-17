import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type {
  ScriptContent,
  ScriptScene,
  EpisodePlan,
  StoryboardSegment
} from '@dreamer/shared/types'

export class PipelineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findFirstProjectOwned(projectId: string, userId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, userId }
    })
  }

  createPipelineJob(data: Prisma.PipelineJobUncheckedCreateInput) {
    return this.prisma.pipelineJob.create({ data })
  }

  createPipelineStepResultsMany(
    data: Array<{
      jobId: string
      step: string
      status: string
    }>
  ) {
    return this.prisma.pipelineStepResult.createMany({ data })
  }

  findUniqueJobWithSteps(jobId: string) {
    return this.prisma.pipelineJob.findUnique({
      where: { id: jobId },
      include: { stepResults: true }
    })
  }

  findFirstJobByProjectNewest(projectId: string) {
    return this.prisma.pipelineJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { stepResults: true }
    })
  }

  findManyJobsForUser(userId: string) {
    return this.prisma.pipelineJob.findMany({
      where: {
        project: { userId }
      },
      include: {
        project: { select: { id: true, name: true } },
        stepResults: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  findUniqueJob(jobId: string) {
    return this.prisma.pipelineJob.findUnique({ where: { id: jobId } })
  }

  updateJob(jobId: string, data: Prisma.PipelineJobUpdateInput) {
    return this.prisma.pipelineJob.update({
      where: { id: jobId },
      data
    })
  }

  /** 分集「AI 分镜剧本」异步任务：同集仅允许一条进行中 */
  async countActiveEpisodeStoryboardScriptJobs(
    projectId: string,
    episodeId: string
  ): Promise<number> {
    const rows = await this.prisma.pipelineJob.findMany({
      where: {
        projectId,
        jobType: 'episode-storyboard-script',
        status: { in: ['pending', 'running'] }
      },
      select: { progressMeta: true }
    })
    return rows.filter((r) => {
      const m = r.progressMeta as { episodeId?: string } | null
      return m?.episodeId === episodeId
    }).length
  }

  /**
   * 项目中已成功完成的「AI 分镜剧本」任务对应的分集 id（用于列表展示与入队前校验）
   */
  async findEpisodeIdsWithCompletedStoryboardScript(projectId: string): Promise<Set<string>> {
    const rows = await this.prisma.pipelineJob.findMany({
      where: {
        projectId,
        jobType: 'episode-storyboard-script',
        status: 'completed'
      },
      select: { progressMeta: true }
    })
    const out = new Set<string>()
    for (const r of rows) {
      const m = r.progressMeta as { episodeId?: string } | null
      if (m?.episodeId) out.add(m.episodeId)
    }
    return out
  }

  /** 该分集是否已有成功完成的「AI 分镜剧本」任务（同集仅允许成功一次） */
  async hasCompletedEpisodeStoryboardScriptJob(
    projectId: string,
    episodeId: string
  ): Promise<boolean> {
    const ids = await this.findEpisodeIdsWithCompletedStoryboardScript(projectId)
    return ids.has(episodeId)
  }

  private static readonly OUTLINE_ASYNC_JOB_TYPES = [
    'script-batch',
    'parse-script',
    'script-first'
  ] as const

  countOutlineAsyncJobs(projectId: string) {
    return this.prisma.pipelineJob.count({
      where: {
        projectId,
        status: { in: ['pending', 'running'] },
        jobType: { in: [...PipelineRepository.OUTLINE_ASYNC_JOB_TYPES] }
      }
    })
  }

  async getActiveOutlinePipelineJob(projectId: string) {
    const active = {
      projectId,
      status: { in: ['pending', 'running'] as string[] }
    }
    const parse = await this.prisma.pipelineJob.findFirst({
      where: { ...active, jobType: 'parse-script' },
      orderBy: { createdAt: 'desc' }
    })
    if (parse) return parse
    const batch = await this.prisma.pipelineJob.findFirst({
      where: { ...active, jobType: 'script-batch' },
      orderBy: { createdAt: 'desc' }
    })
    if (batch) return batch
    return this.prisma.pipelineJob.findFirst({
      where: { ...active, jobType: 'script-first' },
      orderBy: { createdAt: 'desc' }
    })
  }

  updateStepResult(
    jobId: string,
    step: string,
    update: {
      status?: string
      input?: unknown
      output?: unknown
      error?: string
    }
  ) {
    return this.prisma.pipelineStepResult.updateMany({
      where: { jobId, step },
      data: {
        ...update,
        updatedAt: new Date()
      } as Prisma.PipelineStepResultUpdateManyMutationInput
    })
  }

  findProjectUserId(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true }
    })
  }

  findEpisodesUpTo(projectId: string, maxEpisodeNum: number) {
    return this.prisma.episode.findMany({
      where: { projectId, episodeNum: { lte: maxEpisodeNum } },
      orderBy: { episodeNum: 'asc' }
    })
  }

  findCharactersWithImages(projectId: string) {
    return this.prisma.character.findMany({
      where: { projectId },
      include: { images: true }
    })
  }

  findLocationsActive(projectId: string) {
    return this.prisma.location.findMany({
      where: { projectId, deletedAt: null }
    })
  }

  async saveEpisodes(projectId: string, episodes: EpisodePlan[], scriptContent: ScriptContent) {
    for (const episode of episodes) {
      await this.prisma.episode.upsert({
        where: {
          projectId_episodeNum: { projectId, episodeNum: episode.episodeNum }
        },
        update: {
          title: episode.title,
          synopsis: episode.synopsis,
          script: scriptContent as object
        },
        create: {
          projectId,
          episodeNum: episode.episodeNum,
          title: episode.title,
          synopsis: episode.synopsis,
          script: scriptContent as object
        }
      })
    }
  }

  async saveSegments(
    projectId: string,
    episodes: EpisodePlan[],
    storyboard: StoryboardSegment[],
    scriptScenes: ScriptScene[]
  ) {
    for (const segment of storyboard) {
      const episode = episodes.find((e) => e.episodeNum === segment.episodeNum)
      if (!episode) continue

      const episodeRecord = await this.prisma.episode.findFirst({
        where: { projectId, episodeNum: segment.episodeNum }
      })
      if (!episodeRecord) continue

      let locationId: string | undefined
      if (segment.location) {
        const location = await this.prisma.location.findFirst({
          where: { projectId, name: segment.location, deletedAt: null }
        })
        locationId = location?.id
      }

      const sceneRecord = await this.prisma.scene.upsert({
        where: {
          episodeId_sceneNum: {
            episodeId: episodeRecord.id,
            sceneNum: segment.segmentNum
          }
        },
        update: {
          locationId,
          duration: segment.duration,
          aspectRatio: segment.aspectRatio,
          visualStyle: segment.visualStyle || [],
          description: segment.description,
          timeOfDay: segment.timeOfDay,
          status: 'pending'
        },
        create: {
          episodeId: episodeRecord.id,
          sceneNum: segment.segmentNum,
          locationId,
          duration: segment.duration,
          aspectRatio: segment.aspectRatio,
          visualStyle: segment.visualStyle || [],
          description: segment.description,
          timeOfDay: segment.timeOfDay,
          status: 'pending'
        }
      })

      await this.prisma.shot.deleteMany({ where: { sceneId: sceneRecord.id } })
      await this.prisma.sceneDialogue.deleteMany({ where: { sceneId: sceneRecord.id } })

      if (segment.subShots && segment.subShots.length > 0) {
        for (const subShot of segment.subShots) {
          await this.prisma.shot.create({
            data: {
              sceneId: sceneRecord.id,
              shotNum: subShot.order,
              order: subShot.order,
              description: subShot.description,
              duration: subShot.durationMs,
              cameraMovement: segment.cameraMovement
            }
          })
        }
      } else {
        await this.prisma.shot.create({
          data: {
            sceneId: sceneRecord.id,
            shotNum: 1,
            order: 1,
            description: segment.seedancePrompt,
            duration: segment.duration,
            cameraMovement: segment.cameraMovement
          }
        })
      }

      const firstShot = await this.prisma.shot.findFirst({
        where: { sceneId: sceneRecord.id },
        orderBy: [{ order: 'asc' }, { shotNum: 'asc' }]
      })

      if (segment.characterActions && firstShot) {
        for (const [characterName, action] of Object.entries(segment.characterActions)) {
          const character = await this.prisma.character.findFirst({
            where: { projectId, name: characterName }
          })
          if (!character) continue

          const characterImage = await this.prisma.characterImage.findFirst({
            where: { characterId: character.id, type: 'base' }
          })
          if (!characterImage) continue

          await this.prisma.characterShot.upsert({
            where: {
              shotId_characterImageId: {
                shotId: firstShot.id,
                characterImageId: characterImage.id
              }
            },
            update: { action },
            create: {
              shotId: firstShot.id,
              characterImageId: characterImage.id,
              action
            }
          })
        }
      }

      if (segment.voiceSegments && segment.voiceSegments.length > 0) {
        const sceneIndex = episode.sceneIndices
          ? episode.sceneIndices[segment.segmentNum - 1]
          : segment.segmentNum - 1
        const scriptScene = scriptScenes[sceneIndex]

        for (const voice of segment.voiceSegments) {
          let characterId = voice.characterId

          if (!characterId && scriptScene) {
            const characterName = scriptScene.dialogues[voice.order - 1]?.character
            if (characterName) {
              const character = await this.prisma.character.findFirst({
                where: { projectId, name: characterName }
              })
              if (character) {
                characterId = character.id
              }
            }
          }

          if (!characterId && segment.characters && scriptScene) {
            const dialogue = scriptScene.dialogues[voice.order - 1]
            if (dialogue) {
              const characterInSegment = segment.characters.find(
                (c) => c.name === dialogue.character
              )
              if (characterInSegment) {
                const character = await this.prisma.character.findFirst({
                  where: { projectId, name: dialogue.character }
                })
                if (character) {
                  characterId = character.id
                }
              }
            }
          }

          if (!characterId) {
            console.warn(
              `SceneDialogue skipped: no character for scene ${sceneRecord.id}, order ${voice.order}`
            )
            continue
          }

          await this.prisma.sceneDialogue.create({
            data: {
              sceneId: sceneRecord.id,
              characterId,
              order: voice.order,
              startTimeMs: voice.startTimeMs,
              durationMs: voice.durationMs,
              text: voice.text,
              voiceConfig: JSON.parse(JSON.stringify(voice.voiceConfig)) as object,
              emotion: voice.emotion
            }
          })
        }
      }
    }
  }
}

export const pipelineRepository = new PipelineRepository(prisma)
