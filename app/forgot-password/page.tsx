
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'
import { useUser } from '@clerk/nextjs'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { SolaraLogo } from '@/components/logo'

type Step = 'request' | 'verify' | 'new_password'

function getClerkErrorMessage(err: unknown): string | null {
  const maybeErrors =
    typeof err === 'object' &&
    err !== null &&
    'errors' in err &&
    Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors)
      ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors
      : null

  const first = maybeErrors?.[0]
  if (!first) return null
  return first.longMessage || first.message || null
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { signIn, fetchStatus } = useSignIn()
  const { user, isLoaded: isUserLoaded } = useUser()

  useEffect(() => {
    if (isUserLoaded && user) {
      router.replace('/')
    }
  }, [isUserLoaded, user, router])

  const [step, setStep] = useState<Step>('request')
  const [emailAddress, setEmailAddress] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formError, setFormError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    if (!signIn) return false
    if (step === 'request') return emailAddress.trim().length > 0
    if (step === 'verify') return code.trim().length > 0
    if (step === 'new_password') return password.length > 0 && confirmPassword.length > 0
    return false
  }, [signIn, step, emailAddress, code, password, confirmPassword])

  async function handleSendCode() {
    if (!signIn) return

    const identifier = emailAddress.trim()
    if (!identifier) {
      setFormError('Please enter your email address.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)
      setInfoMessage(null)

      const res = await signIn.create({ identifier })
      if (res.error) {
        setFormError(getClerkErrorMessage(res.error) || 'Could not start password reset.')
        return
      }

      const send = await signIn.resetPasswordEmailCode.sendCode()
      if (send.error) {
        setFormError(getClerkErrorMessage(send.error) || 'Could not send reset code.')
        return
      }

      setInfoMessage('We sent a reset code to your email.')
      setStep('verify')
    } catch (err: unknown) {
      setFormError(getClerkErrorMessage(err) || 'Could not send reset code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyCode() {
    if (!signIn) return

    const trimmed = code.trim()
    if (!trimmed) {
      setFormError('Please enter the code from your email.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)
      setInfoMessage(null)

      const verify = await signIn.resetPasswordEmailCode.verifyCode({ code: trimmed })
      if (verify.error) {
        setFormError(getClerkErrorMessage(verify.error) || 'Invalid code. Please try again.')
        return
      }

      // Clerk should move to needs_new_password after verifying code
      setInfoMessage('Code verified. Please set a new password.')
      setStep('new_password')
    } catch (err: unknown) {
      setFormError(getClerkErrorMessage(err) || 'Could not verify code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSetNewPassword() {
    if (!signIn) return

    if (!password) {
      setFormError('Please enter a new password.')
      return
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)
      setInfoMessage(null)

      const submit = await signIn.resetPasswordEmailCode.submitPassword({ password })
      if (submit.error) {
        setFormError(getClerkErrorMessage(submit.error) || 'Could not set new password.')
        return
      }

      if (signIn.status === 'complete') {
        const finalize = await signIn.finalize({
          navigate: async ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              // If session tasks are enabled in your instance, you can handle them here.
              return
            }

            const url = decorateUrl('/')
            if (url.startsWith('http')) {
              window.location.href = url
            } else {
              router.push(url)
            }
          },
        })

        if (finalize.error) {
          setFormError(getClerkErrorMessage(finalize.error) || 'Password updated, but sign-in could not be finalized.')
          return
        }

        return
      }

      if (signIn.status === 'needs_second_factor') {
        setFormError('This account requires 2FA, but this reset UI does not handle it yet.')
        return
      }

      setFormError('Password reset is not complete yet. Please try again.')
    } catch (err: unknown) {
      setFormError(getClerkErrorMessage(err) || 'Could not set new password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Logo + brand */}
        <div className="flex flex-col items-center gap-3">
          <SolaraLogo size={48} />
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Solar</h1>
            <p className="text-sm text-muted-foreground mt-1">Reset your password</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
          {formError && (
            <div className="text-xs rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 px-3 py-2">
              {formError}
            </div>
          )}
          {infoMessage && (
            <div className="text-xs rounded-lg border border-border bg-[oklch(0.20_0_0)] text-muted-foreground px-3 py-2">
              {infoMessage}
            </div>
          )}

          {step === 'request' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45/0.6)] transition-all"
                />
              </div>

              <button
                onClick={handleSendCode}
                disabled={!canSubmit || isSubmitting || fetchStatus === 'fetching'}
                className="h-10 rounded-lg bg-[oklch(0.72_0.19_45)] hover:bg-[oklch(0.78_0.19_45)] text-[oklch(0.12_0_0)] text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Sending...
                  </>
                ) : (
                  'Send reset code'
                )}
              </button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="code" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Reset code
                </label>
                <input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45/0.6)] transition-all"
                />
              </div>

              <button
                onClick={handleVerifyCode}
                disabled={!canSubmit || isSubmitting || fetchStatus === 'fetching'}
                className="h-10 rounded-lg bg-[oklch(0.72_0.19_45)] hover:bg-[oklch(0.78_0.19_45)] text-[oklch(0.12_0_0)] text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Verifying...
                  </>
                ) : (
                  'Verify code'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormError(null)
                  setInfoMessage(null)
                  setCode('')
                  setStep('request')
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a different email
              </button>
            </>
          )}

          {step === 'new_password' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full h-10 px-3 pr-10 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45/0.6)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full h-10 px-3 pr-10 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45/0.6)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSetNewPassword}
                disabled={!canSubmit || isSubmitting || fetchStatus === 'fetching'}
                className="h-10 rounded-lg bg-[oklch(0.72_0.19_45)] hover:bg-[oklch(0.78_0.19_45)] text-[oklch(0.12_0_0)] text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Updating...
                  </>
                ) : (
                  'Set new password'
                )}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Remembered it?{' '}
          <button
            onClick={() => router.push('/sign-in')}
            className="text-[oklch(0.72_0.19_45)] hover:text-[oklch(0.80_0.19_45)] transition-colors font-medium cursor-pointer"
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}
