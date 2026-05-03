'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Landmark, Plus } from 'lucide-react'

import { SolaraLogo } from './logo'
import { cn } from '@/lib/utils'
import { WalletIcon, getSavedWalletIcon, saveWalletIconToServer, type WalletIconType } from './wallet-icons'

export type ActiveView = 'overview' | 'bank' | 'binance' | `wallet:${string}`

type SidebarWallet = {
  id: string
  wallet_name: string
  wallet_address: string
  icon_type?: WalletIconType | null
}

type SidebarProps = {
  active: ActiveView
  onChange: (view: ActiveView) => void
  onAddCryptoWallet?: () => void
  refreshKey?: number
}

export function Sidebar({ active, onChange, onAddCryptoWallet, refreshKey = 0 }: SidebarProps) {
  const { getToken } = useAuth()
  const [wallets, setWallets] = useState<SidebarWallet[]>([])
  const [walletIconMap, setWalletIconMap] = useState<Record<string, WalletIconType>>({})
  const [binanceConnected, setBinanceConnected] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadWallets() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrl) return

        const token = await getToken({ template: 'supabase' })
        if (!token) return

        const [walletsResponse, binanceStatusResponse] = await Promise.all([
          fetch(`${supabaseUrl}/functions/v1/crypto-wallets`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${supabaseUrl}/functions/v1/binance-connect`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        const walletsPayload = await walletsResponse.json()
        if (!walletsResponse.ok || !walletsPayload?.ok || cancelled) return

        const fetchedWallets = (walletsPayload.wallets ?? []) as SidebarWallet[]
        setWallets(fetchedWallets)

        const nextIconMap: Record<string, WalletIconType> = {}
        const migrations: Array<Promise<unknown>> = []
        for (const wallet of fetchedWallets) {
          const localIcon = getSavedWalletIcon(wallet.id)
          const icon = wallet.icon_type ?? localIcon ?? 'metamask'
          nextIconMap[wallet.id] = icon

          if (!wallet.icon_type && localIcon) {
            migrations.push(
              saveWalletIconToServer({ walletId: wallet.id, icon: localIcon, token }).catch(() => null),
            )
          }
        }
        setWalletIconMap(nextIconMap)
        if (migrations.length > 0) {
          void Promise.allSettled(migrations)
        }

        if (!binanceStatusResponse.ok) {
          setBinanceConnected(false)
          return
        }

        const binancePayload = await binanceStatusResponse.json()
        if (!cancelled) {
          setBinanceConnected(Boolean(binancePayload?.ok && binancePayload?.connected))
        }
      } catch {
        if (!cancelled) {
          setWallets([])
          setBinanceConnected(false)
        }
      }
    }

    void loadWallets()

    return () => {
      cancelled = true
    }
  }, [getToken, refreshKey])

  return (
    <aside className="flex h-screen w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-[oklch(0.14_0_0)] py-3">
      <button
        onClick={() => onChange('overview')}
        className={cn(
          'mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
          active === 'overview'
            ? 'bg-[oklch(0.72_0.19_45_/_0.2)] ring-1 ring-[oklch(0.72_0.19_45)]'
            : 'hover:bg-[oklch(0.20_0_0)]',
        )}
        title="Overview"
        aria-label="Go to overview"
      >
        <SolaraLogo size={28} />
      </button>

      <div className="mb-0.5 h-px w-6 bg-border" />

      <button
        onClick={() => onChange('bank')}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
          active === 'bank'
            ? 'bg-[oklch(0.72_0.19_45_/_0.2)] ring-1 ring-[oklch(0.72_0.19_45)]'
            : 'hover:bg-[oklch(0.20_0_0)]',
        )}
        title="Bank"
        aria-label="Open bank dashboard"
      >
        <Landmark className="h-5 w-5 text-[oklch(0.65_0.15_200)]" />
      </button>

      {binanceConnected || wallets.length > 0 ? <div className="my-0.5 h-px w-6 bg-border" /> : null}

      {binanceConnected ? (
        <button
          onClick={() => onChange('binance')}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
            active === 'binance'
              ? 'bg-[oklch(0.72_0.19_45_/_0.2)] ring-1 ring-[oklch(0.72_0.19_45)]'
              : 'hover:bg-[oklch(0.20_0_0)]',
          )}
          title="Open Binance"
          aria-label="Open Binance dashboard"
        >
          <BinanceLogo className="h-5 w-5 text-[oklch(0.72_0.19_45)]" />
        </button>
      ) : null}

      {wallets.map((wallet) => {
        const icon = walletIconMap[wallet.id] ?? 'metamask'
        const viewId = `wallet:${wallet.id}` as const
        const isActive = active === viewId
        return (
          <button
            key={wallet.id}
            onClick={() => onChange(viewId)}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
              isActive
                ? 'bg-[oklch(0.72_0.19_45_/_0.2)] ring-1 ring-[oklch(0.72_0.19_45)]'
                : 'hover:bg-[oklch(0.20_0_0)]',
            )}
            title={wallet.wallet_name}
            aria-label={`Open ${wallet.wallet_name}`}
          >
            <WalletIcon type={icon} className="h-5 w-5" />
          </button>
        )
      })}

      <div className="my-0.5 h-px w-6 bg-border" />

      <button
        onClick={() => onAddCryptoWallet?.()}
        className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-[oklch(0.20_0_0)] hover:text-foreground"
        title="Add Crypto Wallet"
        aria-label="Add crypto wallet"
      >
        <Plus className="h-5 w-5" />
      </button>
    </aside>
  )
}

function BinanceLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Binance">
      <path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7175 2.7164L18.568 12l2.693-2.7164zm-9.272 0l2.7175 2.7164-2.7175 2.7164-2.7164-2.7164 2.7164-2.7164zM12 0l7.353 7.353-2.7175 2.7164L12 5.4l-4.6366 4.6695L4.647 7.353 12 0z" />
    </svg>
  )
}
