'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { SolaraLogo } from '@/components/logo'

export default function EmailLinkCallbackPage() {
  const router = useRouter()
  const clerk = useClerk()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('Finishing verification...')

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        await clerk.handleEmailLinkVerification({
          redirectUrlComplete: '/',
          redirectUrl: '/',
          onVerifiedOnOtherDevice: () => {
            if (!cancelled) {
              setMessage('Verification completed on another device. You can now return to sign in on this device.')
            }
          },
        })
      } catch {
        if (!cancelled) {
          setError('Could not verify this link. Please try signing in again.')
          setMessage('')
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [clerk])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <SolaraLogo size={48} />
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Solar</h1>
            <p className="text-sm text-muted-foreground mt-1">Verifying your sign-in</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
          {error ? (
            <div className="text-xs rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 px-3 py-2">{error}</div>
          ) : (
            <div className="text-xs rounded-lg border border-border bg-[oklch(0.20_0_0)] text-muted-foreground px-3 py-2">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.replace('/sign-in')}
            className="h-10 rounded-lg bg-[oklch(0.20_0_0)] hover:bg-[oklch(0.24_0_0)] border border-border text-sm font-semibold text-foreground transition-colors cursor-pointer"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}
