/**
 * Kling API JWT Token Generator
 * Uses AK/SK (Access Key / Secret Key) authentication
 * Docs: https://www.klingai.com/
 */

import { createHmac } from 'crypto'

export interface KlingCredentials {
  accessKey: string
  secretKey: string
}

/**
 * Generate JWT token for Kling API authentication
 * Header: { "alg": "HS256", "typ": "JWT" }
 * Payload: { "iss": accessKey, "exp": now + 1800 }
 * Signature: HMACSHA256(base64url(header) + "." + base64url(payload), secretKey)
 */
export function generateKlingToken(credentials: KlingCredentials): string {
  const { accessKey, secretKey } = credentials

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 1800 // 30 minutes expiry

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const payload = {
    iss: accessKey,
    exp,
    nbf: now - 5 // not before: 5 seconds ago
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const signature = createHmac('sha256', secretKey).update(signingInput).digest('base64url')

  return `${signingInput}.${signature}`
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url')
}
