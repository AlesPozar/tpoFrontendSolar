'use client'

import { useEffect, useState, useRef, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SolaraLogo } from '@/components/logo'
import { Eye, EyeOff, Loader2 } from 'lucide-react'



//clerk imports
import { useSignUp } from '@clerk/nextjs/legacy'
import { useUser, useAuth } from "@clerk/nextjs";


/*
TODO
implementiri vse gunkcionalnosti od clerka




*/

export default function SignInPage() {
    const router = useRouter()
    const initialPassword = 'password'
    //te dva sta neki za google sign up, da se ne spet redirecta ko se vrne z googla, ker google redirecta nazaj na sign up page, in če je ta useEffect se bo spet redirectal na google, zato je treba neki flag da se to prepreči
    const oauthInitHandledRef = useRef(false)

    const [email, setEmail] = useState('demo@solara.app')
    const [showPassword, setShowPassword] = useState(false) //show password je boolean state spremenljivka, setShowPassword pa funkcija ki se jo bo klicalo za nastavitev, primarno je false
    const [password, setPassword] = useState(initialPassword)
    const [repeatPassword, setRepeatPassword] = useState(initialPassword)
    const [passwordStrength, setPasswordStrength] = useState(() => checkPasswordStrength(initialPassword))
    const [verificationCode, setVerificationCode] = useState('')
    const [pendingVerification, setPendingVerification] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false)
    const { user, isLoaded: isUserLoaded } = useUser() //dobi trenutnega userja, če je prijavljen, sicer null

    //če je user že prijavljen, ga preusmeri na domačo stran
    useEffect(() => {
        
        //ce ni nalozen user, ne delaj nič
        if (!isUserLoaded || !user) return

        const params = new URLSearchParams(window.location.search)
        const isOAuthComplete = params.get('oauth') === 'complete'

        //ce je ze nalozen user
        if (!isOAuthComplete) {
            router.replace('/')
            return
        }

        //ce je pa nalozen user in je pač prišel z googla
        if (oauthInitHandledRef.current) return
        oauthInitHandledRef.current = true

        //inicializiraj userja v supabase z default valuto, to je potrebno narediti tukaj, ker ko se user vrne z googla, se bo spet renderala sign up page, in če ne inicializiramo userja tukaj, potem user ne bo imel nastavljene def valut in bojo mu padale napake ko bo hotel gledat dashboarde in podobno
        ;(async () => {
            try {
                await initializeUserToSupabase()
            } catch (error) {
                console.error(error)
            } finally {
                router.replace('/')
            }
        })()
    }, [isUserLoaded, user, router])

    //routing
    function proceedSignIn() {
        router.push('/sign-in')
    }
    //bonus functions, 

    //CLERK SETUP
    const { signUp, setActive, isLoaded } = useSignUp()
    const { getToken } = useAuth()


    //se uporabi s clerkom
    //vrne true če se password in repeat password polji ujemata, sicer false
    function checkPasswordsMatch() {
        return password === repeatPassword
    }

    function checkPasswordStrength(passwordValue: string) {
        // Preprosta ocena moči gesla: dolžina, velika/mala črka, številka, poseben znak
        let strength = 0

        if (passwordValue.length >= 8) strength++
        if (/[A-Z]/.test(passwordValue)) strength++
        if (/[a-z]/.test(passwordValue)) strength++
        if (/\d/.test(passwordValue)) strength++
        if (/[^A-Za-z0-9]/.test(passwordValue)) strength++

        return strength
    }

    function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
        const nextPassword = event.target.value
        setPassword(nextPassword)
        setPasswordStrength(checkPasswordStrength(nextPassword))
    }

    function isLongEnough() {
        //bo displayu rdeč text ko password ne bo dovolj doug
        return password.length >= 8
    }


    {/* sign up za obicn mail */}
    async function handleSignUp() {
        if (!isLoaded) return

        setFormError(null)

        if (!checkPasswordsMatch()) {
            setFormError('Passwords do not match.')
            return
        }

        if (!isLongEnough()) {
            setFormError('Password must be at least 8 characters long.')
            return
        }

        try {
            setIsSubmitting(true)
            await signUp.create({
                emailAddress: email,
                password,
            })

            await signUp.prepareEmailAddressVerification({
                strategy: 'email_code',
            })

            setPendingVerification(true)
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

            setFormError(clerkMessage || 'Sign up failed. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }


    //funkcija ki poveze z supabaseom, iniciallizira userja v bazi z default valuto EUR, po tem ko se uporabnik prjav
    async function initializeUserToSupabase(){
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if(!supabaseUrl){
            throw new Error('Manka ti NEXT_PUBLIC_SUPABASE_URL env variable, dodej jo')
        }

        //dobi jwt token
        const token = await getToken({ template: 'supabase' })
        if(!token){
            throw new Error('Ne more dobit JWT tokena od Clerka, nekaj je šlo narobe')
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/set-currency`, {
            //metoda
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`, //iz jwt tokna pol dobi userja to je id
            },
            body: JSON.stringify({ initializeOnly: true }), //pošlje initializeOnly flag, da funkcija ve da naj samo inicializira z default valuto, ne da spreminja če je že nastavljeno
        })

        if (!response.ok) {
            const details = await response.text()
            throw new Error(`Napaka pri inicializaviji userja z def valuto. ${details}`)
        }
        else {
            console.log('Inicializacija userja z def valuto je bila uspešna')
        }
    }






    {/* potrdi email verifikacijo, pa setta up sete abd shii */}
    async function handleVerifyEmail() {
        if (!isLoaded) return

        try {
            setIsSubmitting(true)
            setFormError(null)

            const result = await signUp.attemptEmailAddressVerification({
                code: verificationCode,
            })

            //ko je proces verifikacije res zaključen
            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId })

                //inicializiraj userja v supabase z default valuto
                await initializeUserToSupabase()
                router.push('/')
                return
            }

            setFormError('Verification is not complete yet. Try again.')
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

    {/* sign up za google */}
    async function handleGoogleSignUp() {
        if (!isLoaded) return

        try {
            setIsGoogleRedirecting(true)
            setFormError(null)
            const origin = window.location.origin
            await signUp.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: `${origin}/sso-callback`,
                redirectUrlComplete: `${origin}/sign-up?oauth=complete`,
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

            setFormError(clerkMessage || 'Google sign up failed. Please try again.')
            setIsGoogleRedirecting(false)
        }
    }

    // View

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-sm flex flex-col gap-8">
                {/* Logo + brand */}
                <div className="flex flex-col items-center gap-3">
                    <SolaraLogo size={48} />
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Solar</h1>
                        <p className="text-sm text-muted-foreground mt-1">Sign up to your financial dashboard</p>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
                {formError && (
                    <div className="text-xs rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 px-3 py-2">
                        {formError}
                    </div>
                )}

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
                    <label htmlFor="password" className="text-xs font-medium text-muted-foreground tracking-wide">
                        PASSWORD <div className="text-xs">(must be at least 8 characters)</div>
                    </label>
                    <div className="relative">
                    <input
                        onChange={handlePasswordChange}
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
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
                    <div className="text-xs">current strength: {passwordStrength}/5</div>
                </div>

                {/* Password field */}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="repeat-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Repeat Password
                    </label>
                    <div className="relative">
                    <input
                        id="repeat-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
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

                {/* Sign up button */}
                <button
                    onClick={handleSignUp}
                    disabled={isSubmitting || pendingVerification || !isLoaded}
                    className="h-10 rounded-lg bg-[oklch(0.72_0.19_45)] hover:bg-[oklch(0.78_0.19_45)] text-[oklch(0.12_0_0)] text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Working...' : pendingVerification ? 'Check your email' : 'Sign Up'}
                </button>

                {/* sneekey capcha in the pocket */}
                <div id="clerk-captcha" />

                
                
                {pendingVerification && (
                    <div className="flex flex-col gap-2 pt-1">
                        <label htmlFor="verification-code" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Verification code
                        </label>
                        <input
                            id="verification-code"
                            type="text"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            placeholder="123456"
                            className="h-10 px-3 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45_/_0.6)] transition-all"
                        />
                        <button
                            onClick={handleVerifyEmail}
                            disabled={isSubmitting || !verificationCode.trim()}
                            className="h-10 rounded-lg bg-[oklch(0.20_0_0)] hover:bg-[oklch(0.24_0_0)] border border-border text-sm font-semibold text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Verifying...' : 'Verify Email'}
                        </button>
                    </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* SSO / other providers — prototype buttons */}
                <div className="flex flex-col gap-2">
                    <button
                    onClick={handleGoogleSignUp}
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
                </div>
                {/* Sign up link */}
                <p className="text-center text-xs text-muted-foreground">
                {"Don't have an account? "}
                <button onClick={proceedSignIn} className="text-[oklch(0.72_0.19_45)] hover:text-[oklch(0.80_0.19_45)] transition-colors font-medium cursor-pointer">
                    Sign in
                </button>
                </p>
            </div>
        </div>
    )
}