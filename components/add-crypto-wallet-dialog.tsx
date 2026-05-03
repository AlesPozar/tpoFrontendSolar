'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Eye, EyeOff, Loader2, Wallet, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { WalletIconPicker, saveWalletIcon, saveWalletIconToServer, type WalletIconType } from '@/components/wallet-icons'

type AddCryptoWalletDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (result?: { wallet?: { id: string }; binanceConnected?: boolean }) => void
}

type AddStep = 'pick-entry-type' | 'crypto-wallet' | 'binance'

export function AddCryptoWalletDialog({
  open,
  onOpenChange,
  onCreated,
}: AddCryptoWalletDialogProps) {
  const { getToken } = useAuth()

  const [step, setStep] = useState<AddStep>('pick-entry-type')
  const [walletName, setWalletName] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [walletIcon, setWalletIcon] = useState<WalletIconType>('metamask')
  const [binanceName, setBinanceName] = useState('My Binance')
  const [binanceApiKey, setBinanceApiKey] = useState('')
  const [binanceSecretKey, setBinanceSecretKey] = useState('')
  const [showBinanceSecret, setShowBinanceSecret] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setStep('pick-entry-type')
      setWalletName('')
      setWalletAddress('')
      setWalletIcon('metamask')
      setBinanceName('My Binance')
      setBinanceApiKey('')
      setBinanceSecretKey('')
      setShowBinanceSecret(false)
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      setError('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
      return
    }

    if (!walletAddress.trim()) {
      setError('Please enter a wallet address.')
      return
    }

    try {
      setSubmitting(true)

      const token = await getToken({ template: 'supabase' })
      if (!token) {
        setError('Could not obtain auth token from Clerk.')
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/crypto-wallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletName,
          walletAddress,
          selectedChain: 'allchains',
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? 'Could not add crypto wallet.')
        return
      }

      if (payload?.wallet?.id) {
        try {
          await saveWalletIconToServer({
            walletId: payload.wallet.id,
            icon: walletIcon,
            token,
          })
        } catch {
          saveWalletIcon(payload.wallet.id, walletIcon)
        }
      }

      onCreated?.({ wallet: payload?.wallet })
      onOpenChange(false)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBinanceConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      setError('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
      return
    }

    if (!binanceApiKey.trim() || !binanceSecretKey.trim()) {
      setError('Please enter both API key and Secret key.')
      return
    }

    try {
      setSubmitting(true)

      const token = await getToken({ template: 'supabase' })
      if (!token) {
        setError('Could not obtain auth token from Clerk.')
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/binance-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountName: binanceName,
          apiKey: binanceApiKey,
          secretKey: binanceSecretKey,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? 'Could not connect Binance account.')
        return
      }

      onCreated?.({ binanceConnected: true })
      onOpenChange(false)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-[oklch(0.14_0_0)] p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {step === 'pick-entry-type' ? 'Add account' : 'Add Crypto Wallet'}
            </h2>
            {step === 'pick-entry-type' ? <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose what you want to add.</p> : null}
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-[oklch(0.20_0_0)] hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'pick-entry-type' ? (
          <div className="mt-2 flex flex-col gap-3">
            <EntryTypeCard
              title="Crypto wallet"
              description="Add a public wallet."
              icon={<Wallet className="h-5 w-5" />}
              onClick={() => setStep('crypto-wallet')}
            />
            <EntryTypeCard
              title="Binance account"
              description="Add a Binance wallet."
              icon={<BinanceMiniLogo className="h-5 w-5" />}
              onClick={() => setStep('binance')}
            />
          </div>
        ) : step === 'crypto-wallet' ? (
        <form className="mt-2 flex flex-col gap-4" onSubmit={handleSubmit}>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Wallet icon</label>
              <WalletIconPicker value={walletIcon} onChange={setWalletIcon} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="walletName" className="text-xs text-muted-foreground">
                Wallet name
              </label>
              <input
                id="walletName"
                value={walletName}
                onChange={(event) => setWalletName(event.target.value)}
                placeholder="My MetaMask"
                className="h-9 w-full rounded-xl border border-border bg-[oklch(0.18_0_0)] px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[oklch(0.72_0.19_45)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="walletAddress" className="text-xs text-muted-foreground">
                Public wallet address
              </label>
              <input
                id="walletAddress"
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
                placeholder="0x..."
                className="h-9 w-full rounded-xl border border-border bg-[oklch(0.18_0_0)] px-3 text-sm font-mono text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[oklch(0.72_0.19_45)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                Chain detection is automatic and scans supported GoldRush chains until a match is found.
              </span>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[oklch(0.72_0.19_45)] text-black hover:bg-[oklch(0.66_0.19_45)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add wallet'
                )}
              </Button>
            </div>
        </form>
        ) : (
        <form className="mt-2 flex flex-col gap-4" onSubmit={handleBinanceConnect}>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="binanceName" className="text-xs text-muted-foreground">
                Account name
              </label>
              <input
                id="binanceName"
                value={binanceName}
                onChange={(event) => setBinanceName(event.target.value)}
                placeholder="My Binance"
                className="h-9 w-full rounded-xl border border-border bg-[oklch(0.18_0_0)] px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[oklch(0.72_0.19_45)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="binanceApiKey" className="text-xs text-muted-foreground">
                API key
              </label>
              <input
                id="binanceApiKey"
                value={binanceApiKey}
                onChange={(event) => setBinanceApiKey(event.target.value)}
                placeholder="Paste your Binance API key"
                className="h-9 w-full rounded-xl border border-border bg-[oklch(0.18_0_0)] px-3 text-sm font-mono text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[oklch(0.72_0.19_45)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="binanceSecretKey" className="text-xs text-muted-foreground">
                Secret key
              </label>
              <div className="relative">
                <input
                  id="binanceSecretKey"
                  type={showBinanceSecret ? 'text' : 'password'}
                  value={binanceSecretKey}
                  onChange={(event) => setBinanceSecretKey(event.target.value)}
                  placeholder="Paste your Binance secret key"
                  className="h-9 w-full rounded-xl border border-border bg-[oklch(0.18_0_0)] px-3 pr-10 text-sm font-mono text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[oklch(0.72_0.19_45)]"
                />
                <button
                  type="button"
                  onClick={() => setShowBinanceSecret((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showBinanceSecret ? 'Hide secret key' : 'Show secret key'}
                >
                  {showBinanceSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[oklch(0.72_0.19_45)] text-black hover:bg-[oklch(0.66_0.19_45)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Binance'
                )}
              </Button>
            </div>
        </form>
        )}
      </div>
    </div>
  )
}

function EntryTypeCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
}: {
  title: string
  description: string
  icon: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        disabled
          ? 'flex w-full items-start gap-3 rounded-xl border border-border/70 bg-[oklch(0.16_0_0)] p-3 text-left opacity-70'
          : 'flex w-full items-start gap-4 rounded-xl border border-border bg-[oklch(0.18_0_0)] p-4 text-left transition-all duration-200 hover:bg-[oklch(0.22_0_0)] hover:border-[oklch(0.72_0.19_45_/_0.5)]'
      }
    >
      <div className="mt-0.5 text-[oklch(0.72_0.19_45)]">{icon}</div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

function BinanceMiniLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Binance">
      <path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7175 2.7164L18.568 12l2.693-2.7164zm-9.272 0l2.7175 2.7164-2.7175 2.7164-2.7164-2.7164 2.7164-2.7164zM12 0l7.353 7.353-2.7175 2.7164L12 5.4l-4.6366 4.6695L4.647 7.353 12 0z" />
    </svg>
  )
}
