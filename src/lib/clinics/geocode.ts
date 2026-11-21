import { z } from 'zod'
import type { PlaceMatch } from './geo'

export const placeSearchSchema = z.object({ query: z.string().trim().min(2, 'Type an area, city or pincode').max(120) })

const nominatimSchema = z.array(z.object({ display_name: z.string(), lat: z.string(), lon: z.string() }))

export function parseNominatim(json: unknown): PlaceMatch[] {
  const parsed = nominatimSchema.safeParse(json)
  if (!parsed.success) throw new Error('Unexpected reply from the place search service')
  return parsed.data
    .map((r) => ({ label: r.display_name.slice(0, 160), lat: Number(r.lat), lng: Number(r.lon) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180)
}
