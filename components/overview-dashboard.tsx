'use client'

import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, TrendingUp } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { StatCard } from './stat-card'
import { PortfolioPie } from './portfolio-pie'
import { ValueChart } from './value-chart'
import { InlineRename } from './inline-rename'

const ORANGE = 'oklch(0.72 0.19 45)'

const TOTALS_FUNCTION_NAME = 'overview-portfolio'
// TODO: when ready, deploy a separate history function and switch this constant.
const HISTORY_FUNCTION_NAME = 'overview-history'

type PieItem = { name: string; value: number; color: string }
type SeriesPoint = { timestamp: number; value: number }
type Series = { id: string; name: string; color: string; data: SeriesPoint[] }

type OverviewResponse = {
  ok: boolean
  error?: string
  metrics?: {
    cryptoTotal: number
    cryptoPrev: number
    bankTotal: number
    bankPrev: number
    totalNet: number
    totalPrev: number
  }
  pieData?: PieItem[]
  overviewSeries?: Series[]
  dashboardTitles?: {
    overview?: string
  }
  currency?: string
}

export function OverviewDashboard() {
  const { getToken, isLoaded } = useAuth()

  const [title, setTitle] = useState('Overview')
  const [loadingTotals, setLoadingTotals] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<OverviewResponse['metrics'] | null>(null)
  const [pieData, setPieData] = useState<PieItem[]>([])
  const [overviewSeries, setOverviewSeries] = useState<Series[]>([])
  const [currency, setCurrency] = useState<string | null>(null)

  const currencySymbol = currency === 'EUR' ? '€' : '$'

  useEffect(() => {
    if (!isLoaded) return

    let cancelled = false
    ;(async () => {
      try {
        setLoadingTotals(true)
        setError(null)

        const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrlRaw) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
        const supabaseUrl = supabaseUrlRaw.replace(/\/+$/, '')

        const token = await getToken({ template: 'supabase' })
        if (!token) throw new Error('Could not get Clerk JWT token')

        const res = await fetch(`${supabaseUrl}/functions/v1/${TOTALS_FUNCTION_NAME}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const json = (await res.json()) as OverviewResponse
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Request failed (${res.status})`)
        }

        if (cancelled) return

        setMetrics(json.metrics ?? null)
        setPieData(Array.isArray(json.pieData) ? json.pieData : [])
        setCurrency(typeof json.currency === 'string' ? json.currency : null)
        const newTitle = json.dashboardTitles?.overview
        if (typeof newTitle === 'string' && newTitle.trim()) setTitle(newTitle.trim())
      } catch (e: unknown) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load overview data')
      } finally {
        if (!cancelled) setLoadingTotals(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  // History fetch is intentionally separated (soon: separate edge function).
  // If history fails, we keep totals visible.
  useEffect(() => {
    if (!isLoaded) return

    let cancelled = false
    ;(async () => {
      try {
        const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrlRaw) return
        const supabaseUrl = supabaseUrlRaw.replace(/\/+$/, '')

        const token = await getToken({ template: 'supabase' })
        if (!token) return

        const res = await fetch(`${supabaseUrl}/functions/v1/${HISTORY_FUNCTION_NAME}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const json = (await res.json()) as OverviewResponse
        if (!res.ok || !json.ok) return

        if (cancelled) return
        setOverviewSeries(Array.isArray(json.overviewSeries) ? json.overviewSeries : [])
      } catch {
        // ignore on purpose
      }
    })()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded])

  const memoPieData = useMemo(() => pieData, [pieData])
  const memoOverviewSeries = useMemo(() => overviewSeries, [overviewSeries])

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[oklch(0.72_0.19_45_/_0.15)]">
          <LayoutDashboard className="w-4 h-4 text-[oklch(0.72_0.19_45)]" />
        </div>
        <div>
          <InlineRename
            value={title}
            onSave={(t) => setTitle(t)}
            className="text-xl font-semibold text-foreground leading-none"
          />
          <p className="text-xs text-muted-foreground mt-0.5">All investments combined</p>
        </div>
      </div>

      {loadingTotals && <div className="text-sm text-muted-foreground">Loading overview data…</div>}
      {!loadingTotals && error && <div className="text-sm text-[oklch(0.60_0.20_25)]">{error}</div>}

      {!loadingTotals && !error && metrics && (
        <>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Net Worth"
          value={metrics.totalNet}
          previousValue={metrics.totalPrev}
          icon={<TrendingUp className="w-3.5 h-3.5 text-[oklch(0.72_0.19_45)]" />}
          accentColor={ORANGE}
          currencySymbol={currencySymbol}
        />
        <StatCard
          label="Crypto Portfolio"
          value={metrics.cryptoTotal}
          previousValue={metrics.cryptoPrev}
          accentColor="oklch(0.72 0.19 45)"
          currencySymbol={currencySymbol}
        />
        <StatCard
          label="Bank Accounts"
          value={metrics.bankTotal}
          previousValue={metrics.bankPrev}
          accentColor="oklch(0.65 0.15 200)"
          currencySymbol={currencySymbol}
        />
      </div>

      {/* Pie + Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Allocation pie */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Asset Allocation</h2>
          <p className="text-xs text-muted-foreground">Crypto vs Bank</p>
          <PortfolioPie data={memoPieData} height={240} currencySymbol={currencySymbol} />
        </div>

        {/* Total portfolio chart */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Portfolio History</h2>
          <p className="text-xs text-muted-foreground">
            Value over time — x-axis reflects actual time spacing between entries
          </p>
          <ValueChart series={memoOverviewSeries} height={240} currencySymbol={currencySymbol} />
        </div>
      </div>

        </>
      )}
    </div>
  )
}
