/**
 * WebCodecs H.264 decoder worker.
 *
 * Receives individual Annex-B NAL units from the main thread, decodes them with
 * the browser's built-in hardware-accelerated VideoDecoder, and posts back
 * ImageBitmap frames.
 *
 * Protocol (inbound):
 *   { type: 'decode', data: ArrayBuffer, renderStateId: number }
 *   { type: 'release' }
 *
 * Protocol (outbound):
 *   { type: 'decoderReady' }
 *   { type: 'bitmap', width, height, bitmap: ImageBitmap, renderStateId }
 *   { type: 'error', message: string }
 */

type DecodeMsg = { type: 'decode'; data: ArrayBuffer; renderStateId: number };
type ReleaseMsg = { type: 'release' };
type InMsg = DecodeMsg | ReleaseMsg;

const NAL_SPS = 7;
const NAL_PPS = 8;
const NAL_IDR = 5;
const NAL_IDR_EXT = 20; // MVC/SVC IDR

/** Strip Annex-B start code and return the raw NALU bytes. */
function stripStartCode(u8: Uint8Array): Uint8Array {
  if (u8.length >= 4 && u8[0] === 0 && u8[1] === 0 && u8[2] === 0 && u8[3] === 1) return u8.slice(4);
  if (u8.length >= 3 && u8[0] === 0 && u8[1] === 0 && u8[2] === 1) return u8.slice(3);
  return u8;
}

/** Get H.264 NAL unit type from an Annex-B buffer (skips start code). */
function getNalType(u8: Uint8Array): number {
  let i = 0;
  if (u8.length >= 4 && u8[0] === 0 && u8[1] === 0 && u8[2] === 0 && u8[3] === 1) i = 4;
  else if (u8.length >= 3 && u8[0] === 0 && u8[1] === 0 && u8[2] === 1) i = 3;
  return i < u8.length ? u8[i] & 0x1f : 0;
}

/** Build AVCDecoderConfigurationRecord (avcC) from raw SPS and PPS bytes. */
function buildAvcC(spsRaw: Uint8Array, ppsRaw: Uint8Array): Uint8Array {
  // avcC layout: 6 header bytes + 2 SPS-length bytes + SPS + 1 numPPS + 2 PPS-length bytes + PPS = 11 + N + M
  const out = new Uint8Array(11 + spsRaw.length + ppsRaw.length);
  let o = 0;
  out[o++] = 1;                            // configurationVersion
  out[o++] = spsRaw[1] ?? 0x42;           // AVCProfileIndication
  out[o++] = spsRaw[2] ?? 0x00;           // profile_compatibility
  out[o++] = spsRaw[3] ?? 0x1f;           // AVCLevelIndication
  out[o++] = 0xff;                         // 0b11111100 | lengthSizeMinusOne(3)
  out[o++] = 0xe1;                         // 0b11100000 | numSPS(1)
  out[o++] = (spsRaw.length >> 8) & 0xff;
  out[o++] = spsRaw.length & 0xff;
  out.set(spsRaw, o); o += spsRaw.length;
  out[o++] = 1;                            // numPPS
  out[o++] = (ppsRaw.length >> 8) & 0xff;
  out[o++] = ppsRaw.length & 0xff;
  out.set(ppsRaw, o);
  return out;
}

/** Build codec string from raw SPS bytes: "avc1.PPCCLL" */
function buildCodecString(spsRaw: Uint8Array): string {
  const pp = spsRaw[1].toString(16).padStart(2, '0');
  const cc = spsRaw[2].toString(16).padStart(2, '0');
  const ll = spsRaw[3].toString(16).padStart(2, '0');
  return `avc1.${pp}${cc}${ll}`;
}

/** Wrap raw NALU bytes (no start code) in a 4-byte AVCC length prefix. */
function toAvcc(naluRaw: Uint8Array): Uint8Array {
  const len = naluRaw.length;
  const out = new Uint8Array(4 + len);
  out[0] = (len >>> 24) & 0xff;
  out[1] = (len >>> 16) & 0xff;
  out[2] = (len >>> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(naluRaw, 4);
  return out;
}

// ──────────────────────────────────────────────
// Worker state
// ──────────────────────────────────────────────
let decoder: VideoDecoder | null = null;
let sps: Uint8Array | null = null;
let pps: Uint8Array | null = null;
let currentStateId = -1;
let tsUs = 0; // synthetic monotonic timestamp (microseconds)

let offscreen: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

function ensureCanvas(w: number, h: number): { off: OffscreenCanvas; ctx2d: OffscreenCanvasRenderingContext2D } {
  if (!offscreen || offscreen.width !== w || offscreen.height !== h) {
    offscreen = new OffscreenCanvas(w, h);
    ctx = null;
  }
  if (!ctx) {
    ctx = offscreen.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
  }
  return { off: offscreen, ctx2d: ctx! };
}

function teardown() {
  if (decoder) {
    try { decoder.close(); } catch { /* ignore */ }
    decoder = null;
  }
  sps = null;
  pps = null;
  tsUs = 0;
}

function configureDecoder(capturedStateId: number) {
  if (!sps || !pps) return;
  if (decoder) {
    try { decoder.close(); } catch { /* ignore */ }
    decoder = null;
  }

  const description = buildAvcC(sps, pps);
  const codec = buildCodecString(sps);

  decoder = new VideoDecoder({
    output: (frame) => {
      // Ignore frames from stale sessions.
      if (capturedStateId !== currentStateId) {
        frame.close();
        return;
      }

      const w = frame.displayWidth;
      const h = frame.displayHeight;

      try {
        const { off, ctx2d } = ensureCanvas(w, h);
        // drawImage accepts VideoFrame directly (it is a CanvasImageSource)
        ctx2d.drawImage(frame as unknown as CanvasImageSource, 0, 0);
        frame.close();
        const bitmap = off.transferToImageBitmap();
        (self as unknown as Worker).postMessage(
          { type: 'bitmap', width: w, height: h, bitmap, renderStateId: capturedStateId },
          [bitmap as unknown as Transferable],
        );
      } catch (e) {
        try { frame.close(); } catch { /* ignore */ }
        console.error('[webcodecs worker] render error', e);
      }
    },
    error: (e) => {
      console.error('[webcodecs worker] decoder error', e);
      (self as unknown as Worker).postMessage({ type: 'error', message: String(e) });
    },
  });

  try {
    decoder.configure({
      codec,
      description,
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true,
    });
  } catch (e) {
    // If 'prefer-hardware' is unsupported, fall back to 'no-preference'
    try {
      decoder.configure({ codec, description, optimizeForLatency: true });
    } catch (e2) {
      console.error('[webcodecs worker] configure failed', e2);
      (self as unknown as Worker).postMessage({ type: 'error', message: String(e2) });
    }
  }
}

function handleNalu(annexB: Uint8Array, stateId: number) {
  const nalType = getNalType(annexB);
  const raw = stripStartCode(annexB);

  if (nalType === NAL_SPS) {
    const changed = !sps || sps.length !== raw.length || raw.some((b, i) => b !== sps![i]);
    sps = raw;
    if (changed && pps) configureDecoder(stateId);
    return;
  }

  if (nalType === NAL_PPS) {
    const changed = !pps || pps.length !== raw.length || raw.some((b, i) => b !== pps![i]);
    pps = raw;
    if (changed && sps) configureDecoder(stateId);
    // If we now have both SPS+PPS and no decoder yet, configure.
    if (!decoder && sps) configureDecoder(stateId);
    return;
  }

  if (!decoder || decoder.state === 'closed' || decoder.state === 'unconfigured') return;

  const isKey = nalType === NAL_IDR || nalType === NAL_IDR_EXT;

  // Build AVCC payload.  For key frames include SPS+PPS so seek/reconnect works cleanly.
  let data: Uint8Array;
  if (isKey && sps && pps) {
    const a = toAvcc(sps);
    const b = toAvcc(pps);
    const c = toAvcc(raw);
    data = new Uint8Array(a.length + b.length + c.length);
    let o = 0;
    data.set(a, o); o += a.length;
    data.set(b, o); o += b.length;
    data.set(c, o);
  } else {
    data = toAvcc(raw);
  }

  tsUs += 33_333; // synthetic ~30 fps timestamps

  try {
    decoder.decode(
      new EncodedVideoChunk({
        type: isKey ? 'key' : 'delta',
        timestamp: tsUs,
        data,
      }),
    );
  } catch (e) {
    console.error('[webcodecs worker] decode() threw', e);
    (self as unknown as Worker).postMessage({ type: 'error', message: String(e) });
  }
}

// ──────────────────────────────────────────────
// Message handler
// ──────────────────────────────────────────────
self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'release') {
    teardown();
    return;
  }

  if (msg.type === 'decode') {
    const { data, renderStateId } = msg;

    // New session: reset decoder state.
    if (renderStateId !== currentStateId) {
      teardown();
      currentStateId = renderStateId;
    }

    if (!data || data.byteLength < 5) return;
    handleNalu(new Uint8Array(data), renderStateId);
  }
};

// Signal that this worker is ready immediately (no WASM init needed).
(self as unknown as Worker).postMessage({ type: 'decoderReady' });
