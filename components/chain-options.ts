export const COMMON_CHAIN_OPTIONS = [
  { value: 'allchains', label: 'All supported EVM chains' },
  { value: 'eth-mainnet', label: 'Ethereum' },
  { value: 'base-mainnet', label: 'Base' },
  { value: 'bsc-mainnet', label: 'BNB Chain' },
  { value: 'matic-mainnet', label: 'Polygon' },
  { value: 'optimism-mainnet', label: 'Optimism' },
  { value: 'arbitrum-mainnet', label: 'Arbitrum' },
  { value: 'avalanche-mainnet', label: 'Avalanche' },
] as const

export function getChainLabel(chainValue: string | null | undefined) {
  if (!chainValue || chainValue === 'allchains') return 'All supported EVM chains'
  return COMMON_CHAIN_OPTIONS.find((chain) => chain.value === chainValue)?.label ?? chainValue
}
