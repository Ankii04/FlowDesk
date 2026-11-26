'use strict';
function openSalesTranscription(language, onPreview) {
  const url = new URL('/api/stt/stream', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('language', language);
  const socket = new WebSocket(url);
  let ready = false;
  let finished = false;
  let complete = false;
  let pending = [];
  const finals = new Map();
  let settle;
  let flushTimer;
  const final = new Promise(resolve => { settle = resolve; });
  const close = () => {
    finished = true;
    clearTimeout(connectTimer);
    clearTimeout(flushTimer);
    pending = [];
    if (socket.readyState < WebSocket.CLOSING) socket.close();
    settle('');
  };
  const connectTimer = setTimeout(close, 1800);
  socket.onerror = socket.onclose = close;
  socket.onmessage = event => {
    if (finished) return;
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (message.type === 'ProxyError') { close(); return; }
    if (message.type === 'ProxyReady') {
      if (socket.readyState !== WebSocket.OPEN) { close(); return; }
      ready = true;
      clearTimeout(connectTimer);
      pending.forEach(chunk => socket.send(chunk));
      pending = [];
      return;
    }
    if (message.type !== 'Results') return;
    const transcript = message.channel?.alternatives?.[0]?.transcript?.trim();
    if (message.is_final && transcript) finals.set(message.start, transcript);
    const text = [...finals.entries()].sort((a, b) => a[0] - b[0]).map(entry => entry[1]).join(' ');
    complete = Boolean(message.from_finalize || message.speech_final && message.is_final);
    onPreview([text, !message.is_final ? transcript : ''].filter(Boolean).join(' '));
    if (message.from_finalize) settle(text);
  };
  return {
    push(chunk) {
      if (finished || !chunk.size) return;
      complete = false;
      if (!ready) pending.push(chunk);
      else if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 512 * 1024) socket.send(chunk);
      else close();
    },
    async finish() {
      if (finished || !ready || socket.readyState !== WebSocket.OPEN) { close(); return ''; }
      socket.send(JSON.stringify({ type: 'Finalize' }));
      flushTimer = setTimeout(() => settle(complete ? [...finals.entries()].sort((a, b) => a[0] - b[0]).map(entry => entry[1]).join(' ') : ''), 850);
      try { return await final; } finally { close(); }
    },
    close,
  };
}

async function playSalesStream(context, settings, text, signal, onPlayable) {
  const url = new URL(settings.ws_url);
  if (url.protocol !== 'wss:') throw new Error('Voice stream requires a secure connection.');
  if (settings.token && !url.searchParams.has('token')) url.searchParams.set('token', settings.token);
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    const playing = new Set();
    let nextStart = 0;
    let complete = false;
    let settled = false;
    const cancel = () => finish(new DOMException('Playback interrupted.', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error('Voice stream timed out.')), 12000);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      socket.close();
      if (error) {
        for (const source of playing) source.stop();
        reject(error);
      } else {
        resolve();
      }
    }
    function end() {
      complete = true;
      if (!playing.size) finish();
    }
    socket.onopen = () => socket.send(JSON.stringify({ text, model: 'mulberry', speaker: 'speaker_1' }));
    socket.onerror = () => finish(new Error('Voice stream failed.'));
    socket.onclose = () => nextStart ? end() : finish(new Error('Voice stream returned no audio.'));
    socket.onmessage = event => {
      if (settled) return;
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'error' || message.error) finish(new Error('Voice stream rejected the request.'));
          else if (message.type === 'end' || message.type === 'done' || message.done) {
            if (nextStart) end();
            else finish(new Error('Voice stream returned no audio.'));
          }
        } catch (_) {}
        return;
      }
      if (event.data.byteLength < 2 || event.data.byteLength % 2) return;
      const pcm = new Int16Array(event.data);
      const buffer = context.createBuffer(1, pcm.length, 24000);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = pcm[i] / 32768;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      playing.add(source);
      source.onended = () => {
        playing.delete(source);
        source.disconnect();
        if (complete && !playing.size) finish();
      };
      const first = !nextStart;
      const startsAt = Math.max(context.currentTime + 0.02, nextStart);
      source.start(startsAt);
      nextStart = startsAt + buffer.duration;
      if (first) onPlayable(startsAt - context.currentTime);
    };
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
  });
}
