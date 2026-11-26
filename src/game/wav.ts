const RATE = 8000;

export function tone(freq: number, seconds: number, volume: number): string {
  const n = Math.floor(RATE * seconds);
  const samples = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 28) * (1 - t / seconds);
    samples[i] = Math.sin(t * freq * Math.PI * 2) * volume * env;
  }
  return wav(samples);
}

export function noise(seconds: number, volume: number, damp: number): string {
  const n = Math.floor(RATE * seconds);
  const samples = new Array<number>(n);
  let hold = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    hold = hold * 0.82 + (Math.random() * 2 - 1) * 0.18;
    const env = Math.exp(-t * damp);
    samples[i] = hold * volume * env;
  }
  return wav(samples);
}

function wav(samples: number[]): string {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  write(view, 0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  write(view, 8, 'WAVE');
  write(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(view, 36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function write(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}
