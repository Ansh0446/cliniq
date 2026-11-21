/** Copies text to the clipboard, with a fallback for pages where the async clipboard API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true }
  } catch { /* fall through to the legacy path */ }
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(el)
  el.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  document.body.removeChild(el)
  return ok
}

export function downloadFile(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
