// Voice input through the browser's speech recognition (Chrome, Edge, Safari). Hidden where unsupported.
import { useEffect, useRef, useState } from 'react';

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void;
};
type RecCtor = new () => Rec;

const Ctor = (): RecCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

export function useSpeech(lang: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<Rec | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;
  const supported = !!Ctor();

  useEffect(() => () => rec.current?.stop(), []);

  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const C = Ctor();
    if (!C) return;
    const r = new C();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      const text = res[0].transcript;
      setPartial(text);
      if (res.isFinal) { setPartial(''); cb.current(text); }
    };
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone permission was denied.' : '');
    r.onend = () => { setListening(false); setPartial(''); };
    rec.current = r;
    setError('');
    setListening(true);
    r.start();
  }

  return { supported, listening, partial, error, toggle };
}
