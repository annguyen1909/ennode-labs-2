"use client"

import { useEffect } from "react";

// Safer LoaderPreload implementation:
// - Use cache: 'no-store' to avoid browser cache writes (ERR_CACHE_WRITE_FAILURE).
// - Probe with HEAD, fallback to Range GET (bytes=0-0) to avoid downloading whole file.
// - Retry with exponential backoff.
// - Execute sequentially with small pauses to reduce IO contention and main-thread spikes.

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function probeUrl(url: string, attempts = 3, timeout = 8000): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      // Try HEAD first
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (head && head.ok) return true;

      // Some servers don't support HEAD; request only the first byte via Range header
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), timeout);
      const get = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store', signal: ctrl2.signal });
      clearTimeout(timer2);
      if (get && (get.status === 206 || get.ok)) return true;
    } catch (err) {
      if (i === attempts - 1) console.warn(`probeUrl failed for ${url}:`, err);
    }
    // backoff
    await sleep(200 * Math.pow(2, i));
  }
  return false;
}

export default function LoaderPreload({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    let mounted = true;

    async function run() {
      const urls = ['/models/Logo.glb', '/models/Spine.glb'];
      try {
        for (const u of urls) {
          if (!mounted) return;
          const ok = await probeUrl(u, 3, 8000);
          if (!ok) console.warn(`Preload probe failed for ${u}`);
          // small delay between probes to ease IO
          await sleep(120);
        }
      } catch (e) {
        console.warn('LoaderPreload error:', e);
      } finally {
        if (mounted) onDone();
      }
    }

    // Slight delay so initial paint isn't delayed
    const id = setTimeout(run, 120);
    return () => {
      mounted = false;
      clearTimeout(id);
    };
  }, [onDone]);

  return null;
}
