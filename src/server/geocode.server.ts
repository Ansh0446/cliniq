import { parseNominatim } from '@/lib/clinics/geocode'
import type { PlaceMatch } from '@/lib/clinics/geo'

const ENDPOINT = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const cache = new Map<string, { at: number; value: PlaceMatch[] }>()

/** OpenStreetMap's free geocoder. Its policy asks for an identifying user agent and about one request per second. */
export async function searchPlace(query: string): Promise<PlaceMatch[]> {
  const key = query.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.value
  const url = `${ENDPOINT}?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '5' })}`
  const res = await fetch(url, { headers: { 'user-agent': 'ClinIQ/0.1 (clinic finder)', 'accept-language': 'en' }, signal: AbortSignal.timeout(10_000) })
  if (res.status === 429) throw new Error('The place search is busy. Try again in a minute.')
  if (!res.ok) throw new Error('Place search is not available right now.')
  const value = parseNominatim(await res.json())
  cache.set(key, { at: Date.now(), value })
  if (cache.size > 300) cache.delete(cache.keys().next().value as string)
  return value
}
