import type { RedFlag } from './schemas'

export type RedFlagCategory =
  | 'cardiac' | 'respiratory' | 'neurological' | 'bleeding'
  | 'allergic' | 'consciousness' | 'mental_health' | 'pediatric_fever'

interface Rule { category: RedFlagCategory; label: string; pattern: RegExp }

/**
 * Deterministic first line of defence. These rules are deliberately broad:
 * a false alarm costs a dismissed modal, a missed alarm costs far more.
 * They run in the browser (instant modal) and again on the server, and the
 * model is never allowed to downgrade a rule-based result.
 */
const RULES: Rule[] = [
  { category: 'cardiac', label: 'Chest pain or pressure',
    pattern: /\b(chest (pain|pressure|tightness|heaviness)|pressure (in|on) (my |the )?chest|crushing (pain|feeling))\b/i },
  { category: 'cardiac', label: 'Pain spreading to arm, jaw or back with chest symptoms',
    pattern: /\b(pain|pressure)\b.{0,40}\b(left arm|jaw)\b/i },
  { category: 'respiratory', label: 'Severe shortness of breath',
    pattern: /\b(can'?t|cannot|unable to|struggling to|hard to|difficulty|trouble) (breathe|breathing|catch (my|a) breath)\b|\b(severe|sudden|acute) (shortness of breath|breathlessness)\b|\bgasping\b/i },
  { category: 'neurological', label: 'Facial drooping or sudden weakness',
    pattern: /\b(face|facial|mouth) (is )?(droop\w*|sagging|numb)\b|\bsudden(ly)? (weakness|numbness)\b|\b(weakness|numbness) (on|in) (one|my (left|right)) side\b/i },
  { category: 'neurological', label: 'Sudden speech or vision change',
    pattern: /\b(slurred|slurring) speech\b|\bsudden(ly)? (lost|loss of|blurred|double) (vision|speech)\b|\bcan'?t (speak|talk) properly\b/i },
  { category: 'neurological', label: 'Sudden severe headache',
    pattern: /\b(worst headache of my life|thunderclap headache|sudden(ly)? (severe|terrible) headache)\b/i },
  { category: 'neurological', label: 'Seizure',
    pattern: /\b(seizure|convulsion|fitting)\b/i },
  { category: 'consciousness', label: 'Fainting or loss of consciousness',
    pattern: /\b(passed out|blacked out|fainted|lost consciousness|unresponsive)\b/i },
  { category: 'bleeding', label: 'Heavy or uncontrolled bleeding',
    pattern: /\b(heavy|uncontrolled|won'?t stop|severe) bleeding\b|\bbleeding (heavily|won'?t stop)\b|\bvomiting blood\b|\bcoughing (up )?blood\b|\bblood in (my )?(stool|vomit)\b/i },
  { category: 'allergic', label: 'Possible severe allergic reaction',
    pattern: /\banaphyla\w*\b|\b(throat|tongue|lips?) (is |are )?(swelling|swollen|closing)\b|\bswelling of (the )?(throat|tongue|lips)\b/i },
  { category: 'mental_health', label: 'Thoughts of self-harm or suicide',
    pattern: /\b(suicid\w*|kill myself|end my life|want to die|hurt myself|self[- ]harm)\b/i },
  { category: 'pediatric_fever', label: 'High fever in an infant',
    pattern: /\b(newborn|infant|baby|\d+[- ]?(week|month)s?[- ]old)\b.{0,60}\b(fever|temperature)\b|\b(fever|temperature)\b.{0,60}\b(newborn|infant|baby)\b/i },
]

const NEGATORS = /\b(no|not|never|without|denies|denied|don'?t have|doesn'?t have|didn'?t have|free of)\s+(\w+\s+){0,2}$/i

export interface RedFlagScan {
  flags: RedFlag[]
  categories: RedFlagCategory[]
  emergency: boolean
}

export function scanForRedFlags(transcript: string): RedFlagScan {
  const flags: RedFlag[] = []
  const categories = new Set<RedFlagCategory>()

  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g')
    for (const match of transcript.matchAll(re)) {
      const start = match.index ?? 0
      const before = transcript.slice(Math.max(0, start - 30), start)
      // Skip clear negations ("no chest pain"); a sentence break resets the window.
      const window = before.split(/[.;,!?\n]/).pop() ?? ''
      if (NEGATORS.test(window)) continue
      flags.push({ label: rule.label, evidence: match[0].slice(0, 200), source: 'rule' })
      categories.add(rule.category)
      break
    }
  }
  return { flags, categories: [...categories], emergency: flags.length > 0 }
}
