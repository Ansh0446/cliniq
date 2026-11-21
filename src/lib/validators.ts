/** Small, dependency-free checks shared by the forms. Each returns an error message or null. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emailError(v: string, opts: { required?: boolean } = {}): string | null {
  const t = v.trim()
  if (!t) return opts.required ? 'Enter your email address.' : null
  if (t.length > 160 || !EMAIL.test(t)) return 'Enter a valid email address, like name@example.com.'
  return null
}

/** Digits with optional + ( ) - and spaces; 7 to 15 digits (international maximum). */
export function phoneError(v: string, opts: { required?: boolean } = {}): string | null {
  const t = v.trim()
  if (!t) return opts.required ? 'Enter a phone number.' : null
  if (!/^\+?[\d\s().-]+$/.test(t)) return 'Use only digits, spaces and + ( ) -.'
  const digits = t.replace(/\D/g, '').length
  if (digits < 7 || digits > 15) return 'A phone number has 7 to 15 digits.'
  return null
}

export function passwordError(password: string, email = ''): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 72) return 'Use 72 characters or fewer.'
  if (email && password.toLowerCase() === email.trim().toLowerCase()) return 'Your password cannot be your email address.'
  if (/^(.)\1+$/.test(password)) return 'Choose a password that is not a single repeated character.'
  return null
}

export function nameError(v: string, opts: { required?: boolean; max?: number } = {}): string | null {
  const t = v.trim()
  const max = opts.max ?? 120
  if (!t) return opts.required ? 'Enter a name.' : null
  if (t.length < 2) return 'Enter at least 2 characters.'
  if (t.length > max) return `Use ${max} characters or fewer.`
  return null
}

export function coordsError(lat: string, lng: string): string | null {
  const a = lat.trim(), b = lng.trim()
  if (!a && !b) return null
  const la = Number(a), lo = Number(b)
  if (!a || !b || !Number.isFinite(la) || !Number.isFinite(lo)) return 'Enter both latitude and longitude as numbers.'
  if (Math.abs(la) > 90) return 'Latitude must be between -90 and 90.'
  if (Math.abs(lo) > 180) return 'Longitude must be between -180 and 180.'
  return null
}
