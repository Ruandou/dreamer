/**
 * Format a number as Chinese Yuan (¥) currency.
 * @param amount - The numeric amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "¥12.34"
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return `¥${amount.toFixed(decimals)}`
}

/**
 * Format cost with conditional display — shows "—" for null/undefined.
 * @param cost - The cost value (may be null/undefined)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency or placeholder
 */
export function formatCostOrNull(cost: number | null | undefined, decimals: number = 2): string {
  return cost != null ? formatCurrency(cost, decimals) : '—'
}
