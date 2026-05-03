'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SolaraLogo } from '@/components/logo'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
//clerk
import { useSignIn } from '@clerk/nextjs/legacy'
import { useClerk, useUser } from '@clerk/nextjs'



/*
TODO
implementiri vse gunkcionalnosti od clerka
-> DONE




*/

export default function SignInPage() {
    const router = useRouter()
    const [email, setEmail] = useState('demo@solara.app')
    const [password, setPassword] = useState('password')
    const [showPassword, setShowPassword] = useState(false) //show password je boolean state spremenljivka, setShowPassword pa funkcija ki se jo bo klicalo za nastavitev, primarno je false
    const [formError, setFormError] = useState<string | null>(null)
    const [infoMessage, setInfoMessage] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false)

    const [step, setStep] = useState<'password' | 'secondFactor' | 'clientTrust'>('password')
    const [secondFactorCode, setSecondFactorCode] = useState('')
    const [secondFactorStrategy, setSecondFactorStrategy] = useState<'email_code' | 'phone_code' | 'totp' | 'backup_code' | null>(null)



    //clerk shii
    const { user, isLoaded: isUserLoaded } = useUser()
    const clerk = useClerk()

    //če smo loggani in je preusmerjanje
    useEffect(() => {
        if (isUserLoaded && user) {
            router.replace('/')
        }
    }, [isUserLoaded, user, router])

    const { signIn, setActive, isLoaded } = useSignIn()

    // Note: email-link verification is handled in /email-link-callback.


    //routing
    function proceedSignUp() {
        router.push('/sign-up')
    }

    async function handleSignIn() {
        if (!isLoaded) return

        try {
            setIsSubmitting(true)
            setFormError(null)
            setInfoMessage(null)

            const result = await signIn.create({
                strategy: 'password',
                identifier: email,
                password,
            })

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId })
                router.replace('/')
                return
            }

            if (result.status === 'needs_new_password') {
                setFormError('This account requires a new password. Use “Forgot password?” to set a new one.')
                return
            }

            if (result.status === 'needs_client_trust') {
                const origin = window.location.origin
                setStep('clientTrust')
                setInfoMessage('This sign-in needs device verification. We will send you an email link to trust this device.')
                try {
                    const candidateFactors = [
                        ...(result.supportedSecondFactors ?? []),
                        ...(result.supportedFirstFactors ?? []),
                    ]
                    const emailLinkFactor = candidateFactors.find(
                        (factor) =>
                            (factor as { strategy?: string }).strategy === 'email_link' &&
                            typeof (factor as { emailAddressId?: unknown }).emailAddressId === 'string',
                    ) as unknown as { emailAddressId?: string } | undefined

                    const emailAddressId = emailLinkFactor?.emailAddressId
                    if (!emailAddressId) {
                        setFormError('This sign-in requires device verification, but no email-link factor is available.')
                        return
                    }

                    const flow = result.createEmailLinkFlow()
                    await flow.startEmailLinkFlow({
                        redirectUrl: `${origin}/email-link-callback`,
                        emailAddressId,
                    })
                    setFormError(null)
                    setInfoMessage('Check your email and open the verification link. You will be returned to the app automatically.')
                } catch {
                    setFormError('Could not send verification email. Please try again.')
                }
                return
            }

            if (result.status === 'needs_second_factor') {
                const factors = result.supportedSecondFactors ?? []
                const hasEmailCode = factors.some((f) => f.strategy === 'email_code')
                const hasTotp = factors.some((f) => f.strategy === 'totp')
                const hasBackupCode = factors.some((f) => f.strategy === 'backup_code')
                const hasPhoneCode = factors.some((f) => f.strategy === 'phone_code')

                if (hasEmailCode) {
                    await result.prepareSecondFactor({ strategy: 'email_code' })
                    setSecondFactorStrategy('email_code')
                    setInfoMessage('Enter the verification code sent to your email.')
                } else if (hasPhoneCode) {
                    await result.prepareSecondFactor({ strategy: 'phone_code' })
                    setSecondFactorStrategy('phone_code')
                    setInfoMessage('Enter the verification code sent to your phone.')
                } else if (hasTotp) {
                    setSecondFactorStrategy('totp')
                    setInfoMessage('Enter the code from your authenticator app.')
                } else if (hasBackupCode) {
                    setSecondFactorStrategy('backup_code')
                    setInfoMessage('Enter one of your backup codes.')
                } else {
                    setFormError('This account requires 2FA, but no supported 2FA method is available in this UI.')
                    return
                }

                setSecondFactorCode('')
                setStep('secondFactor')
                return
            }

            if (result.status === 'needs_first_factor') {
                setFormError('Additional sign-in verification is required, but this UI only supports password sign-in right now.')
                return
            }

            if (result.status === 'needs_identifier') {
                setFormError('Please enter your email address to sign in.')
                return
            }

            setFormError('Sign in is not complete yet. Please try again.')
        } catch (err: unknown) {
            const clerkMessage =
                typeof err === 'object' &&
                err !== null &&
                'errors' in err &&
                Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
                (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
                    ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
                      (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
                    : null

            setFormError(clerkMessage || 'Sign in failed. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleSecondFactorSubmit() {
        if (!isLoaded) return
        if (!signIn) return
        if (!secondFactorStrategy) return

        try {
            setIsSubmitting(true)
            setFormError(null)
            setInfoMessage(null)

            const attempt = await signIn.attemptSecondFactor({
                strategy: secondFactorStrategy,
                code: secondFactorCode.trim(),
            })

            if (attempt.status === 'complete') {
                await setActive({ session: attempt.createdSessionId })
                router.replace('/')
                return
            }

            setFormError('Verification is not complete yet. Please try again.')
        } catch (err: unknown) {
            const clerkMessage =
                typeof err === 'object' &&
                err !== null &&
                'errors' in err &&
                Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
                (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
                    ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
                      (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
                    : null

            setFormError(clerkMessage || 'Verification failed. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleGoogleSignIn() {
        if (!isLoaded) return

        try {
            setIsGoogleRedirecting(true)
            setFormError(null)
            const origin = window.location.origin
            await signIn.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: `${origin}/sso-callback`,
                redirectUrlComplete: `${origin}/`,
            })
        } catch (err: unknown) {
            const clerkMessage =
                typeof err === 'object' &&
                err !== null &&
                'errors' in err &&
                Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
                (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
                    ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
                      (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
                    : null

            setFormError(clerkMessage || 'Google sign in failed. Please try again.')
            setIsGoogleRedirecting(false)
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
                        <p className="text-sm text-muted-foreground mt-1">Sign in to your financial dashboard</p>
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

                {step === 'secondFactor' ? (
                    <>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="second-factor" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Verification code
                            </label>
                            <input
                                id="second-factor"
                                type="text"
                                placeholder="123456"
                                value={secondFactorCode}
                                onChange={(e) => setSecondFactorCode(e.target.value)}
                                className="h-10 px-3 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45_/_0.6)] transition-all"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                            />
                        </div>

                        <button
                            onClick={handleSecondFactorSubmit}
                            disabled={isSubmitting || !isLoaded || !secondFactorCode.trim()}
                            className="h-10 rounded-lg bg-[oklch(0.72_0.19_45)] hover:bg-[oklch(0.78_0.19_45)] text-[oklch(0.12_0_0)] text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Verifying...' : 'Verify'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep('password')
                                setSecondFactorCode('')
                                setSecondFactorStrategy(null)
                                setInfoMessage(null)
                                setFormError(null)
                            }}
                            className="h-10 rounded-lg bg-[oklch(0.20_0_0)] hover:bg-[oklch(0.24_0_0)] border border-border text-sm font-semibold text-foreground transition-colors cursor-pointer"
                        >
                            Back
                        </button>
                    </>
                ) : step === 'clientTrust' ? (
                    <>
                        <button
                            type="button"
                            onClick={handleSignIn}
                            disabled={isSubmitting || !isLoaded}
                            className="h-10 rounded-lg bg-[oklch(0.20_0_0)] hover:bg-[oklch(0.24_0_0)] border border-border text-sm font-semibold text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Sending...' : 'Resend verification email'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep('password')
                                setInfoMessage(null)
                                setFormError(null)
                            }}
                            className="h-10 rounded-lg bg-[oklch(0.20_0_0)] hover:bg-[oklch(0.24_0_0)] border border-border text-sm font-semibold text-foreground transition-colors cursor-pointer"
                        >
                            Back
                        </button>
                    </>
                ) : (
                    <>

                {/* Email field */}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Email
                    </label>
                    <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 px-3 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45_/_0.6)] transition-all"
                    />
                </div>

                {/* Password field */}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Password
                    </label>
                    <div className="relative">
                    <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-10 px-3 pr-10 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45_/_0.6)] transition-all"
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

                {/* Forgot password link */}
                <div className="flex justify-end -mt-2">
                    <button
                    onClick={() => router.push('/forgot-password')}
                    className="text-xs text-[oklch(0.72_0.19_45)] hover:text-[oklch(0.80_0.19_45)] transition-colors cursor-pointer"
                    >
                        Forgot password?
                    </button>
                </div>

                {/* Sign in button */}
                <button
                    onClick={handleSignIn}
                    disabled={isSubmitting || !isLoaded}
                    className="h-10 rounded-lg bg-[oklch(0.72_0.19_45)] hover:bg-[oklch(0.78_0.19_45)] text-[oklch(0.12_0_0)] text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                </button>

                {/* Clerk bot protection mount point (required when Clerk enables CAPTCHA challenges) */}
                <div id="clerk-captcha" />

                {/* Divider */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* SSO / other providers — prototype buttons */}
                <div className="flex flex-col gap-2">
                    <button
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleRedirecting || !isLoaded}
                    className="h-10 rounded-lg bg-[oklch(0.20_0_0)] hover:bg-[oklch(0.24_0_0)] border border-border text-sm font-medium text-foreground flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                    {isGoogleRedirecting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            Redirecting...
                        </>
                    ) : (
                        <>
                            {/* Google icon */}
                            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </>
                    )}
                    </button>
                </div>
                    </>
                )}
                </div>
                {/* Sign up link */}
                <p className="text-center text-xs text-muted-foreground">
                {"Don't have an account? "}
                <button onClick={proceedSignUp} className="text-[oklch(0.72_0.19_45)] hover:text-[oklch(0.80_0.19_45)] transition-colors font-medium cursor-pointer">
                    Sign up
                </button>
                </p>
            </div>
        </div>
    )
}