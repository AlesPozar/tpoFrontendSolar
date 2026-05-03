'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar, type ActiveView } from '@/components/sidebar'
import { TopHeader } from '@/components/top-header'
import { UserProfile } from '@/components/user-profile'
import { ChartSearchView } from '@/components/chart-search-view'
import { AddCryptoWalletDialog } from '@/components/add-crypto-wallet-dialog'
import { BinancePortfolioDashboard } from '@/components/crypto-dashboard'
import { CryptoWalletDetail } from '@/components/crypto-wallet-detail'
import { BankDashboard } from '@/components/bank-dashboard'
import { OverviewDashboard } from '@/components/overview-dashboard'
import { useUser } from '@clerk/nextjs'

export default function Home() {
  const router = useRouter()
  const { user, isLoaded: isUserLoaded } = useUser()

  const [ready, setReady] = useState(false)
  const [active, setActive] = useState<ActiveView>('overview')
  const [showProfile, setShowProfile] = useState(false)
  const [searchPair, setSearchPair] = useState<string | null>(null)
  const [showAddCryptoWallet, setShowAddCryptoWallet] = useState(false)
  const [walletRefreshKey, setWalletRefreshKey] = useState(0)
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)

  useEffect(() => {
    if (isUserLoaded && !user) {
      router.replace('/sign-in')
    } else if (isUserLoaded && user) {
      setReady(true)
    }
  }, [isUserLoaded, user, router])

  if (!ready) return null

  function handleSearch(pair: string) {
    setSearchPair(pair)
    setShowProfile(false)
    setSelectedWalletId(null)
  }

  function handleClearSearch() {
    setSearchPair(null)
  }

  function handleSidebarChange(view: ActiveView) {
    setActive(view)
    setShowProfile(false)
    setSearchPair(null)

    if (view === 'binance') {
      setSelectedWalletId(null)
      return
    }

    if (view === 'bank') {
      setSelectedWalletId(null)
      return
    }

    if (view.startsWith('wallet:')) {
      setSelectedWalletId(view.slice('wallet:'.length))
      return
    }

    setSelectedWalletId(null)
  }

  function handleWalletCreated(result?: { wallet?: { id: string }; binanceConnected?: boolean }) {
    setWalletRefreshKey((prev) => prev + 1)

    if (result?.binanceConnected) {
      setSelectedWalletId(null)
      setActive('binance')
      return
    }

    if (result?.wallet?.id) {
      setSelectedWalletId(result.wallet.id)
      setActive(`wallet:${result.wallet.id}`)
    } else {
      setSelectedWalletId(null)
      setActive('overview')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        active={active}
        onChange={handleSidebarChange}
        onAddCryptoWallet={() => setShowAddCryptoWallet(true)}
        refreshKey={walletRefreshKey}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader
          onProfileClick={() => {
            setShowProfile((prev) => !prev)
          }}
          onSearch={handleSearch}
        />

        <main className="flex-1 overflow-y-auto bg-background">
          {showProfile ? (
            <UserProfile onBack={() => setShowProfile(false)} />
          ) : searchPair ? (
            <ChartSearchView key={searchPair} pair={searchPair} onClose={handleClearSearch} />
          ) : active === 'binance' ? (
            <BinancePortfolioDashboard />
          ) : active === 'bank' ? (
            <BankDashboard />
          ) : selectedWalletId ? (
            <CryptoWalletDetail
              walletId={selectedWalletId}
              onBack={() => handleSidebarChange('overview')}
              onDeleted={() => setWalletRefreshKey((prev) => prev + 1)}
            />
          ) : (
            <DashboardContent walletRefreshKey={walletRefreshKey} />
          )}
        </main>
      </div>

      <AddCryptoWalletDialog
        open={showAddCryptoWallet}
        onOpenChange={setShowAddCryptoWallet}
        onCreated={handleWalletCreated}
      />
    </div>
  )
}

type DashboardContentProps = {
  walletRefreshKey: number
}

function DashboardContent({ walletRefreshKey }: DashboardContentProps) {
  return <OverviewDashboard key={walletRefreshKey} />
}
