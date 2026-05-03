'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Check, Copy, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WalletIcon, getHiddenAssets, getSavedWalletIcon, isWalletIconType, setHiddenAssets } from '@/components/wallet-icons'
import { PortfolioPie } from '@/components/portfolio-pie-crypto'
import { StatCard } from '@/components/stat-card'
import { ValueChart } from '@/components/value-chart'
import { cn } from '@/lib/utils'

type WalletHolding = {
  holding_id?: string
  symbol: string
  name: string
  balance: string
  formattedBalance?: string
  quote: number
  quoteRate: number
  chainName?: string | null
  chainDisplayName?: string | null
  logoUrl?: string | null
  contractAddress?: string | null
  isNativeToken?: boolean
}

type WalletHistoryRow = {
  snapshot_date: string
  total_value: number
  quote_currency?: string
}

type AssetHistoryRowsMap = Record<string, WalletHistoryRow[]>

type ChartPoint = {
  timestamp: number
  value: number
}

type WalletHistoryDbRow = {
  snapshot_date: string
  total_value: number
  quote_currency?: string | null
}

type AssetHistoryDbRow = {
  asset_key: string
  snapshot_date: string
  total_value: number
  quote_currency?: string | null
}

type CryptoWalletDetailProps = {
  walletId: string
  onBack: () => void
  onDeleted?: () => void
}

type WalletDetail = {
  id: string
  wallet_name: string
  wallet_address: string
  icon_type?: string | null
  selected_chain: string
  quote_currency: string
  last_total_value: number
  item_count: number
  last_synced_at?: string | null
  updated_at?: string | null
  full_holdings?: WalletHolding[]
  holdings_preview?: WalletHolding[]
}

type ManualAdjustment = {
  fiatDelta: number
  cryptoDelta: number
}

type ManualAdjustmentsMap = Record<string, ManualAdjustment>

const WALLET_CACHE_TTL_MS = 5 * 60 * 1000
const walletDetailCache = new Map<string, { wallet: WalletDetail; cachedAt: number }>()
const MANUAL_ADJUSTMENTS_STORAGE_KEY = 'wallet-manual-adjustments-v1'

function getCachedWalletDetail(walletId: string) {
  const cached = walletDetailCache.get(walletId)
  if (!cached) return null
  if (Date.now() - cached.cachedAt > WALLET_CACHE_TTL_MS) {
    walletDetailCache.delete(walletId)
    return null
  }
  return cached.wallet
}

function setCachedWalletDetail(walletId: string, wallet: WalletDetail) {
  walletDetailCache.set(walletId, { wallet, cachedAt: Date.now() })
}

function getManualAdjustments(walletId: string): ManualAdjustmentsMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(MANUAL_ADJUSTMENTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ManualAdjustmentsMap>
    return parsed[walletId] ?? {}
  } catch {
    return {}
  }
}

function saveManualAdjustments(walletId: string, adjustments: ManualAdjustmentsMap) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(MANUAL_ADJUSTMENTS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, ManualAdjustmentsMap>) : {}
    parsed[walletId] = adjustments
    window.localStorage.setItem(MANUAL_ADJUSTMENTS_STORAGE_KEY, JSON.stringify(parsed))
  } catch {}
}

function normalizeHistoryRows(rows: unknown, quoteCurrency?: string): WalletHistoryRow[] {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row: any) => ({
      snapshot_date: String(row?.snapshot_date ?? '').slice(0, 10),
      total_value: Number(row?.total_value ?? 0),
      quote_currency: row?.quote_currency ?? quoteCurrency,
    }))
    .filter((row) => row.snapshot_date && Number.isFinite(row.total_value))
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
}

function normalizeAssetHistoryRows(rows: unknown, quoteCurrency?: string): AssetHistoryRowsMap {
  if (!Array.isArray(rows)) return {}

  const rowsByAsset: AssetHistoryRowsMap = {}
  for (const row of rows as Array<AssetHistoryDbRow>) {
    if (!row?.asset_key || !row?.snapshot_date) continue
    const normalizedRow: WalletHistoryRow = {
      snapshot_date: String(row.snapshot_date).slice(0, 10),
      total_value: Number(row.total_value ?? 0),
      quote_currency: row.quote_currency ?? quoteCurrency,
    }

    if (!Number.isFinite(normalizedRow.total_value) || !normalizedRow.snapshot_date) continue
    if (!rowsByAsset[row.asset_key]) rowsByAsset[row.asset_key] = []
    rowsByAsset[row.asset_key].push(normalizedRow)
  }

  for (const key of Object.keys(rowsByAsset)) {
    rowsByAsset[key] = rowsByAsset[key].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  }

  return rowsByAsset
}

function daysBetween(a: string, b: Date) {
  const parsed = new Date(`${a}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return 0
  return Math.floor((b.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000))
}

function clearLegacyHistoryStorage() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem('wallet-history-cache-v1')
    window.localStorage.removeItem('wallet-asset-history-cache-v1')
  } catch {}
}

export function CryptoWalletDetail({ walletId, onBack, onDeleted }: CryptoWalletDetailProps) {
  const { getToken } = useAuth()
  const [wallet, setWallet] = useState<WalletDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyRows, setHistoryRows] = useState<WalletHistoryRow[]>([])
  const [assetHistoryRows, setAssetHistoryRows] = useState<AssetHistoryRowsMap>({})
  const [hiddenAssetKeys, setHiddenAssetKeysState] = useState<string[]>([])
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null)
  const [manualAdjustments, setManualAdjustments] = useState<ManualAdjustmentsMap>({})
  const [manualDialogAsset, setManualDialogAsset] = useState<WalletHolding | null>(null)
  const [manualMode, setManualMode] = useState<'fiat' | 'crypto'>('fiat')
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  async function loadWallet(options?: { silent?: boolean; force?: boolean }) {
    const silent = options?.silent === true
    const force = options?.force === true

    try {
      if (!force) {
        const cachedWallet = getCachedWalletDetail(walletId)
        if (cachedWallet) {
          setWallet(cachedWallet)
          setError(null)
          setLoading(false)
          setRefreshing(false)
          return
        }
      }

      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
      }

      const token = await getToken({ template: 'supabase' })
      if (!token) {
        throw new Error('Could not obtain auth token from Clerk.')
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/crypto-wallets?walletId=${encodeURIComponent(walletId)}&refresh=${force ? 'true' : 'false'}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Could not fetch wallet details.')
      }

      const fetchedWallet = (payload.wallet ?? null) as WalletDetail | null
      setWallet(fetchedWallet)
      if (fetchedWallet) {
        setCachedWalletDetail(walletId, fetchedWallet)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch wallet details.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function readHistoryFromSupabase(quoteCurrency?: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
    }

    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseAnonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.')
    }

    const token = await getToken({ template: 'supabase' })
    if (!token) {
      throw new Error('Could not obtain auth token from Clerk.')
    }

    const quoteCurrencyFilter = quoteCurrency
      ? `&quote_currency=eq.${encodeURIComponent(quoteCurrency.trim().toUpperCase())}`
      : ''

    const response = await fetch(
      `${supabaseUrl}/rest/v1/crypto_wallet_history?wallet_id=eq.${encodeURIComponent(walletId)}${quoteCurrencyFilter}&select=snapshot_date,total_value,quote_currency&order=snapshot_date.asc`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
      },
    )

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const rows = await response.json()
    return normalizeHistoryRows(rows, quoteCurrency)
  }

  async function readAssetHistoryFromSupabase(quoteCurrency?: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
    }

    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseAnonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.')
    }

    const token = await getToken({ template: 'supabase' })
    if (!token) {
      throw new Error('Could not obtain auth token from Clerk.')
    }

    const quoteCurrencyFilter = quoteCurrency
      ? `&quote_currency=eq.${encodeURIComponent(quoteCurrency.trim().toUpperCase())}`
      : ''

    const response = await fetch(
      `${supabaseUrl}/rest/v1/crypto_wallet_asset_history?wallet_id=eq.${encodeURIComponent(walletId)}${quoteCurrencyFilter}&select=asset_key,snapshot_date,total_value,quote_currency&order=asset_key.asc,snapshot_date.asc`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
      },
    )

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const rows = await response.json()
    return normalizeAssetHistoryRows(rows, quoteCurrency)
  }

  async function triggerHistorySync(payload: { walletId: string; days: number }) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
    }

    const token = await getToken({ template: 'supabase' })
    if (!token) {
      throw new Error('Could not obtain auth token from Clerk.')
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/crypto-wallet-history`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error ?? 'Could not sync wallet history.')
    }

    return result
  }

  async function ensureWalletHistory() {
    const quoteCurrency = wallet?.quote_currency?.trim().toUpperCase()
    if (!quoteCurrency) return

    try {
      setHistoryLoading(true)
      setHistoryError(null)

      let rows = await readHistoryFromSupabase(quoteCurrency)
      let assetRows = await readAssetHistoryFromSupabase(quoteCurrency)

      const lastSyncDate = rows.length > 0 ? rows[rows.length - 1]?.snapshot_date : null
      const daysSinceLastSync = lastSyncDate ? daysBetween(lastSyncDate, new Date()) : 0

      if (rows.length === 0 || daysSinceLastSync > 0) {
        const daysToFetch = rows.length === 0 ? 30 : Math.min(daysSinceLastSync, 30)

        if (daysToFetch > 0) {
          await triggerHistorySync({ walletId, days: daysToFetch })
          rows = await readHistoryFromSupabase(quoteCurrency)
          assetRows = await readAssetHistoryFromSupabase(quoteCurrency)
        }
      }

      setHistoryRows(rows)
      setAssetHistoryRows(assetRows)
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Could not load wallet history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function refreshWalletAndHistory() {
    await loadWallet({ silent: true, force: true })
    try {
      setHistoryLoading(true)
      setHistoryError(null)

      const quoteCurrency = wallet?.quote_currency?.trim().toUpperCase()
      await triggerHistorySync({ walletId, days: 30 })
      const rows = await readHistoryFromSupabase(quoteCurrency)
      const assetRows = await readAssetHistoryFromSupabase(quoteCurrency)

      setHistoryRows(rows)
      setAssetHistoryRows(assetRows)
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Could not refresh wallet history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    setWallet(null)
    setHistoryRows([])
    setAssetHistoryRows({})
    setSelectedHoldingKey(null)
    void loadWallet()
  }, [walletId])

  useEffect(() => {
    clearLegacyHistoryStorage()
  }, [])

  useEffect(() => {
    setHiddenAssetKeysState(getHiddenAssets(walletId))
  }, [walletId])

  useEffect(() => {
    setManualAdjustments(getManualAdjustments(walletId))
  }, [walletId])

  useEffect(() => {
    void ensureWalletHistory()
  }, [walletId, wallet?.quote_currency])

  const walletIcon = useMemo(() => {
    const serverIcon = wallet?.icon_type
    if (isWalletIconType(serverIcon)) {
      return serverIcon
    }
    return getSavedWalletIcon(walletId) ?? 'metamask'
  }, [wallet?.icon_type, walletId])

  const rawHoldings = useMemo(() => {
    return wallet?.full_holdings?.length ? wallet.full_holdings : wallet?.holdings_preview ?? []
  }, [wallet])

  const adjustedHoldings = useMemo(() => {
    return rawHoldings.map((asset) => {
      const key = assetStorageKey(asset)
      const adjustment = manualAdjustments[key]
      if (!adjustment) return asset

      const baseBalance = Number(asset.balance ?? 0)
      const safeBalance = Number.isFinite(baseBalance) ? baseBalance : 0
      const unitPriceFromQuoteRate = Number(asset.quoteRate ?? 0)
      const unitPriceFromQuote = safeBalance > 0 ? Number(asset.quote ?? 0) / safeBalance : 0
      const unitPrice = unitPriceFromQuoteRate > 0 ? unitPriceFromQuoteRate : unitPriceFromQuote

      const nextBalance = Math.max(0, safeBalance + adjustment.cryptoDelta)
      const nextQuote = Math.max(0, Number(asset.quote ?? 0) + adjustment.fiatDelta + adjustment.cryptoDelta * unitPrice)

      return {
        ...asset,
        balance: nextBalance.toString(),
        quote: nextQuote,
      }
    })
  }, [rawHoldings, manualAdjustments])

  const visibleHoldings = useMemo(() => {
    return adjustedHoldings.filter((asset) => !hiddenAssetKeys.includes(assetStorageKey(asset)))
  }, [adjustedHoldings, hiddenAssetKeys])

  const hiddenHoldings = useMemo(() => {
    return adjustedHoldings.filter((asset) => hiddenAssetKeys.includes(assetStorageKey(asset)))
  }, [adjustedHoldings, hiddenAssetKeys])

  function hideAsset(asset: WalletHolding) {
    const next = Array.from(new Set([...hiddenAssetKeys, assetStorageKey(asset)]))
    setHiddenAssetKeysState(next)
    setHiddenAssets(walletId, next)
  }

  function restoreHiddenAssets() {
    setHiddenAssetKeysState([])
    setHiddenAssets(walletId, [])
  }

  function openManualDialog(asset: WalletHolding) {
    setManualDialogAsset(asset)
    setManualMode('fiat')
    setManualValue('')
    setManualError(null)
  }

  function closeManualDialog() {
    setManualDialogAsset(null)
    setManualError(null)
    setManualValue('')
  }

  function submitManualAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!manualDialogAsset) return

    const numericValue = Number(manualValue)
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setManualError('Enter a valid value greater than 0.')
      return
    }

    const assetKey = assetStorageKey(manualDialogAsset)
    const current = manualAdjustments[assetKey] ?? { fiatDelta: 0, cryptoDelta: 0 }
    const next: ManualAdjustment =
      manualMode === 'fiat'
        ? { ...current, fiatDelta: current.fiatDelta + numericValue }
        : { ...current, cryptoDelta: current.cryptoDelta + numericValue }

    const nextMap: ManualAdjustmentsMap = {
      ...manualAdjustments,
      [assetKey]: next,
    }

    setManualAdjustments(nextMap)
    saveManualAdjustments(walletId, nextMap)
    closeManualDialog()
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet?.wallet_address ?? '')
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 1500)
    } catch {
      setCopiedAddress(false)
    }
  }

  async function deleteWallet() {
    if (!wallet) return
    const confirmed = window.confirm(`Delete wallet "${wallet.wallet_name}"?`)
    if (!confirmed) return

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
      }

      const token = await getToken({ template: 'supabase' })
      if (!token) {
        throw new Error('Could not obtain auth token from Clerk.')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/crypto-wallets`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletId }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Could not delete wallet.')
      }

      onDeleted?.()
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete wallet.')
    }
  }

  const pieData = useMemo(() => {
    const colorPalette = [
      'oklch(0.72 0.19 45)',
      'oklch(0.68 0.19 75)',
      'oklch(0.75 0.18 20)',
      'oklch(0.62 0.15 220)',
      'oklch(0.70 0.12 170)',
      'oklch(0.77 0.11 300)',
    ]

    const bySymbol = new Map<string, number>()
    for (const asset of visibleHoldings) {
      const symbol = (asset.symbol || 'Unknown').toUpperCase()
      const value = Number(asset.quote ?? 0)
      if (value <= 0) continue
      bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + value)
    }

    const sorted = Array.from(bySymbol.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const TOP_COUNT = 5
    const top = sorted.slice(0, TOP_COUNT)
    const otherValue = sorted.slice(TOP_COUNT).reduce((sum, item) => sum + item.value, 0)

    const result = top.map((item, index) => ({
      name: item.name,
      value: item.value,
      color: colorPalette[index % colorPalette.length],
    }))

    if (otherValue > 0) {
      result.push({
        name: 'Other',
        value: otherValue,
        color: 'oklch(0.58 0.02 260)',
      })
    }

    return result
  }, [visibleHoldings])

  const totalValue = useMemo(() => {
    return visibleHoldings.reduce((sum, asset) => sum + Number(asset.quote ?? 0), 0)
  }, [visibleHoldings])

  const topHoldings = useMemo(() => {
    return [...visibleHoldings]
      .sort((a, b) => Number(b.quote ?? 0) - Number(a.quote ?? 0))
      .slice(0, 2)
  }, [visibleHoldings])

  const currencySymbol = useMemo(() => {
    return getCurrencySymbol(wallet?.quote_currency)
  }, [wallet?.quote_currency])

  const filteredHistoryRows = useMemo(() => {
    if (!hiddenHoldings.length || historyRows.length === 0) return historyRows

    const hiddenValueByDate = new Map<string, number>()
    for (const hiddenAsset of hiddenHoldings) {
      const rows = getAssetHistoryForAsset(assetHistoryRows, hiddenAsset)
      for (const row of rows) {
        hiddenValueByDate.set(
          row.snapshot_date,
          (hiddenValueByDate.get(row.snapshot_date) ?? 0) + Number(row.total_value ?? 0),
        )
      }
    }

    if (hiddenValueByDate.size === 0) return historyRows

    return historyRows.map((row) => ({
      ...row,
      total_value: Math.max(0, Number(row.total_value ?? 0) - (hiddenValueByDate.get(row.snapshot_date) ?? 0)),
    }))
  }, [historyRows, hiddenHoldings, assetHistoryRows])

  const chartSeries = useMemo(() => {
    const historyPoints: ChartPoint[] = filteredHistoryRows
      .map((row) => ({
        timestamp: new Date(`${row.snapshot_date}T00:00:00Z`).getTime(),
        value: Number(row.total_value ?? 0),
      }))
      .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
      .sort((a, b) => a.timestamp - b.timestamp)

    if (historyPoints.length > 0) {
      return [
        {
          id: 'portfolio',
          name: hiddenAssetKeys.length > 0 ? 'Visible Crypto' : 'Total Crypto',
          color: 'oklch(0.72 0.19 45)',
          data: historyPoints,
        },
      ]
    }

    const nowTs = wallet?.last_synced_at ? new Date(wallet.last_synced_at).getTime() : Date.now()
    const baseTs = nowTs - 30 * 24 * 60 * 60 * 1000
    const current = Number(totalValue)
    return [
      {
        id: 'portfolio',
        name: hiddenAssetKeys.length > 0 ? 'Visible Crypto' : 'Total Crypto',
        color: 'oklch(0.72 0.19 45)',
        data: [
          { timestamp: baseTs, value: current },
          { timestamp: nowTs, value: current },
        ],
      },
    ]
  }, [filteredHistoryRows, hiddenAssetKeys.length, wallet?.last_synced_at, totalValue])

  const latestHistoryValue = useMemo(() => {
    if (!filteredHistoryRows.length) return null
    return Number(filteredHistoryRows[filteredHistoryRows.length - 1]?.total_value ?? 0)
  }, [filteredHistoryRows])


  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border border-border bg-[oklch(0.16_0_0)] p-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading wallet details...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          {error}
        </div>
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border border-border bg-[oklch(0.16_0_0)] p-6 text-sm text-muted-foreground">
          Wallet not found.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[oklch(0.72_0.19_45_/_0.15)]">
            <WalletIcon type={walletIcon} className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground leading-none">{wallet.wallet_name}</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-muted-foreground font-mono break-all">{wallet.wallet_address}</span>
              <button
                onClick={copyAddress}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy address"
                title="Copy address"
              >
                {copiedAddress ? <Check className="w-3 h-3 text-[oklch(0.70_0.16_155)]" /> : <Copy className="w-3 h-3" />}
              </button>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{adjustedHoldings.length} holdings</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hiddenAssetKeys.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 border-border text-muted-foreground bg-transparent"
              onClick={restoreHiddenAssets}
            >
              Restore assets
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-border text-muted-foreground bg-transparent hover:text-foreground"
            onClick={() => void refreshWalletAndHistory()}
            disabled={refreshing || historyLoading}
          >
            {refreshing || historyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-[oklch(0.60_0.20_25)]"
            onClick={() => void deleteWallet()}
            aria-label="Delete wallet"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Crypto Value"
          value={totalValue}
          className="sm:col-span-2 lg:col-span-2"
          accentColor="oklch(0.72 0.19 45)"
          currencySymbol={currencySymbol}
        />
        {topHoldings.map((asset, i) => (
          <StatCard
            key={`${asset.symbol}-${i}`}
            label={`${asset.name || asset.symbol} (${asset.symbol})`}
            value={Number(asset.quote ?? 0)}
            accentColor={assetColor(i)}
            currencySymbol={currencySymbol}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Holdings Distribution</h2>
          <PortfolioPie data={pieData} height={240} currencySymbol={currencySymbol} />
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Portfolio Value History{hiddenAssetKeys.length > 0 ? ' · filtered' : ''}
            </h2>
            {historyLoading ? (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing...
              </span>
            ) : null}
          </div>
          {historyError ? <p className="text-xs text-[oklch(0.60_0.20_25)]">{historyError}</p> : null}
          {!historyError && filteredHistoryRows.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {filteredHistoryRows.length} points loaded. Latest shown value: {currencySymbol}{formatMoney(latestHistoryValue ?? totalValue)}
            </p>
          ) : null}
          <ValueChart series={chartSeries} height={240} currencySymbol={currencySymbol} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Individual Holdings</h2>
        </div>

        {visibleHoldings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {rawHoldings.length === 0
              ? 'No holdings were returned for this wallet yet.'
              : 'All assets are currently hidden from this wallet view.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleHoldings.map((asset, index) => {
              const displayKey = assetDisplayKey(asset)
              const storageKey = assetStorageKey(asset)
              const isSelected = selectedHoldingKey === storageKey
              const assetRows = getAssetHistoryForAsset(assetHistoryRows, asset)
              const assetChartPoints = assetRows.length > 0
                ? chartPointsFromHistoryRows(assetRows)
                : buildFlatAssetChartPoints(asset, wallet.last_synced_at)
              const hasRealAssetHistory = assetRows.length > 0

              return (
                <div key={displayKey} className="flex flex-col gap-0">
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'flex items-center gap-4 w-full rounded-lg px-4 py-3 transition-colors text-left cursor-pointer',
                      isSelected ? 'bg-[oklch(0.22_0_0)]' : 'hover:bg-[oklch(0.20_0_0)]',
                    )}
                    onClick={() => setSelectedHoldingKey(isSelected ? null : storageKey)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedHoldingKey(isSelected ? null : storageKey)
                      }
                    }}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: assetColor(index) }} />
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{getCoinDisplayName(asset)}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{asset.symbol}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                      {asset.formattedBalance ?? formatBalance(asset.balance)} {asset.symbol}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {currencySymbol}{formatMoney(Number(asset.quote ?? 0))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Add manual value"
                      onClick={(event) => {
                        event.stopPropagation()
                        openManualDialog(asset)
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-[oklch(0.60_0.20_25)]"
                      title="Hide asset"
                      onClick={(event) => {
                        event.stopPropagation()
                        hideAsset(asset)
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {isSelected ? (
                    <div className="px-4 pb-3">
                      <div className="rounded-lg border border-border bg-[oklch(0.18_0_0)] p-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {getCoinDisplayName(asset)} value history
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {asset.formattedBalance ?? formatBalance(asset.balance)} {asset.symbol}
                              {hasRealAssetHistory ? ` · ${assetRows.length} points` : ' · current value only'}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-foreground">
                            {currencySymbol}{formatMoney(Number(asset.quote ?? 0))}
                          </span>
                        </div>

                        {!hasRealAssetHistory ? (
                          <p className="mb-2 text-xs text-muted-foreground">
                            Historical GoldRush data for this asset is not loaded yet, so this shows a flat current-value estimate. Use Refresh to reload 30d history.
                          </p>
                        ) : null}

                        <ValueChart
                          series={[
                            {
                              id: 'asset',
                              name: asset.symbol,
                              color: assetColor(index),
                              data: assetChartPoints,
                            },
                          ]}
                          height={180}
                          currencySymbol={currencySymbol}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={manualDialogAsset !== null} onOpenChange={(open) => (!open ? closeManualDialog() : undefined)}>
        <DialogContent className="bg-[oklch(0.16_0_0)] border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Manual Value</DialogTitle>
            <DialogDescription>
              {manualDialogAsset ? `Add to ${getCoinDisplayName(manualDialogAsset)} (${manualDialogAsset.symbol}).` : 'Add manual value.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitManualAdjustment} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={manualMode === 'fiat' ? 'default' : 'outline'}
                className={manualMode === 'fiat' ? 'bg-[oklch(0.72_0.19_45)] text-black hover:bg-[oklch(0.66_0.19_45)]' : 'border-border text-muted-foreground'}
                onClick={() => setManualMode('fiat')}
              >
                {wallet?.quote_currency?.toUpperCase() || 'EUR'}
              </Button>
              <Button
                type="button"
                variant={manualMode === 'crypto' ? 'default' : 'outline'}
                className={manualMode === 'crypto' ? 'bg-[oklch(0.72_0.19_45)] text-black hover:bg-[oklch(0.66_0.19_45)]' : 'border-border text-muted-foreground'}
                onClick={() => setManualMode('crypto')}
              >
                Crypto
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manualValueInput" className="text-xs text-muted-foreground">
                {manualMode === 'fiat'
                  ? `Value (${wallet?.quote_currency?.toUpperCase() || 'EUR'})`
                  : `Amount (${manualDialogAsset?.symbol || 'coin'})`}
              </Label>
              <Input
                id="manualValueInput"
                type="number"
                min="0"
                step="0.000001"
                placeholder="0.00"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                className="bg-[oklch(0.20_0_0)] border-border"
              />
            </div>

            {manualError ? <p className="text-xs text-[oklch(0.60_0.20_25)]">{manualError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeManualDialog}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[oklch(0.72_0.19_45)] text-black hover:bg-[oklch(0.66_0.19_45)]">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function assetStorageKey(asset: WalletHolding) {
  if (asset.holding_id) return asset.holding_id
  return [asset.symbol, asset.contractAddress ?? asset.chainName ?? 'no-contract', asset.name].join('::')
}

function assetDisplayKey(asset: WalletHolding) {
  if (asset.holding_id) return asset.holding_id
  return [asset.symbol, asset.contractAddress ?? asset.chainName ?? 'no-contract', asset.name].join('-')
}

function getAssetHistoryLookupKeys(asset: WalletHolding) {
  const nativeType = asset.isNativeToken ? 'native' : 'token'
  const candidates = [
    assetStorageKey(asset),
    asset.holding_id,
    [asset.chainName ?? '', asset.contractAddress ?? '', asset.symbol ?? asset.name ?? '', nativeType].join('|'),
    [asset.chainName ?? '', asset.contractAddress ?? '', asset.name ?? asset.symbol ?? '', nativeType].join('|'),
    [asset.chainName ?? '', asset.contractAddress ?? '', asset.symbol ?? asset.name ?? '', 'token'].join('|'),
    [asset.chainName ?? '', asset.contractAddress ?? '', asset.name ?? asset.symbol ?? '', 'token'].join('|'),
  ]

  return Array.from(new Set(candidates.filter((key): key is string => Boolean(key))))
}

function getAssetHistoryForAsset(rowsByAsset: AssetHistoryRowsMap, asset: WalletHolding) {
  for (const key of getAssetHistoryLookupKeys(asset)) {
    const rows = rowsByAsset[key]
    if (rows?.length) return rows
  }

  return []
}

function chartPointsFromHistoryRows(rows: WalletHistoryRow[]): ChartPoint[] {
  return rows
    .map((row) => ({
      timestamp: new Date(`${row.snapshot_date}T00:00:00Z`).getTime(),
      value: Number(row.total_value ?? 0),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp)
}

function buildFlatAssetChartPoints(asset: WalletHolding, syncedAt?: string | null): ChartPoint[] {
  const endTs = syncedAt ? new Date(syncedAt).getTime() : Date.now()
  const safeEndTs = Number.isFinite(endTs) ? endTs : Date.now()
  const startTs = safeEndTs - 30 * 24 * 60 * 60 * 1000
  const value = Math.max(0, Number(asset.quote ?? 0))

  return [
    { timestamp: startTs, value },
    { timestamp: safeEndTs, value },
  ]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatBalance(value: string) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return value
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(numeric)
}

function getCurrencySymbol(currencyCode?: string | null) {
  if (!currencyCode) return '$'

  const normalized = currencyCode.trim().toUpperCase()
  const symbolMap: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF',
    JPY: '¥',
    CNY: '¥',
    AUD: 'A$',
    CAD: 'C$',
  }

  return symbolMap[normalized] ?? normalized
}

function getCoinDisplayName(asset: WalletHolding) {
  const symbol = asset.symbol.trim().toUpperCase()

  const nameMap: Record<string, string> = {
    ETH: 'Ethereum',
    BTC: 'Bitcoin',
    BNB: 'BNB',
    USDT: 'Tether',
    USDC: 'USD Coin',
    SOL: 'Solana',
    XRP: 'XRP',
    ADA: 'Cardano',
    DOGE: 'Dogecoin',
    TRX: 'TRON',
    MATIC: 'Polygon',
    AVAX: 'Avalanche',
    DOT: 'Polkadot',
    LINK: 'Chainlink',
    LTC: 'Litecoin',
    BCH: 'Bitcoin Cash',
    DAI: 'Dai',
  }

  if (nameMap[symbol]) return nameMap[symbol]

  const rawName = asset.name.trim()
  if (!rawName) return symbol

  return rawName
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function assetColor(index: number) {
  const colors = [
    'oklch(0.72 0.19 45)',
    'oklch(0.68 0.19 75)',
    'oklch(0.75 0.18 20)',
    'oklch(0.62 0.15 220)',
    'oklch(0.70 0.12 170)',
    'oklch(0.77 0.11 300)',
  ]
  return colors[index % colors.length]
}
