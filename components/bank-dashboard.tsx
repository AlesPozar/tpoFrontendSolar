'use client'

import { useEffect, useMemo, useState } from 'react'
import { Wallet, Trash2, Pencil, Plus, CreditCard, PiggyBank } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineRename } from '@/components/inline-rename'
import { StatCard } from '@/components/stat-card'
import { ValueChart } from '@/components/value-chart'
import { cn } from '@/lib/utils'

type BankAccountType = 'checking' | 'savings' | 'other'

type BankAccount = {
  id: string
  name: string
  custom_name?: string | null
  account_type: BankAccountType
  balance: number
  created_at: string
  updated_at: string
}

type BankTotals = {
  totalBalance: number
  checkingTotal: number
  savingsTotal: number
  otherTotal?: number
}

type BankAccountsResponse = {
  ok: boolean
  error?: string
  accounts?: BankAccount[]
  totals?: BankTotals
}

type BankHistoryPoint = {
  timestamp: number
  value: number
}

type BankHistorySeries = {
  id: string
  name: string
  color: string
  data: BankHistoryPoint[]
}

type BankHistoryResponse = {
  ok: boolean
  error?: string
  chartAvailable?: boolean
  message?: string | null
  overviewSeries?: BankHistorySeries[]
  totals?: BankTotals
  snapshots?: Array<{
    total_balance: number
    checking_total: number
    savings_total: number
    other_total?: number
    created_at: string
  }>
}

type AccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialAccount?: BankAccount | null
  onSubmit: (payload: { name: string; accountType: BankAccountType; balance: number; customName?: string | null }) => Promise<void>
}

const ORANGE_ACCENT = 'oklch(0.72 0.19 45)'
const BLUE_ACCENT = 'oklch(0.65 0.15 200)'

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AccountDialog({ open, onOpenChange, mode, initialAccount, onSubmit }: AccountDialogProps) {
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<BankAccountType>('checking')
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initialAccount?.account_type === 'other' ? (initialAccount.custom_name ?? initialAccount.name) : (initialAccount?.name ?? ''))
    setAccountType(initialAccount?.account_type ?? 'checking')
    setBalance(initialAccount ? String(initialAccount.balance) : '')
    setError(null)
  }, [initialAccount, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const parsedBalance = Number(balance)

    if (!trimmedName) {
      setError('Account name is required.')
      return
    }

    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setError('Enter a valid non-negative balance.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await onSubmit({
        name: trimmedName,
        accountType,
        balance: parsedBalance,
        customName: accountType === 'other' ? trimmedName : null,
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[oklch(0.16_0_0)] border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {mode === 'create' ? 'Add Asset' : 'Edit Asset'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Track checking and savings accounts manually.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4 mt-2" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-name" className="text-xs text-muted-foreground">Account Name</Label>
            <Input
              id="bank-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Checking"
              className="bg-[oklch(0.20_0_0)] border-border text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-type" className="text-xs text-muted-foreground">Account Type</Label>
            <select
              id="bank-type"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as BankAccountType)}
              className="h-9 rounded-md border border-border bg-[oklch(0.20_0_0)] px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-[oklch(0.65_0.15_200_/_0.5)]"
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
                <option value="other">Other (traditional)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-balance" className="text-xs text-muted-foreground">Balance</Label>
            <Input
              id="bank-balance"
              type="number"
              min="0"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              className="bg-[oklch(0.20_0_0)] border-border text-sm"
            />
          </div>

          {error && <p className="text-xs text-[oklch(0.60_0.20_25)]">{error}</p>}

          <Button
            type="submit"
            disabled={saving}
            className="bg-[oklch(0.65_0.15_200)] text-[oklch(0.12_0_0)] hover:bg-[oklch(0.58_0.15_200)] font-semibold"
          >
            {saving ? 'Saving…' : 'Save Account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BankDashboard() {
  const { getToken, isLoaded } = useAuth()
  const [title, setTitle] = useState('Traditional assets overview')
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [totals, setTotals] = useState<BankTotals>({ totalBalance: 0, checkingTotal: 0, savingsTotal: 0, otherTotal: 0 })
  const [previousTotals, setPreviousTotals] = useState<BankTotals | null>(null)
  const [series, setSeries] = useState<BankHistorySeries[]>([])
  const [chartAvailable, setChartAvailable] = useState(false)
  const [chartMessage, setChartMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? ''

  async function getJwtToken() {
    const token = await getToken({ template: 'supabase' })
    if (!token) {
      throw new Error('Could not get Clerk JWT token')
    }
    return token
  }

  async function fetchJson<T>(path: string, init: RequestInit = {}) {
    if (!supabaseUrl) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
    }

    const token = await getJwtToken()
    const res = await fetch(`${supabaseUrl}/functions/v1/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    const json = (await res.json()) as T
    if (!res.ok || !(json as { ok?: boolean }).ok) {
      throw new Error((json as { error?: string }).error || `Request failed (${res.status})`)
    }
    return json
  }

  async function loadDashboard() {
    if (!isLoaded) return

    try {
      setLoading(true)
      setError(null)

      const [accountsData, historyData] = await Promise.all([
        fetchJson<BankAccountsResponse>('bank-accounts'),
        fetchJson<BankHistoryResponse>('bank-balance-history?days=365'),
      ])

      setAccounts(accountsData.accounts ?? [])
      setTotals(accountsData.totals ?? { totalBalance: 0, checkingTotal: 0, savingsTotal: 0 })
      setSeries(historyData.overviewSeries ?? [])
      setChartAvailable(Boolean(historyData.chartAvailable))
      setChartMessage(historyData.message ?? null)

      const snapshots = historyData.snapshots ?? []
      if (snapshots.length >= 2) {
        const previousSnapshot = snapshots[snapshots.length - 2]
        setPreviousTotals({
          totalBalance: Number(previousSnapshot.total_balance ?? 0),
          checkingTotal: Number(previousSnapshot.checking_total ?? 0),
          savingsTotal: Number(previousSnapshot.savings_total ?? 0),
          otherTotal: Number(previousSnapshot.other_total ?? 0),
        })
      } else {
        setPreviousTotals(null)
      }

      if (historyData.totals) {
        setTotals(historyData.totals)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load bank data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  const totalSeries = useMemo(() => series.filter((entry) => entry.id === 'bank-total'), [series])

  async function createAccount(payload: { name: string; accountType: BankAccountType; balance: number; customName?: string | null }) {
    setSaving(true)
    try {
      await fetchJson<BankAccountsResponse>('bank-accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await loadDashboard()
    } finally {
      setSaving(false)
    }
  }

  async function updateAccount(payload: { name: string; accountType: BankAccountType; balance: number; customName?: string | null }) {
    if (!editingAccount) return
    setSaving(true)
    try {
      await fetchJson<BankAccountsResponse>('bank-accounts', {
        method: 'PATCH',
        body: JSON.stringify({ id: editingAccount.id, ...payload }),
      })
      setEditingAccount(null)
      await loadDashboard()
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this bank account?')) return
    setSaving(true)
    try {
      await fetchJson<BankAccountsResponse>('bank-accounts', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await loadDashboard()
    } finally {
      setSaving(false)
    }
  }

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [accounts],
  )

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[oklch(0.72_0.19_45_/_0.15)] shrink-0">
            <Wallet className="w-4 h-4 text-[oklch(0.72_0.19_45)]" />
          </div>
          <div className="min-w-0">
            <InlineRename
              value={title}
              onSave={(next) => setTitle(next)}
              className="text-xl font-semibold text-foreground leading-none"
            />
            <p className="text-xs text-muted-foreground mt-0.5">Manual checking and savings accounts</p>
          </div>
        </div>

        <Button
          className="bg-[oklch(0.72_0.19_45)] text-[oklch(0.12_0_0)] hover:bg-[oklch(0.65_0.19_45)] font-semibold"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Asset
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading bank data…</div>}
      {!loading && error && <div className="text-sm text-[oklch(0.60_0.20_25)]">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Bank Balance"
              value={totals.totalBalance}
              previousValue={previousTotals?.totalBalance}
              accentColor={ORANGE_ACCENT}
              icon={<CreditCard className="w-3.5 h-3.5 text-[oklch(0.72_0.19_45)]" />}
              currencySymbol="€"
            />
            <StatCard
              label="Main Checking"
              value={totals.checkingTotal}
              previousValue={previousTotals?.checkingTotal}
              accentColor={ORANGE_ACCENT}
              icon={<CreditCard className="w-3.5 h-3.5 text-[oklch(0.72_0.19_45)]" />}
              currencySymbol="€"
            />
            <StatCard
              label="Savings"
              value={totals.savingsTotal}
              previousValue={previousTotals?.savingsTotal}
              accentColor={BLUE_ACCENT}
              icon={<PiggyBank className="w-3.5 h-3.5 text-[oklch(0.65_0.15_200)]" />}
              currencySymbol="€"
            />
          </div>

          <div className="mt-3">
            <StatCard
              label="Other Traditional Assets"
              value={totals.otherTotal ?? 0}
              previousValue={previousTotals?.otherTotal}
              accentColor={ORANGE_ACCENT}
              icon={<Wallet className="w-3.5 h-3.5 text-[oklch(0.72_0.19_45)]" />}
              currencySymbol="€"
            />
          </div>

          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Total Balance History</h2>
                <p className="text-xs text-muted-foreground">
                  {chartAvailable
                    ? 'Trend over time based on saved snapshots'
                    : chartMessage ?? 'Not enough time elapsed yet for trend graph'}
                </p>
              </div>
            </div>
            {chartAvailable ? (
              <ValueChart series={totalSeries} height={240} currencySymbol="€" />
            ) : (
              <div className="flex items-center justify-center text-muted-foreground text-sm h-[240px]">
                {chartMessage ?? 'No chart data yet. Add a few changes over time.'}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Assets</h2>
              <span className="text-xs text-muted-foreground">{sortedAccounts.length} assets</span>
            </div>

            {sortedAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No bank accounts yet. Add your first checking or savings account.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-4 rounded-lg px-4 py-3 bg-[oklch(0.17_0_0)] border border-transparent hover:border-border transition-colors"
                  >
                    <div className={cn(
                      'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
                      account.account_type === 'checking'
                        ? 'bg-[oklch(0.65_0.15_200_/_0.16)]'
                        : account.account_type === 'savings'
                        ? 'bg-[oklch(0.72_0.19_45_/_0.16)]'
                        : 'bg-[oklch(0.58_0.12_280_/_0.16)]',
                    )}>
                      {account.account_type === 'checking' ? (
                        <CreditCard className="w-4 h-4 text-[oklch(0.65_0.15_200)]" />
                      ) : account.account_type === 'savings' ? (
                        <PiggyBank className="w-4 h-4 text-[oklch(0.72_0.19_45)]" />
                      ) : (
                        <Wallet className="w-4 h-4 text-[oklch(0.58_0.12_280)]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm text-foreground truncate">{account.account_type === 'other' ? (account.custom_name ?? account.name) : account.name}</span>
                        <span className={cn(
                          'text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded',
                          account.account_type === 'checking'
                            ? 'text-[oklch(0.65_0.15_200)] bg-[oklch(0.65_0.15_200_/_0.12)]'
                            : account.account_type === 'savings'
                            ? 'text-[oklch(0.72_0.19_45)] bg-[oklch(0.72_0.19_45_/_0.12)]'
                            : 'text-[oklch(0.58_0.12_280)] bg-[oklch(0.58_0.12_280_/_0.12)]',
                        )}>
                          {account.account_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Updated {new Date(account.updated_at).toLocaleDateString()}</p>
                    </div>

                    <span className="text-sm font-semibold text-foreground">
                      €{formatCurrency(account.balance)}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingAccount(account)}
                      aria-label="Edit account"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-[oklch(0.60_0.20_25)]"
                      onClick={() => deleteAccount(account.id)}
                      disabled={saving}
                      aria-label="Remove account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <AccountDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={createAccount}
      />

      <AccountDialog
        open={Boolean(editingAccount)}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null)
        }}
        mode="edit"
        initialAccount={editingAccount}
        onSubmit={updateAccount}
      />
    </div>
  )
}
