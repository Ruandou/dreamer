export interface DeepSeekBalance {
  isAvailable: boolean
  balanceInfos: Array<{
    currency: string
    totalBalance: number
    grantedBalance: number
    toppedUpBalance: number
  }>
}

export async function getDeepSeekBalance(): Promise<DeepSeekBalance> {
  const response = await fetch('https://api.deepseek.com/user/balance', {
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
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
