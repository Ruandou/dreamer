import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { composeVideo, CompositionSegment } from '../services/ffmpeg.js'
import { uploadFile, generateFileKey } from '../services/storage.js'

export async function compositionRoutes(fastify: FastifyInstance) {
  // List compositions for a project
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { projectId } = request.query
      return prisma.composition.findMany({
        where: { projectId },
        include: { segments: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' }
      })
    }
  )

  // Get composition with scene details
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const composition = await prisma.composition.findUnique({
        where: { id: request.params.id },
        include: {
          segments: {
            orderBy: { order: 'asc' },
            include: {
              // Note: We're using sceneId to link, but need to get video URL from VideoTask
            }
          }
        }
      })

      if (!composition) {
        return reply.status(404).send({ error: 'Composition not found' })
      }

      // Enrich segments with video URLs from selected VideoTasks
      const enrichedSegments = await Promise.all(
        composition.segments.map(async (segment) => {
          // Find the selected video task for this scene
          const selectedTask = await prisma.videoTask.findFirst({
            where: {
              sceneId: segment.sceneId,
              isSelected: true,
              status: 'completed'
            }
          })

          return {
            ...segment,
            videoUrl: selectedTask?.videoUrl || null,
            thumbnailUrl: selectedTask?.thumbnailUrl || null
          }
        })
      )

      return {
        ...composition,
        segments: enrichedSegments
      }
    }
  )

  // Create composition
  fastify.post<{ Body: { projectId: string; title: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, title } = request.body

      const composition = await prisma.composition.create({
        data: { projectId, title }
      })

      return reply.status(201).send(composition)
    }
  )

  // Update composition
  fastify.put<{ Params: { id: string }; Body: { title?: string; duration?: number; width?: number; height?: number } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { title, duration, width, height } = request.body

      const composition = await prisma.composition.update({
        where: { id: request.params.id },
        data: { title, duration, width, height }
      })

      return composition
    }
  )

  // Delete composition
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await prisma.composition.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    }
  )

  // Update timeline (segments)
  fastify.put<{ Params: { id: string }; Body: { segments: any[] } }>(
    '/:id/timeline',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { segments } = request.body
      const compositionId = request.params.id

      // Delete existing segments
      await prisma.segment.deleteMany({ where: { compositionId } })

      // Create new segments
      if (segments.length > 0) {
        await prisma.segment.createMany({
          data: segments.map((seg: any) => ({
            compositionId,
            sceneId: seg.sceneId,
            order: seg.order,
            startTime: seg.startTime || 0,
            endTime: seg.endTime || 5,
            transition: seg.transition || 'none'
          }))
        })
      }

      // Calculate total duration
      const totalDuration = segments.reduce(
        (sum: number, seg: any) => sum + (seg.endTime - seg.startTime || 5),
        0
      )

      await prisma.composition.update({
        where: { id: compositionId },
        data: { duration: totalDuration }
      })

      return prisma.composition.findUnique({
        where: { id: compositionId },
        include: { segments: { orderBy: { order: 'asc' } } }
      })
    }
  )

  // Upload audio (voiceover, bgm)
  fastify.post<{ Params: { id: string } }>(
    '/:id/audio',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const compositionId = request.params.id
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      const audioType = data.fieldname // 'voiceover' or 'bgm'
      if (audioType !== 'voiceover' && audioType !== 'bgm') {
        return reply.status(400).send({ error: 'Invalid audio type' })
      }

      // Upload to MinIO
      const buffer = await data.toBuffer()
      const key = generateFileKey('assets', `${audioType}_${Date.now()}.mp3`)
      const url = await uploadFile('assets', key, buffer, data.mimetype)

      const updateData: any = {}
      updateData[audioType] = url

      const composition = await prisma.composition.update({
        where: { id: compositionId },
        data: updateData
      })

      return composition
    }
  )

  // Upload subtitles file
  fastify.post<{ Params: { id: string } }>(
    '/:id/subtitles',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const compositionId = request.params.id
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      // Only accept SRT or VTT files
      if (!data.filename.endsWith('.srt') && !data.filename.endsWith('.vtt')) {
        return reply.status(400).send({ error: 'Only SRT and VTT subtitle files are supported' })
      }

      // Upload to MinIO
      const buffer = await data.toBuffer()
      const key = generateFileKey('assets', `subtitles_${Date.now()}.srt`)
      const url = await uploadFile('assets', key, buffer, data.mimetype)

      const composition = await prisma.composition.update({
        where: { id: compositionId },
        data: { subtitles: url }
      })

      return composition
    }
  )

  // Trigger export
  fastify.post<{ Params: { id: string } }>(
    '/:id/export',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const composition = await prisma.composition.findUnique({
        where: { id: request.params.id },
        include: { segments: { orderBy: { order: 'asc' } } }
      })

      if (!composition) {
        return reply.status(404).send({ error: 'Composition not found' })
      }

      if (composition.segments.length === 0) {
        return reply.status(400).send({ error: 'No segments to export' })
      }

      // Update status to exporting
      await prisma.composition.update({
        where: { id: request.params.id },
        data: { status: 'exporting' }
      })

      try {
        // Get video URLs for all segments
        const segmentsWithVideos: CompositionSegment[] = []

        for (const segment of composition.segments) {
          // Find the selected video task for this scene
          const selectedTask = await prisma.videoTask.findFirst({
            where: {
              sceneId: segment.sceneId,
              isSelected: true,
              status: 'completed'
            }
          })

          if (!selectedTask?.videoUrl) {
            throw new Error(`No selected video found for scene ${segment.sceneId}`)
          }

          segmentsWithVideos.push({
            sceneId: segment.sceneId,
            videoUrl: selectedTask.videoUrl,
            startTime: segment.startTime,
            endTime: segment.endTime,
            transition: segment.transition || undefined
          })
        }

        // Run FFmpeg composition
        const result = await composeVideo({
          segments: segmentsWithVideos,
          voiceoverUrl: composition.voiceover || undefined,
          bgmUrl: composition.bgm || undefined,
          subtitlesUrl: composition.subtitles || undefined,
          outputWidth: composition.width || 1080,
          outputHeight: composition.height || 1920
        })

        // Update composition with output URL and status
        await prisma.composition.update({
          where: { id: request.params.id },
          data: {
            status: 'exported',
            outputUrl: result.outputUrl,
            duration: result.duration
          }
        })

        return {
          message: 'Export completed',
          outputUrl: result.outputUrl,
          duration: result.duration
        }
      } catch (error) {
        console.error('Export failed:', error)

        await prisma.composition.update({
          where: { id: request.params.id },
          data: { status: 'draft' }
        })

        return reply.status(500).send({
          error: 'Export failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )
}
