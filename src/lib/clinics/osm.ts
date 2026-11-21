import { z } from 'zod'
import type { Coords } from './geo'

export const nearbyInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(25).default(8),
})

export interface OsmClinic {
  id: string
  name: string
  kind: 'Clinic' | 'Doctor' | 'Hospital'
  address: string | null
  phone: string | null
  website: string | null
  openingHours: string | null
  lat: number
  lng: number
}

/**
 * A bounding-box search is much cheaper for Overpass than an "around" search, and the
 * public servers answer 504 when a request asks for too many resources, so the time and
 * memory limits are asked for explicitly and kept small. Results are sorted by distance
 * in the app.
 */
export function buildOverpassQuery(c: Coords, radiusKm: number): string {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.max(0.2, Math.cos((c.lat * Math.PI) / 180)))
  const south = (c.lat - dLat).toFixed(5)
  const north = (c.lat + dLat).toFixed(5)
  const west = (c.lng - dLng).toFixed(5)
  const east = (c.lng + dLng).toFixed(5)
  return `[out:json][timeout:15][maxsize:33554432];
nwr["amenity"~"^(clinic|doctors|hospital)$"](${south},${west},${north},${east});
out center tags qt 120;`
}

const tags = z.record(z.string(), z.string())
const overpassSchema = z.object({
  elements: z.array(z.object({
    type: z.enum(['node', 'way', 'relation']),
    id: z.number(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    center: z.object({ lat: z.number(), lon: z.number() }).optional(),
    tags: tags.optional(),
  })),
})

function clean(v: string | undefined, max = 200): string | null {
  const t = v?.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

function address(t: Record<string, string>): string | null {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')
  const parts = [t['addr:full'], street, t['addr:suburb'], t['addr:city'] ?? t['addr:town'] ?? t['addr:village'], t['addr:postcode']].filter(Boolean)
  return clean(parts.join(', '))
}

/** Only unambiguous http(s) links are kept; anything else is dropped. */
function safeUrl(v: string | undefined): string | null {
  if (!v) return null
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch { return null }
}

export function parseOverpass(json: unknown): OsmClinic[] {
  const parsed = overpassSchema.safeParse(json)
  if (!parsed.success) throw new Error('Unexpected reply from the map data service')
  const out: OsmClinic[] = []
  const seen = new Set<string>()
  for (const el of parsed.data.elements) {
    const t = el.tags ?? {}
    const name = clean(t['name'] ?? t['name:en'], 120)
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (!name || lat === undefined || lng === undefined) continue
    const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    const amenity = t['amenity']
    out.push({
      id: `${el.type}/${el.id}`,
      name,
      kind: amenity === 'hospital' ? 'Hospital' : amenity === 'doctors' ? 'Doctor' : 'Clinic',
      address: address(t),
      phone: clean(t['phone'] ?? t['contact:phone'], 40),
      website: safeUrl(t['website'] ?? t['contact:website']),
      openingHours: clean(t['opening_hours'], 120),
      lat, lng,
    })
  }
  return out
}
