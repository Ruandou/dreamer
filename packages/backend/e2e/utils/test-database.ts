import { PrismaClient } from '@prisma/client'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const TEST_DATABASE_URL_BASE = process.env.DATABASE_URL?.replace(/\?.*$/, '').replace(
  /\/[^/]*$/,
  ''
)

export class TestDatabase {
  private dbName: string
  private prisma: PrismaClient | null = null

  constructor() {
    this.dbName = `e2e_test_${randomUUID().replace(/-/g, '_')}`
  }

  get url(): string {
    return `${TEST_DATABASE_URL_BASE}/${this.dbName}?schema=public`
  }

  async create(): Promise<void> {
    if (!TEST_DATABASE_URL_BASE) {
      throw new Error('DATABASE_URL not set in environment')
    }
    // Create test database
    execSync(`psql ${TEST_DATABASE_URL_BASE} -c "CREATE DATABASE \\"${this.dbName}\\";"`, {
      stdio: 'ignore'
    })
  }

  async migrate(): Promise<void> {
    // Run Prisma migrate deploy on test database
    execSync('prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: this.url },
      cwd: '/Users/leifu/Learn/dreamer/packages/backend',
      stdio: 'ignore'
    })
  }

  getClient(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: { db: { url: this.url } }
      })
    }
    return this.prisma
  }

  async teardown(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect()
      this.prisma = null
    }
    // Drop test database
    execSync(
      `psql ${TEST_DATABASE_URL_BASE} -c "DROP DATABASE IF EXISTS \\"${this.dbName}\\" WITH (FORCE);"`,
      { stdio: 'ignore' }
    )
  }
}
