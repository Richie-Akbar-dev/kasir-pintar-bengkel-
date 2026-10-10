import { api } from './api';
import type { Settings } from './types';

/** Apakah aplikasi mencetak langsung ke printer (bukan lewat dialog browser). */
export function isDirectPrint(settings: Settings | null | undefined): boolean {
  return !!settings && !!settings.printerType && settings.printerType !== 'browser';
}

/** Cetak struk sebuah transaksi lewat backend (printer langsung). */
export async function printTransaction(
  id: string,
  { openDrawer }: { openDrawer?: boolean } = {}
): Promise<{ bytes: number; drawerOpened: boolean }> {
  return api.post<{ ok: boolean; bytes: number; drawerOpened: boolean }>(
    `/api/hardware/print-transaction/${id}`,
    { openDrawer }
  );
}

/** Kirim perintah buka laci uang. */
export async function openCashDrawer(): Promise<void> {
  await api.post('/api/hardware/open-drawer');
}

/**
 * Bunyi beep singkat dengan Web Audio API.
 * Dipakai sebagai umpan balik saat barcode berhasil ditambahkan ke keranjang.
 */
let audioContext: AudioContext | null = null;
export function beep({ frequency = 1400, durationMs = 70, volume = 0.06 } = {}) {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === 'suspended') void audioContext.resume();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    }, durationMs);
  } catch {
    // Browser tidak mendukung Web Audio — abaikan saja.
  }
}

/** Bunyi galat (nada rendah dua kali). */
export function beepError() {
  beep({ frequency: 420, durationMs: 120, volume: 0.05 });
  setTimeout(() => beep({ frequency: 320, durationMs: 160, volume: 0.05 }), 150);
}
