/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Public address of the deployed site, for canonical links and social previews. */
  readonly VITE_SITE_URL?: string
  readonly VITE_OPERATOR_NAME?: string
  readonly VITE_CONTACT_EMAIL?: string
  readonly VITE_GRIEVANCE_EMAIL?: string
  /** Set to "true" once a lawyer has reviewed the privacy policy and terms. Hides the draft banner. */
  readonly VITE_LEGAL_REVIEWED?: string
  /** Script URL of a Plausible-compatible analytics provider. Leave empty to disable analytics. */
  readonly VITE_ANALYTICS_SRC?: string
  readonly VITE_ANALYTICS_DOMAIN?: string
  readonly VITE_ANALYTICS_EXCLUDE?: string
  /** Cloudflare Turnstile site key. Leave empty to disable the CAPTCHA. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
