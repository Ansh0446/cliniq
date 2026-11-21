function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable ${name}`)
  return v
}

export const serverEnv = {
  get supabaseUrl() { return required('SUPABASE_URL') },
  get supabaseAnonKey() { return required('SUPABASE_ANON_KEY') },
  get geminiApiKey() { return required('GEMINI_API_KEY') },
  get geminiModel() { return process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
}
