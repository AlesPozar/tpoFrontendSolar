'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { PortfolioPie } from './portfolio-pie'
import { ValueChart } from './value-chart'
import { Trash2 } from 'lucide-react'

declare const process: any

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PORTFOLIO: Portfolio = {
  accountType: 'SPOT',
  canTrade: true,
  currency: 'EUR',
  totalValue: 44723.56,
  balances: [
    { asset: 'BTC',  quantity: '0.52341000', value: 31501.23, price: 60134.20 },
    { asset: 'ETH',  quantity: '4.71500000', value: 8241.35,  price: 1748.12  },
    { asset: 'BNB',  quantity: '12.3400000', value: 2856.00,  price: 231.44   },
    { asset: 'SOL',  quantity: '45.0000000', value: 993.45,   price: 19.87    },
    { asset: 'USDT', quantity: '1240.50000', value: 1148.61,  price: 0.9259   },
    { asset: 'DOGE', quantity: '8420.00000', value: 925.30,   price: 0.1099   },
  ],
}

// Generates 30 days of fake history for mock mode
function generateMockHistory(balances: Balance[], currency: string): HistoryEntry[] {
  const now = Date.now()
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now - (29 - i) * 86400000).toISOString().split('T')[0]
    const factor = 0.85 + Math.random() * 0.3
    return {
      date,
      totalValue: MOCK_PORTFOLIO.totalValue * factor,
      assets: balances.map((b) => ({
        asset: b.asset,
        quantity: b.quantity,
        value: (b.value ?? 0) * factor,
      })),
    }
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Balance {
  asset: string
  quantity: string
  value: number | null
  price: number | null
}

interface Portfolio {
  accountType: string
  canTrade: boolean
  currency: string
  totalValue: number
  balances: Balance[]
}

interface HistoryAsset {
  asset: string
  quantity: string
  value: number | null
}

interface HistoryEntry {
  date: string           // "2024-01-15"
  totalValue: number
  assets: HistoryAsset[]
}

interface History {
  currency: string
  history: HistoryEntry[]
}

// ─── Binance logo ─────────────────────────────────────────────────────────────

function BinanceLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Binance">
      <path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7175 2.7164L18.568 12l2.693-2.7164zm-9.272 0l2.7175 2.7164-2.7175 2.7164-2.7164-2.7164 2.7164-2.7164zM12 0l7.353 7.353-2.7175 2.7164L12 5.4l-4.6366 4.6695L4.647 7.353 12 0z" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASSET_COLORS: Record<string, string> = {
  BTC:  'oklch(0.72 0.19 45)',
  ETH:  'oklch(0.65 0.15 270)',
  BNB:  'oklch(0.78 0.18 80)',
  SOL:  'oklch(0.68 0.20 310)',
  USDT: 'oklch(0.70 0.16 155)',
  USDC: 'oklch(0.65 0.14 220)',
  XRP:  'oklch(0.65 0.12 230)',
  ADA:  'oklch(0.60 0.16 240)',
  DOGE: 'oklch(0.75 0.18 65)',
  AVAX: 'oklch(0.62 0.22 25)',
}

const FALLBACK_COLORS = [
  'oklch(0.68 0.18 180)',
  'oklch(0.65 0.17 330)',
  'oklch(0.70 0.15 130)',
  'oklch(0.63 0.19 290)',
  'oklch(0.72 0.16 55)',
]

function getAssetColor(asset: string, index: number): string {
  return ASSET_COLORS[asset] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function getCurrencySymbol(currency: string): string {
  return currency === 'EUR' ? '€' : '$'
}

function fmt(value: number, currency: string): string {
  return `${getCurrencySymbol(currency)}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchPortfolio(token: string): Promise<Portfolio> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/binance-portfolio`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  )
  const data = await res.json()
  if (!data.ok) throw new Error(data.error ?? 'Failed to fetch portfolio')
  return data
}

async function fetchHistory(token: string): Promise<History> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/binance-history`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  )
  const data = await res.json()
  if (!data.ok) throw new Error(data.error ?? 'Failed to fetch history')
  return data
}

// ─── Component ────────────────────────────────────────────────────────────────

type ChartView = 'total' | 'per-asset'

export function BinancePortfolioDashboard() {
  const { getToken } = useAuth()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartView, setChartView] = useState<ChartView>('total')

  const [disconnecting, setDisconnecting] = useState(false)

async function handleDisconnect() {
  if (!confirm('Are you sure you want to disconnect your Binance account?')) return
  try {
    setDisconnecting(true)
    const token = await getToken()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/binance-connect`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
    // Reset state — shows disconnected UI
    setPortfolio(null)
    setHistory(null)
  } catch (err: any) {
    setError(err.message)
  } finally {
    setDisconnecting(false)
  }
}

  useEffect(() => {
    // Mock mode — odstrani in uncommentaj spodnje ko imaš pravi Binance
    setPortfolio(MOCK_PORTFOLIO)
    setHistory({
      currency: MOCK_PORTFOLIO.currency,
      history: generateMockHistory(MOCK_PORTFOLIO.balances, MOCK_PORTFOLIO.currency),
    })
    setLoading(false)
    /*
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const token = await getToken()
        if (!token) throw new Error('Not authenticated')
        const [p, h] = await Promise.all([fetchPortfolio(token), fetchHistory(token)])
        setPortfolio(p)
        setHistory(h)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    */
  }, [])

  const totalAssets = useMemo(() => portfolio?.balances.length ?? 0, [portfolio])

  const pieData = useMemo(() => {
    if (!portfolio) return []
    return portfolio.balances
      .filter((b) => b.value !== null && b.value > 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map((b, i) => ({
        name: b.asset,
        value: b.value!,
        color: getAssetColor(b.asset, i),
      }))
  }, [portfolio])

  // ── Total portfolio series (one line) ──────────────────────────────────────
  const totalSeries = useMemo(() => {
    if (!history?.history.length) return []
    return [{
      id: 'total',
      name: 'Total Portfolio',
      color: 'oklch(0.72 0.19 45)',
      data: history.history.map((h) => ({
        timestamp: new Date(h.date).getTime(),
        value: h.totalValue,
      })),
    }]
  }, [history])

  // ── Per-asset series (one line per asset) ──────────────────────────────────
  const assetSeries = useMemo(() => {
    if (!history?.history.length) return []

    // Collect all unique assets across all snapshots
    const allAssets = Array.from(
      new Set(history.history.flatMap((h) => h.assets.map((a) => a.asset)))
    )

    return allAssets.map((asset, i) => ({
      id: asset,
      name: asset,
      color: getAssetColor(asset, i),
      data: history.history
        .map((h) => {
          const a = h.assets.find((a) => a.asset === asset)
          return a?.value != null
            ? { timestamp: new Date(h.date).getTime(), value: a.value }
            : null
        })
        .filter(Boolean) as { timestamp: number; value: number }[],
    }))
  }, [history])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6 w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[oklch(0.72_0.19_45_/_0.15)]">
            <BinanceLogo className="w-4 h-4 text-[oklch(0.72_0.19_45)]" />
          </div>
          <div className="h-5 w-40 rounded bg-[oklch(0.22_0_0)] animate-pulse" />
        </div>
        <div className="h-24 rounded-xl bg-[oklch(0.18_0_0)] animate-pulse" />
        <div className="h-72 rounded-xl bg-[oklch(0.18_0_0)] animate-pulse" />
        <div className="h-72 rounded-xl bg-[oklch(0.18_0_0)] animate-pulse" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6 w-full">
        <div className="rounded-lg border border-[oklch(0.60_0.20_25_/_0.3)] bg-[oklch(0.60_0.20_25_/_0.08)] p-4">
          <p className="text-sm text-[oklch(0.60_0.20_25)]">{error}</p>
        </div>
      </div>
    )
  }

  //if (!portfolio) return null

  if (!portfolio) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <BinanceLogo className="w-8 h-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Binance account disconnected.</p>
    </div>
  )
}

  const sym = getCurrencySymbol(portfolio.currency)

  return (
    <div className="flex flex-col gap-6 p-6 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[oklch(0.72_0.19_45_/_0.15)]">
            <BinanceLogo className="w-4 h-4 text-[oklch(0.72_0.19_45)]" />
          </div>
          <div>
            <p className="text-xl font-semibold text-foreground leading-none">Binance Spot</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totalAssets} assets</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* canTrade badge */}
          {/*<span className={`text-xs font-medium px-2 py-1 rounded-full ${
            portfolio.canTrade
              ? 'text-[oklch(0.70_0.16_155)] bg-[oklch(0.70_0.16_155_/_0.12)]'
              : 'text-[oklch(0.60_0.20_25)] bg-[oklch(0.60_0.20_25_/_0.12)]'
          }`}>
            {portfolio.canTrade ? 'Trading enabled' : 'Trading disabled'}
          </span>*/}

          {/* Disconnect button */}
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[oklch(0.60_0.20_25)] bg-[oklch(0.60_0.20_25_/_0.08)] hover:bg-[oklch(0.60_0.20_25_/_0.15)] transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>

      {/* Total value */}
      <div className="bg-card border rounded-xl p-5 flex flex-col gap-1" style={{ borderColor: 'oklch(0.72 0.19 45 / 0.25)' }}>
        <p className="text-xs text-muted-foreground font-medium">Total Portfolio Value</p>
        <p className="text-3xl font-bold text-foreground">
          {fmt(portfolio.totalValue, portfolio.currency)}
        </p>
        <p className="text-xs text-muted-foreground">{totalAssets} assets · SPOT</p>
      </div>

      {/* Pie + table */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

        {/* Pie */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Distribution</h2>
          <p className="text-xs text-muted-foreground">By {portfolio.currency} value</p>
          <PortfolioPie data={pieData} height={220} currencySymbol={sym} />
        </div>

        {/* Holdings table */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">All Holdings</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-[oklch(0.18_0_0)] text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Asset</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Price</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {portfolio.balances.map((b, i) => {
                  const color = getAssetColor(b.asset, i)
                  const qty = parseFloat(b.quantity)
                  return (
                    <tr key={b.asset} className="hover:bg-[oklch(0.20_0_0)] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <span className="font-medium text-foreground">{b.asset}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs">
                        {isNaN(qty) ? b.quantity : qty.toLocaleString(undefined, { maximumFractionDigits: 6 })} {b.asset}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs">
                        {b.price !== null
                          ? fmt(b.price, portfolio.currency)
                          : <span className="text-[oklch(0.35_0_0)]">—</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-foreground font-mono text-xs">
                        {b.value !== null
                          ? fmt(b.value, portfolio.currency)
                          : <span className="text-[oklch(0.35_0_0)]">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History chart */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Portfolio History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {history?.history.length ?? 0} daily snapshots
            </p>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-1 bg-[oklch(0.18_0_0)] rounded-lg p-1">
            <button
              onClick={() => setChartView('total')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                chartView === 'total'
                  ? 'bg-[oklch(0.28_0_0)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Total
            </button>
            <button
              onClick={() => setChartView('per-asset')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                chartView === 'per-asset'
                  ? 'bg-[oklch(0.28_0_0)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Per Asset
            </button>
          </div>
        </div>

        <ValueChart
          series={chartView === 'total' ? totalSeries : assetSeries}
          height={280}
          currencySymbol={sym}
        />
      </div>

    </div>
  )
}