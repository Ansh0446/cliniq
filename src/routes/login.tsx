import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Wordmark } from '@/components/wordmark'
import { SiteFooter } from '@/components/site-footer'
import { Turnstile, captchaEnabled } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Callout } from '@/components/ui/form'
import { homeFor, loadAuthState } from '@/lib/auth'
import { pageHead } from '@/lib/site'
import { getBrowserSupabase } from '@/lib/supabase'
import { emailError, nameError, passwordError } from '@/lib/validators'

export const Route = createFileRoute('/login')({
  head: () => pageHead({ title: 'Sign in', description: 'Sign in to ClinIQ as a patient, clinician or clinic admin.', path: '/login' }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: typeof s.redirect === 'string' ? s.redirect.slice(0, 500) : undefined }),
  component: Login,
})

function safeRedirect(target: string | undefined): string | null {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : null
}

type Errors = Partial<Record<'name' | 'email' | 'password' | 'agree' | 'captcha', string>>

function Login() {
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [trap, setTrap] = useState('') // honeypot: real people never see or fill this
  const [captcha, setCaptcha] = useState('')
  const [captchaTry, setCaptchaTry] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const shownAt = useRef(Date.now())

  async function afterSignIn() {
    const { roles } = await loadAuthState()
    router.history.push(safeRedirect(redirect) ?? homeFor(roles))
  }

  // Handles the return trip from Google OAuth and already-signed-in visitors.
  useEffect(() => {
    const supabase = getBrowserSupabase()
    void supabase.auth.getSession().then(({ data }) => { if (data.session) void afterSignIn() })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') void afterSignIn() })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function validate(): Errors {
    const e: Errors = {}
    if (mode === 'signup') {
      const n = nameError(name, { required: true }); if (n) e.name = n
      if (!agree) e.agree = 'Please agree to the terms and privacy policy to create an account.'
    }
    const m = emailError(email, { required: true }); if (m) e.email = m
    if (mode === 'signup') { const p = passwordError(password, email); if (p) e.password = p }
    else if (!password) e.password = 'Enter your password.'
    if (captchaEnabled && !captcha) e.captcha = 'Please complete the human check.'
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setError(null); setNotice(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    // Bots tend to fill hidden fields and submit instantly. Pretend it worked and do nothing.
    if (mode === 'signup' && (trap || Date.now() - shownAt.current < 1500)) {
      setNotice('Check your email for a confirmation link, then sign in.')
      return
    }

    setBusy(true)
    const supabase = getBrowserSupabase()
    const captchaToken = captchaEnabled ? captcha : undefined
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password, options: { data: { full_name: name.trim() }, captchaToken },
        })
        if (error) throw error
        if (!data.session) { setNotice('Check your email for a confirmation link, then sign in.'); return }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken } })
        if (error) throw error
      }
      await afterSignIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setCaptcha(''); setCaptchaTry((n) => n + 1) // a CAPTCHA token works once
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    const { error } = await getBrowserSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}` },
    })
    if (error) setError(error.message)
  }

  function switchMode() {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setErrors({}); setError(null); setNotice(null); setAgree(false); shownAt.current = Date.now()
  }

  return (
    <div>
      <main className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-sm flex-col justify-center px-4 py-12">
        <Wordmark className="mb-8" />
        <h1 className="text-2xl font-bold">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'signin' ? 'Patients, clinicians and clinic admins all sign in here.' : 'New accounts start as patients. Clinicians join through an invite from their clinic.'}
        </p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          {mode === 'signup' && <Field id="name" label="Full name" autoComplete="name" maxLength={120} value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />}
          <Field id="email" type="email" label="Email" autoComplete="email" inputMode="email" maxLength={160} value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
          <Field id="password" type="password" label="Password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} maxLength={72} value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'signup' && <p className="-mt-2 text-xs text-muted">At least 8 characters.</p>}

          {mode === 'signup' && (
            <>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-5 accent-teal-600" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-invalid={errors.agree ? true : undefined} />
                <span>I agree to the <Link to="/terms" target="_blank" className="font-semibold text-teal-700 underline">terms of use</Link> and have read the <Link to="/privacy" target="_blank" className="font-semibold text-teal-700 underline">privacy policy</Link>.</span>
              </label>
              {errors.agree && <p className="text-sm text-urgent">{errors.agree}</p>}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Website<input tabIndex={-1} autoComplete="off" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
              </div>
            </>
          )}

          <Turnstile resetKey={captchaTry + (mode === 'signup' ? 1000 : 0)} onToken={setCaptcha} onError={setError} />
          {errors.captcha && <p className="text-sm text-urgent">{errors.captcha}</p>}

          {error && <p role="alert" className="text-sm text-urgent">{error}</p>}
          {notice && <Callout tone="success">{notice}</Callout>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait' : mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        <Button variant="secondary" className="w-full" onClick={google}>Continue with Google</Button>
        <p className="mt-2 text-xs text-muted">By continuing with Google you agree to the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.</p>

        <button type="button" className="mt-6 text-left text-sm font-medium text-teal-700 hover:underline" onClick={switchMode}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </main>
      <SiteFooter />
    </div>
  )
}
