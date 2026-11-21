import { useCallback, useEffect, useRef, useState } from 'react'

interface AlternativeLike { transcript: string }
interface ResultLike { isFinal: boolean; 0: AlternativeLike; length: number }
interface SpeechEventLike { resultIndex: number; results: ArrayLike<ResultLike> }
interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => RecognitionLike

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings, or type instead.',
  'service-not-allowed': 'Speech recognition is not allowed in this browser. Type instead.',
  'no-speech': 'No speech was heard. Try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection.',
}

/** Web Speech API dictation. Final phrases are passed to onFinal; interim text is only shown live. */
export function useSpeechRecognition(onFinal: (text: string) => void, lang: string) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<RecognitionLike | null>(null)
  const wantRef = useRef(false)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  useEffect(() => { setSupported(getCtor() !== null) }, [])

  const stop = useCallback(() => {
    wantRef.current = false
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    setError(null)
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (!r) continue
        if (r.isFinal) onFinalRef.current(r[0].transcript.trim())
        else live += r[0].transcript
      }
      setInterim(live)
    }
    rec.onerror = (e) => {
      if (e.error === 'aborted') return
      if (e.error !== 'no-speech') wantRef.current = false
      setError(ERRORS[e.error] ?? 'Dictation stopped unexpectedly. You can keep typing.')
    }
    rec.onend = () => {
      // Browsers end continuous sessions after a pause; restart while the patient still wants to talk.
      if (wantRef.current) {
        try { rec.start() } catch { wantRef.current = false; setListening(false) }
      } else { setListening(false); setInterim('') }
    }
    recRef.current = rec
    wantRef.current = true
    try { rec.start(); setListening(true) } catch { wantRef.current = false; setError('Could not start dictation.') }
  }, [lang])

  useEffect(() => () => { wantRef.current = false; recRef.current?.abort() }, [])

  return { supported, listening, interim, error, start, stop }
}
