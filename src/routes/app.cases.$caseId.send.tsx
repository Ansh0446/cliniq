import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ExternalLink, FileText, LocateFixed, MapPin, Phone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, buttonStyles } from '@/components/ui/button'
import { Callout, Section, Spinner } from '@/components/ui/form'
import { SPECIALTIES } from '@/lib/clinical/constants'
import { directionsUrl, formatKm, getPosition, haversineKm, LocationError, roundCoords, type Coords } from '@/lib/clinics/geo'
import type { OsmClinic } from '@/lib/clinics/osm'
import { getCase, listClinics, sendCase, type ClinicRow } from '@/lib/data'
import { useAsync } from '@/lib/hooks/use-async'
import { casePath, parseStructured } from '@/lib/intake'
import { findNearbyClinics, searchPlaces } from '@/server/clinics.functions'
import type { PlaceMatch } from '@/lib/clinics/geo'
import { privateHead } from '@/lib/site'
import { AskAssistantButton } from '@/components/assistant/ask-button'

export const Route = createFileRoute('/app/cases/$caseId/send')({
  head: () => privateHead('Choose a clinic'), component: SendPage })

const SHARED = [
  'Your name, age, sex, blood group and emergency contact',
  'Your allergies, long-term conditions and medicines',
  'The summary you just confirmed, including warning signs and suggested urgency',
  'What you originally said, word for word',
]
const specLabel = (slug: string) => SPECIALTIES.find((s) => s.slug === slug)?.label ?? slug

function SendPage() {
  const { caseId } = Route.useParams()
  const navigate = useNavigate()
  const row = useAsync(() => getCase(caseId), [caseId])
  const clinics = useAsync(listClinics, [])

  const [coords, setCoords] = useState<Coords | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [osm, setOsm] = useState<{ clinics: OsmClinic[] } | null>(null)
  const [osmError, setOsmError] = useState<string | null>(null)
  const [placeQuery, setPlaceQuery] = useState('')
  const [places, setPlaces] = useState<PlaceMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [anySpecialty, setAnySpecialty] = useState(false)
  const [selected, setSelected] = useState<ClinicRow | null>(null)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const ex = row.data ? parseStructured(row.data.structured) : null
  const specialty = ex?.triage.suggestedSpecialty

  const registered = useMemo(() => {
    const list = (clinics.data ?? [])
      .filter((c) => anySpecialty || !specialty || c.specialties.includes(specialty))
      .map((c) => ({ c, km: coords && c.lat != null && c.lng != null ? haversineKm(coords, { lat: c.lat, lng: c.lng }) : null }))
    return list.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || a.c.name.localeCompare(b.c.name))
  }, [clinics.data, coords, anySpecialty, specialty])

  const nearby = useMemo(
    () => (osm && coords ? osm.clinics.map((o) => ({ o, km: haversineKm(coords, o) })).sort((a, b) => a.km - b.km).slice(0, 25) : []),
    [osm, coords],
  )

  async function loadNearby(here: Coords) {
    setCoords(here); setOsmError(null); setLocating(true)
    try {
      const r = await findNearbyClinics({ data: { ...roundCoords(here), radiusKm: 5 } })
      setOsm({ clinics: r.clinics })
    } catch (e) { setOsmError(e instanceof Error ? e.message : 'Could not load nearby clinics.') }
    finally { setLocating(false) }
  }

  async function locate() {
    setLocating(true); setLocError(null); setOsmError(null); setPlaces(null)
    try {
      const here = await getPosition()
      await loadNearby(here)
    } catch (e) {
      setLocError(e instanceof LocationError ? e.message : 'Could not get your location.')
      setLocating(false)
    }
  }

  async function searchArea() {
    setSearching(true); setPlaceError(null); setPlaces(null)
    try {
      const r = await searchPlaces({ data: { query: placeQuery } })
      setPlaces(r.places)
      if (r.places.length === 0) setPlaceError('No place matched that. Try a nearby town or a pincode.')
    } catch (e) { setPlaceError(e instanceof Error ? e.message : 'Place search failed.') }
    finally { setSearching(false) }
  }

  async function send() {
    if (!selected) return
    setSending(true); setSendError(null)
    try { await sendCase(caseId, selected.id); await navigate({ to: casePath(caseId, 'detail') }) }
    catch (e) { setSendError(e instanceof Error ? e.message : 'Could not send.') } finally { setSending(false) }
  }

  if (row.loading && !row.data) return <Spinner label="Loading" />
  if (row.error || !row.data) return <Callout tone="danger" title="Could not open this case">{row.error}</Callout>
  if (row.data.status !== 'confirmed') {
    return (
      <Callout tone="info" title={row.data.status === 'draft' ? 'Confirm your summary first' : 'This case is already with a clinic'}>
        <Link to={row.data.status === 'draft' ? '/app/cases/$caseId/review' : '/app/cases/$caseId'} params={{ caseId }} className="font-semibold underline">
          {row.data.status === 'draft' ? 'Go to review' : 'View case'}
        </Link>
      </Callout>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Where should this go?</h1>
        <p className="mt-1 text-sm text-muted">Your summary is confirmed. Send it to a clinic on ClinIQ, or download a slip to hand to any clinic in person. Nothing is shared until you choose.</p>
        <p className="mt-2 text-sm"><AskAssistantButton prompt="How does sending work?">How does sending work?</AskAssistantButton> <span className="text-muted">·</span> <AskAssistantButton prompt="Why is my clinic not listed?">Clinic not listed?</AskAssistantButton></p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/app/cases/$caseId/slip" params={{ caseId }} className={buttonStyles({ variant: 'secondary' })}><FileText className="size-4" aria-hidden /> Download intake slip</Link>
        <Button variant="secondary" onClick={locate} disabled={locating}><LocateFixed className="size-4" aria-hidden /> {locating ? 'Finding you' : coords ? 'Refresh my location' : 'Use my location'}</Button>
      </div>
      {locError && <Callout tone="warn" title="Could not get your location">{locError} You can search for your area instead.</Callout>}

      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void searchArea() }}>
        <div className="min-w-56 flex-1">
          <label htmlFor="area" className="text-sm font-medium">Or search by area, city or pincode</label>
          <input id="area" value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="For example: Sector 62, Noida"
            className="mt-1.5 h-10 w-full rounded-control border border-line bg-panel px-3 text-sm" />
        </div>
        <Button type="submit" variant="secondary" disabled={searching || placeQuery.trim().length < 2}>{searching ? 'Searching' : 'Search'}</Button>
      </form>
      {placeError && <Callout tone="warn">{placeError}</Callout>}
      {places && places.length > 0 && (
        <ul className="space-y-1.5 rounded-surface border border-line bg-panel p-2" aria-label="Matching places">
          {places.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button type="button" className="w-full rounded-control px-3 py-2 text-left text-sm hover:bg-teal-50" onClick={() => { setPlaces(null); setLocError(null); void loadNearby({ lat: p.lat, lng: p.lng }) }}>{p.label}</button>
            </li>
          ))}
        </ul>
      )}

      <Section title="Send digitally: clinics on ClinIQ" hint="A doctor at the clinic reads your summary before you arrive.">
        {specialty && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-teal-600" checked={anySpecialty} onChange={(e) => setAnySpecialty(e.target.checked)} />
            Show all specialties (matching: {specLabel(specialty)})
          </label>
        )}
        {clinics.loading && !clinics.data && <Spinner label="Loading clinics" />}
        {clinics.error && <Callout tone="danger">{clinics.error}</Callout>}
        {clinics.data && registered.length === 0 && <p className="text-sm text-muted">No ClinIQ clinic matches {specialty ? specLabel(specialty) : 'this'} yet. Try "Show all specialties", or use a nearby clinic below with the slip.</p>}
        <ul className="space-y-3">
          {registered.map(({ c, km }) => (
            <li key={c.id} className={`rounded-control border p-4 ${selected?.id === c.id ? 'border-teal-600 bg-teal-50' : 'border-line'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  {c.address && <p className="text-sm text-muted">{c.address}</p>}
                  <p className="mt-1 text-xs text-muted">{c.specialties.slice(0, 4).map(specLabel).join(', ')}{c.specialties.length > 4 ? ` +${c.specialties.length - 4} more` : ''}</p>
                  {km != null && <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700"><MapPin className="size-3.5" aria-hidden />{formatKm(km)} away</p>}
                </div>
                <Button size="sm" variant={selected?.id === c.id ? 'primary' : 'secondary'} onClick={() => { setSelected(c); setConsent(false) }}>{selected?.id === c.id ? 'Selected' : 'Choose'}</Button>
              </div>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="space-y-3 rounded-control border border-teal-600 bg-panel p-4">
            <h3 className="font-semibold">Send to {selected.name}</h3>
            <p className="text-sm">The doctors at this clinic will be able to see:</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">{SHARED.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="text-sm text-muted">They cannot see your other cases. You can follow progress on your case page.</p>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 accent-teal-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree to share this information with {selected.name}.</span>
            </label>
            {sendError && <Callout tone="danger">{sendError}</Callout>}
            <Button size="lg" disabled={!consent || sending} onClick={send}>{sending ? 'Sending' : `Send to ${selected.name}`}</Button>
          </div>
        )}
      </Section>

      <Section title="Other clinics near you" hint="These clinics are not on ClinIQ, so you cannot send your summary to them digitally. Download your slip and hand it over in person.">
        {!coords && !locating && <p className="text-sm text-muted">Tap "Use my location" or search for your area above to see real clinics around you. Your exact location stays in your browser.</p>}
        {locating && <Spinner label="Looking for clinics" />}
        {osmError && <Callout tone="warn" title="Could not load nearby clinics">{osmError}</Callout>}
        {osm && nearby.length === 0 && !osmError && <p className="text-sm text-muted">No clinics were found within 5 km in the map data. Map coverage varies by area.</p>}
        <ul className="space-y-3">
          {nearby.map(({ o, km }) => (
            <li key={o.id} className="rounded-control border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.name} <span className="ml-1 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">{o.kind}</span></p>
                  {o.address && <p className="text-sm text-muted">{o.address}</p>}
                  {o.openingHours && <p className="text-xs text-muted">Hours: {o.openingHours}</p>}
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700"><MapPin className="size-3.5" aria-hidden />{formatKm(km)} away</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.phone && <a href={`tel:${o.phone.replace(/[^\d+]/g, '')}`} className={buttonStyles({ variant: 'secondary', size: 'sm' })}><Phone className="size-4" aria-hidden /> Call</a>}
                  <a href={directionsUrl(o)} target="_blank" rel="noopener noreferrer" className={buttonStyles({ variant: 'secondary', size: 'sm' })}><ExternalLink className="size-4" aria-hidden /> Directions</a>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {osm && <p className="text-xs text-muted">Clinic data © OpenStreetMap contributors. Listings may be incomplete or out of date, so call before you go.</p>}
      </Section>
    </div>
  )
}
