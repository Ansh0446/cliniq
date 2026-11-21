import { buildOverpassQuery, parseOverpass, type OsmClinic } from '@/lib/clinics/osm'
import type { Coords } from '@/lib/clinics/geo'

/**
 * Tried in order; the first answer wins. The public servers are shared and often busy:
 * 504 means "too much load right now". overpass.kumi.systems is the old name of
 * overpass.private.coffee, so the current name is used.
 */
const ENDPOINTS = [
  process.env.OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
].filter((u): u is string => Boolean(u))
const TTL_MS = 10 * 60_000
const cache = new Map<string, { at: number; value: OsmClinic[] }>()

async function query(endpoint: string, body: string): Promise<OsmClinic[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'ClinIQ/0.1 (clinic finder)' },
    body: new URLSearchParams({ data: body }),
    signal: AbortSignal.timeout(14_000),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return parseOverpass(await res.json())
}

export async function fetchOverpassCached(c: Coords, radiusKm: number): Promise<OsmClinic[]> {
  const key = `${c.lat},${c.lng},${radiusKm}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const body = buildOverpassQuery(c, radiusKm)
  let value: OsmClinic[] | null = null
  const failures: string[] = []
  for (const endpoint of ENDPOINTS) {
    try { value = await query(endpoint, body); break } catch (e) {
      // Say why, in the server terminal, so a failure can be diagnosed instead of guessed at.
      const host = new URL(endpoint).host
      const cause = e instanceof Error && e.cause && typeof e.cause === 'object' ? (e.cause as { code?: string; message?: string }) : null
      const why = e instanceof Error ? `${e.message}${cause ? ` (${cause.code ?? cause.message})` : ''}` : 'unknown error'
      failures.push(`${host}: ${why}`)
      console.error(`[overpass] ${host} failed: ${why}`)
    }
  }
  if (!value) {
    const hint = process.env.NODE_ENV === 'production' ? '' : ` [${failures.join(' | ')}]`
    throw new Error(`The map data service could not be reached. Try again in a minute, or search by area instead.${hint}`)
  }
  cache.set(key, { at: Date.now(), value })
  if (cache.size > 200) cache.delete(cache.keys().next().value as string)
  return value
}