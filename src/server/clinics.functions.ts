import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from './auth-middleware'
import { nearbyInputSchema, type OsmClinic } from '@/lib/clinics/osm'
import { placeSearchSchema } from '@/lib/clinics/geocode'
import type { PlaceMatch } from '@/lib/clinics/geo'

export interface NearbyResult { clinics: OsmClinic[]; source: 'openstreetmap' }

/**
 * Real clinics near the patient from OpenStreetMap. The browser sends coordinates
 * already rounded to ~1 km; they are used for one query and never stored.
 */
export const findNearbyClinics = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator(nearbyInputSchema)
  .handler(async ({ data, context }): Promise<NearbyResult> => {
    const { rateLimit } = await import('./rate-limit.server')
    const { fetchOverpassCached } = await import('./overpass.server')
    rateLimit(context.userId, 'nearby', 12, 60_000)
    const lat = Math.round(data.lat * 100) / 100
    const lng = Math.round(data.lng * 100) / 100
    const clinics = await fetchOverpassCached({ lat, lng }, data.radiusKm)
    return { clinics, source: 'openstreetmap' }
  })

/** Fallback when the browser cannot share a location: look up an area, city or pincode. */
export const searchPlaces = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator(placeSearchSchema)
  .handler(async ({ data, context }): Promise<{ places: PlaceMatch[] }> => {
    const { rateLimit } = await import('./rate-limit.server')
    const { searchPlace } = await import('./geocode.server')
    rateLimit(context.userId, 'geocode', 10, 60_000)
    return { places: await searchPlace(data.query) }
  })
