/**
 * Small in-memory sliding-window limiter. It is per server instance, so treat it
 * as a guard against accidents and casual abuse, not a distributed quota.
 */
const hits = new Map<string, number[]>()

export function rateLimit(userId: string, bucket: string, max: number, windowMs: number): void {
  const key = `${bucket}:${userId}`
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    const wait = Math.ceil((windowMs - (now - (recent[0] ?? now))) / 1000)
    throw new Error(`Too many requests. Please wait ${wait} seconds and try again.`)
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
}
