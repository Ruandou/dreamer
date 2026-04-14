import bcrypt from 'bcrypt'
import { UserRepository, userRepository } from '../repositories/user-repository.js'

export type SafeUser = {
  id: string
  email: string
  name: string
  createdAt: Date
}

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(
    email: string,
    password: string,
    name: string
  ): Promise<{ ok: true; user: SafeUser } | { ok: false; reason: 'exists' }> {
    const existing = await this.users.findByEmail(email)
    if (existing) {
      return { ok: false, reason: 'exists' }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await this.users.create({
      email,
      password: hashedPassword,
      name
    })

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<{ ok: true; user: SafeUser } | { ok: false; reason: 'invalid' }> {
    const user = await this.users.findByEmail(email)
    if (!user) {
      return { ok: false, reason: 'invalid' }
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return { ok: false, reason: 'invalid' }
    }

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    }
  }

  getMe(userId: string) {
    return this.users.findByIdPublic(userId)
  }
}

export const authService = new AuthService(userRepository)
