import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getRequestUserId } from '../plugins/auth.js'

const BUILTIN_HOOKS = [
  { category: '悬念', content: '他缓缓摘下口罩，对面的人瞪大了眼——是你？', tags: ['身份', '揭露'] },
  {
    category: '悬念',
    content: '手机屏幕亮起，一条陌生号码的短信："别相信任何人。"',
    tags: ['威胁', '神秘']
  },
  {
    category: '反转',
    content: '她以为胜券在握，直到他掏出那份她亲手签字的合同。',
    tags: ['打脸', '反转']
  },
  { category: '反转', content: '保姆一声"少爷"，全场鸦雀无声。', tags: ['身份', '打脸'] },
  { category: '威胁', content: '门被推开的瞬间，她看到了不该看到的东西。', tags: ['秘密', '危险'] },
  { category: '威胁', content: '"你以为换了个身份，就能逃得掉吗？"', tags: ['追杀', '身份'] },
  {
    category: '情感',
    content: '他转身离去的那一刻，她终于喊出了那个藏了十年的名字。',
    tags: ['告白', '遗憾']
  },
  { category: '情感', content: '戒指从指间滑落，滚到了他的脚边。', tags: ['分手', '决裂'] },
  { category: '新危机', content: '警察上门的那一刻，她知道，一切都完了。', tags: ['法律', '危机'] },
  { category: '新危机', content: '化验单上的名字，赫然写着她自己。', tags: ['疾病', '打击'] },
  {
    category: '身份',
    content: '"介绍一下，这位是我们集团的新任CEO。"她抬头，四目相对。',
    tags: ['重逢', '身份']
  },
  {
    category: '身份',
    content: '他随手签下的名字，正是她找了整整三年的那个人。',
    tags: ['寻找', '真相']
  },
  {
    category: '冲突',
    content: '巴掌落下的瞬间，全场寂静。她捂着脸，却笑了。',
    tags: ['对抗', '黑化']
  },
  {
    category: '冲突',
    content: '"这一脚，我忍了三年。"话音未落，他已倒地。',
    tags: ['复仇', '动作']
  },
  { category: '意外', content: '婚礼进行曲响起，大门却突然被撞开。', tags: ['抢婚', '意外'] },
  {
    category: '意外',
    content: '她打开那个旧箱子，里面是一沓从未见过的照片。',
    tags: ['秘密', '回忆']
  },
  {
    category: '情感冲击',
    content: '"妈妈——"这一声，让她手中的刀掉在了地上。',
    tags: ['亲情', '唤醒']
  },
  {
    category: '情感冲击',
    content: '他临终前最后一句话，揭开了所有谜团的真相。',
    tags: ['遗言', '真相']
  },
  { category: '爽点', content: '曾经羞辱她的人，此刻正跪在她面前求饶。', tags: ['打脸', '复仇'] },
  {
    category: '爽点',
    content: '"这栋楼，现在姓林了。"她甩下钥匙，转身离去。',
    tags: ['财富', '逆袭']
  }
]

export async function hookRoutes(fastify: FastifyInstance) {
  // List hooks (builtin + user custom)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = getRequestUserId(request)
    const category = (request.query as { category?: string }).category

    const userHooks = await prisma.hookTemplate.findMany({
      where: {
        userId,
        ...(category ? { category } : {})
      },
      orderBy: { usageCount: 'desc' }
    })

    let builtinHooks = BUILTIN_HOOKS.map((h, i) => ({
      id: `builtin-hook-${i}`,
      ...h,
      isBuiltin: true
    }))

    if (category) {
      builtinHooks = builtinHooks.filter((h) => h.category === category)
    }

    return {
      builtin: builtinHooks,
      custom: userHooks
    }
  })

  // Create custom hook
  fastify.post<{
    Body: { category: string; content: string; tags?: string[] }
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUserId(request)
    const { category, content, tags = [] } = request.body

    if (!category || !content) {
      return reply.status(400).send({ error: 'category and content are required' })
    }

    const hook = await prisma.hookTemplate.create({
      data: {
        userId,
        category,
        content,
        tags
      }
    })

    return reply.status(201).send(hook)
  })

  // Delete custom hook
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { id } = request.params

      const hook = await prisma.hookTemplate.findFirst({
        where: { id, userId }
      })

      if (!hook) {
        return reply.status(404).send({ error: 'Hook not found' })
      }

      await prisma.hookTemplate.delete({ where: { id } })
      return reply.status(204).send()
    }
  )

  // Generate hooks with AI
  fastify.post<{
    Body: { content: string; count?: number }
  }>('/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUserId(request)
    const { content, count = 3 } = request.body

    if (!content) {
      return reply.status(400).send({ error: 'content is required' })
    }

    const { callLLMWithRetry } = await import('../services/ai/llm-call-wrapper.js')

    const prompt = `请为以下短剧集生成${count}个结尾钩子方案：

已写内容：
${content}

要求：
1. 每个钩子必须在最后3行内制造强烈悬念
2. 类型可选：身份揭露/意外闯入/新威胁/情感冲击/反转打脸
3. 钩子要让人忍不住想看下一集
4. 标注每个钩子的"付费转化潜力"（高/中/低）
5. 输出JSON格式：{ "hooks": [{ "content": "钩子文本", "category": "类型", "potential": "高/中/低" }] }`

    try {
      const result = await callLLMWithRetry(
        {
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          modelLog: { userId, op: 'generate_hooks' }
        },
        (content) => {
          const match = content.match(/\{[\s\S]*\}/)
          if (!match) throw new Error('Invalid JSON response')
          return JSON.parse(match[0])
        }
      )

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({ error: `生成钩子失败：${message}` })
    }
  })
}
