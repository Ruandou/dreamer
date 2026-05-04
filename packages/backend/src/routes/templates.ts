import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getRequestUser } from '../plugins/auth.js'
import { generateOutline } from '../services/ai/outline-generator.js'

const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-soninlaw',
    name: '赘婿逆袭流',
    category: '男频/逆袭',
    description: '隐藏身份→被羞辱→身份揭露→打脸爽点→新危机，循环推进。适合男频下沉市场。',
    structure: {
      acts: [
        {
          act: 1,
          name: '隐忍蛰伏',
          episodes: '1-8',
          beats: ['隐藏真实身份', '被丈母娘/妻子羞辱', '暗中布局']
        },
        {
          act: 2,
          name: '初露锋芒',
          episodes: '9-18',
          beats: ['小范围身份暗示', '解决第一个危机', '反派开始怀疑']
        },
        {
          act: 3,
          name: '身份揭露',
          episodes: '19-28',
          beats: ['核心身份被揭穿', '大规模打脸', '旧敌新仇交织']
        },
        {
          act: 4,
          name: '巅峰对决',
          episodes: '29-40',
          beats: ['终极BOSS现身', '生死危机', '绝地反击', '大团圆/开放式结局']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：身份相关悬念、新威胁出现、或情感冲击'
    }
  },
  {
    id: 'builtin-ceo',
    name: '女帝权谋流',
    category: '女频/权谋',
    description: '后宫争斗→权谋上位→朝堂博弈→一统天下。大女主爽剧，智商全程在线。',
    structure: {
      acts: [
        {
          act: 1,
          name: '入宫求生',
          episodes: '1-8',
          beats: ['被迫入宫', '初遇危机', '暗中结盟']
        },
        {
          act: 2,
          name: '后宫争锋',
          episodes: '9-18',
          beats: ['首次反击', '收服心腹', '揭露阴谋']
        },
        {
          act: 3,
          name: '权倾朝野',
          episodes: '19-28',
          beats: ['干政立功', '扳倒权臣', '皇帝忌惮']
        },
        {
          act: 4,
          name: '天下归心',
          episodes: '29-40',
          beats: ['朝堂大清洗', '边疆危机', '力挽狂澜', '登基称帝']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：权谋反转、危机升级、或盟友背叛'
    }
  },
  {
    id: 'builtin-revenge',
    name: '重生复仇流',
    category: '女频/复仇',
    description: '前世记忆→提前布局→打脸仇人→新的前世谜团。强情绪驱动。',
    structure: {
      acts: [
        {
          act: 1,
          name: '含恨重生',
          episodes: '1-8',
          beats: ['前世惨死', '重生归来', '确认时间节点']
        },
        {
          act: 2,
          name: '步步为营',
          episodes: '9-18',
          beats: ['改变第一个命运节点', '小仇人得到报应', '引出幕后黑手']
        },
        {
          act: 3,
          name: '正面交锋',
          episodes: '19-28',
          beats: ['与前世仇人正面对决', '揭露前世真相', '发现更大阴谋']
        },
        {
          act: 4,
          name: '涅槃新生',
          episodes: '29-40',
          beats: ['最终复仇', '解开前世谜团', '收获真爱/事业']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：复仇进度悬念、新仇人现身、或前世秘密片段'
    }
  },
  {
    id: 'builtin-suspense',
    name: '悬疑惊悚流',
    category: '悬疑/惊悚',
    description: '每3集一个单元小高潮，层层反转。信息差驱动观众追看。',
    structure: {
      acts: [
        {
          act: 1,
          name: '谜团初现',
          episodes: '1-8',
          beats: ['离奇事件', '主角卷入', '第一个嫌疑人']
        },
        {
          act: 2,
          name: '迷雾重重',
          episodes: '9-18',
          beats: ['嫌疑人反转', '新线索出现', '主角遇险']
        },
        {
          act: 3,
          name: '真相逼近',
          episodes: '19-28',
          beats: ['核心秘密浮出水面', '内鬼现身', '时间紧迫']
        },
        {
          act: 4,
          name: '终极揭秘',
          episodes: '29-40',
          beats: ['最后反转', '真凶身份', '代价与救赎']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：新线索、嫌疑人反转、或主角生命威胁'
    }
  },
  {
    id: 'builtin-marriage',
    name: '先婚后爱流',
    category: '女频/婚恋',
    description: '被迫结婚→互相嫌弃→日久生情→外部阻力→坚定选择。经典女频套路。',
    structure: {
      acts: [
        {
          act: 1,
          name: '被迫捆绑',
          episodes: '1-8',
          beats: ['家族联姻', '约法三章', '互相看不顺眼']
        },
        {
          act: 2,
          name: '暗生情愫',
          episodes: '9-18',
          beats: ['同居细节心动', '一方先动情', '误会吃醋']
        },
        {
          act: 3,
          name: '外部阻力',
          episodes: '19-28',
          beats: ['家族反对', '前任回归', '事业危机二选一']
        },
        { act: 4, name: '坚定选择', episodes: '29-40', beats: ['共同对抗', '真情告白', '圆满结局'] }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：心动瞬间、误会加深、或外部阻力加码'
    }
  },
  {
    id: 'builtin-transmigrate',
    name: '穿越打脸流',
    category: '女频/穿越',
    description: '现代人穿越古代/异世界→利用现代知识降维打击→收服各方势力→改变历史。爽点密集。',
    structure: {
      acts: [
        {
          act: 1,
          name: '穿越觉醒',
          episodes: '1-8',
          beats: ['意外穿越', '身份危机', '首次用现代知识化解困境']
        },
        {
          act: 2,
          name: '崭露头角',
          episodes: '9-18',
          beats: ['诗词/医术/商业才华震惊众人', '引起权贵注意', '小人嫉妒陷害']
        },
        {
          act: 3,
          name: '权谋博弈',
          episodes: '19-28',
          beats: ['卷入朝堂/家族斗争', '与皇子/王爷结盟', '身份秘密被怀疑']
        },
        {
          act: 4,
          name: '凤临天下',
          episodes: '29-40',
          beats: ['终极对手现身', '生死存亡之战', '现代知识终极应用', '改变时代']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：身份暴露危机、新敌人出现、或现代知识即将揭晓'
    }
  },
  {
    id: 'builtin-mother',
    name: '萌宝助攻流',
    category: '女频/萌宝',
    description: '带球跑→天才萌宝→父子/母女相认→父母爱情重修。萌点+爽点双驱动。',
    structure: {
      acts: [
        {
          act: 1,
          name: '带球远走',
          episodes: '1-8',
          beats: ['意外怀孕', '被迫离开', '独自生下天才宝宝']
        },
        {
          act: 2,
          name: '萌宝出山',
          episodes: '9-18',
          beats: ['宝宝展现超高智商', '偶遇亲生父亲', '宝宝暗中撮合父母']
        },
        {
          act: 3,
          name: '父母纠葛',
          episodes: '19-28',
          beats: ['父亲发现真相', '母亲心结难解', '情敌/家族阻挠']
        },
        {
          act: 4,
          name: '圆满一家',
          episodes: '29-40',
          beats: ['父亲真心追妻', '宝宝神助攻', '化解所有阻碍', '幸福团圆']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：宝宝神操作、父亲即将发现真相、或母亲面临抉择'
    }
  },
  {
    id: 'builtin-martial',
    name: '废材修仙流',
    category: '男频/玄幻',
    description: '废材开局→获得奇遇→逆袭修炼→打脸天才→登顶巅峰。经典男频玄幻套路。',
    structure: {
      acts: [
        {
          act: 1,
          name: '废材觉醒',
          episodes: '1-8',
          beats: ['天生废材被欺辱', '意外获得传承/宝物', '初次展现潜力']
        },
        {
          act: 2,
          name: '崛起之路',
          episodes: '9-18',
          beats: ['修炼突破', '击败昔日仇敌', '引起宗门注意']
        },
        {
          act: 3,
          name: '宗门风云',
          episodes: '19-28',
          beats: ['宗门大比夺冠', '揭露阴谋', '获得上古传承']
        },
        {
          act: 4,
          name: '武道巅峰',
          episodes: '29-40',
          beats: ['终极BOSS现身', '生死大战', '突破极限', '登顶巅峰']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：突破在即、强敌来袭、或传承秘密即将揭晓'
    }
  },
  {
    id: 'builtin-business',
    name: '商战逆袭流',
    category: '男频/商战',
    description: '破产/被背叛→东山再起→商业布局→吞并对手→建立商业帝国。智商在线的爽文。',
    structure: {
      acts: [
        {
          act: 1,
          name: '跌入谷底',
          episodes: '1-8',
          beats: ['被合伙人背叛', '破产负债', '众叛亲离']
        },
        {
          act: 2,
          name: '东山再起',
          episodes: '9-18',
          beats: ['发现新商机', '组建核心团队', '首个项目成功']
        },
        {
          act: 3,
          name: '商战博弈',
          episodes: '19-28',
          beats: ['与旧敌正面交锋', '资本运作', '揭露当年背叛真相']
        },
        {
          act: 4,
          name: '帝国崛起',
          episodes: '29-40',
          beats: ['终极商业对决', '收购对手公司', '建立商业帝国', '复仇成功']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：商业机密泄露、对手反扑、或关键决策点'
    }
  },
  {
    id: 'builtin-medical',
    name: '神医归来流',
    category: '男频/都市',
    description: '隐世神医→下山入世→救人与打脸并行→揭开身世之谜。医术+武力双开挂。',
    structure: {
      acts: [
        {
          act: 1,
          name: '神医下山',
          episodes: '1-8',
          beats: ['奉师命下山', '初显医术震惊众人', '卷入豪门纷争']
        },
        {
          act: 2,
          name: '医名远扬',
          episodes: '9-18',
          beats: ['治愈疑难杂症', '权贵争相结交', '医界同行嫉妒打压']
        },
        {
          act: 3,
          name: '身世之谜',
          episodes: '19-28',
          beats: ['身世线索浮现', '仇家现身', '医术与武力双重考验']
        },
        {
          act: 4,
          name: '医武双绝',
          episodes: '29-40',
          beats: ['身世真相大白', '终极复仇', '建立医武门派', '天下归心']
        }
      ],
      paywallEpisodes: [10, 20, 30],
      hookPattern: '每集结尾必须是：病人危在旦夕、身世线索出现、或强敌来袭'
    }
  }
]

export async function templateRoutes(fastify: FastifyInstance) {
  // List all templates (builtin + user custom)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async () => {
    const userTemplates = await prisma.dramaTemplate.findMany({
      where: { isBuiltin: false },
      orderBy: { createdAt: 'desc' }
    })

    return {
      builtin: BUILTIN_TEMPLATES,
      custom: userTemplates
    }
  })

  // Get single template
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
      if (builtin) return builtin

      const custom = await prisma.dramaTemplate.findUnique({ where: { id } })
      if (!custom) return reply.status(404).send({ error: 'Template not found' })
      return custom
    }
  )

  // Generate outline from template
  fastify.post<{
    Params: { id: string }
    Body: {
      projectId: string
      protagonistName?: string
      protagonistIdentity?: string
      coreConflict?: string
      targetAudience?: string
      targetEpisodes?: number
    }
  }>('/:id/generate-outline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = getRequestUser(request)
    const { id } = request.params
    const {
      projectId,
      protagonistName = '主角',
      protagonistIdentity = '普通人',
      coreConflict = '身份冲突',
      targetAudience = '下沉市场',
      targetEpisodes = 40
    } = request.body

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id }
    })
    if (!project) {
      return reply.status(404).send({ error: '项目不存在' })
    }

    const template = BUILTIN_TEMPLATES.find((t) => t.id === id)
    if (!template) {
      return reply.status(404).send({ error: '模板不存在' })
    }

    try {
      const episodes = await generateOutline({
        templateName: template.name,
        templateStructure: template.structure,
        paywallEpisodes: template.structure.paywallEpisodes,
        protagonistName,
        protagonistIdentity,
        coreConflict,
        targetAudience,
        targetEpisodes,
        userId: user.id,
        projectId
      })

      // Save outline to project
      await prisma.projectOutline.upsert({
        where: { projectId },
        update: {
          templateId: id,
          episodes: episodes as unknown[] as never
        },
        create: {
          projectId,
          templateId: id,
          episodes: episodes as unknown[] as never
        }
      })

      // Update project status
      await prisma.project.update({
        where: { id: projectId },
        data: {
          templateId: id,
          targetEpisodes,
          status: 'outlining'
        }
      })

      // Create or update episode stubs
      const existingEpisodes = await prisma.episode.findMany({
        where: { projectId },
        select: { episodeNum: true }
      })
      const existingNums = new Set(existingEpisodes.map((e) => e.episodeNum))

      for (const ep of episodes) {
        const data = {
          title: ep.title,
          synopsis: ep.synopsis,
          hook: ep.hook,
          cliffhanger: ep.cliffhanger,
          isPaywall: ep.isPaywall || false
        }

        if (!existingNums.has(ep.episodeNum)) {
          await prisma.episode.create({
            data: {
              projectId,
              episodeNum: ep.episodeNum,
              ...data
            }
          })
        } else {
          await prisma.episode.updateMany({
            where: { projectId, episodeNum: ep.episodeNum },
            data
          })
        }
      }

      return {
        outline: episodes,
        template: template.name
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({ error: `生成大纲失败：${message}` })
    }
  })
}
