/**
 * 必须在其它业务模块之前加载：ESM 会优先解析全部 static import，
 * 若仅在 index 里先 config 再 import 路由，路由链里的 image-generation 等会在 dotenv 之前执行，导致 ARK_* 等读不到。
 */
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// packages/backend/src -> 仓库根目录 .env
config({ path: join(here, '..', '..', '..', '.env') })
