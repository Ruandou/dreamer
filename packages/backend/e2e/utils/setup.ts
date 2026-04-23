import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// e2e/utils -> backend -> repo root
config({ path: join(here, '..', '..', '..', '..', '.env') })
