export interface DeepSeekBalance {
  isAvailable: boolean
  balanceInfos: Array<{
    currency: string
    totalBalance: number
    grantedBalance: number
    toppedUpBalance: number
  }>
}

export async function getDeepSeekBalance(apiKey?: string): Promise<DeepSeekBalance> {
  const key = apiKey ?? process.env.DEEPSEEK_API_KEY
  if (!key) {
    throw new Error('DEEPSEEK_API_KEY is not configured')
  }
  const response = await fetch('https://api.deepseek.com/user/balance', {
    headers: {
      Authorization: `Bearer ${key}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to get DeepSeek balance: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    isAvailable: data.is_available,
    balanceInfos: ((data.balance_infos || []) as Record<string, string>[]).map((info) => ({
      currency: info.currency,
      totalBalance: parseFloat(info.total_balance),
      grantedBalance: parseFloat(info.granted_balance),
      toppedUpBalance: parseFloat(info.topped_up_balance)
    }))
  }
}
