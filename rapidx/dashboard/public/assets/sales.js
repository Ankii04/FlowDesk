'use strict';
const $ = id => document.getElementById(id);
const savedKey = 'flowdesk-last-saved-run';
const activeKey = 'flowdesk-active-session';
let active = null;
let savedId = localStorage.getItem(savedKey);
let busy = false;
let recording = null;
let autoStop = null;
let autoPaused = false;
let speaker;
let source;
let playback;
let pendingRequest;
let timings = {};
let speechEndedAt;

function trackTiming(key, started) {
  timings[key] = Math.round(performance.now() - started);
  $('timings').textContent = Object.entries(timings).map(([label, ms]) => label + ' ' + ms + ' ms').join(' · ');
}

function node(tag, text) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
}

function status(text, error = false) {
  $('status').textContent = text;
  $('status').dataset.error = String(error);
}

async function request(path, body, options = {}) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body && JSON.stringify(body),
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeout || 50000)]) : AbortSignal.timeout(options.timeout || 50000),
  });
  if (response.ok && response.headers.get('content-type')?.includes('audio/')) return response.arrayBuffer();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed. Check the local server.'), { status: response.status, code: data.code });
  return data;
}

function controls() {
  document.querySelectorAll('main button').forEach(button => { button.disabled = busy && !((button.id === 'mic' && recording) || button.id === 'switch-text' || button.id === 'interrupt'); });
  $('interrupt').hidden = !playback;
  if (recording) {
    $('mic').textContent = $('autolisten')?.checked ? 'Stop listening' : 'Send voice turn';
  } else {
    $('mic').textContent = 'Speak a turn';
  }
}

async function perform(work) {
  if (busy) return;
  busy = true;
  controls();
  try { await work(); }
  catch (error) {
    if (error.status === 401) { $('workspace').hidden = true; $('login').hidden = false; }
    status(error.message, true);
  } finally { busy = false; controls(); }
}

function list(element, fields) {
  const pairs = Object.entries(fields).flatMap(([key, value]) => [
    node('dt', key), node('dd', value == null || value === '' ? '—' : String(value)),
  ]);
  element.replaceChildren(...pairs);
}

function renderSession() {
  $('start').hidden = Boolean(active && !active.saved);
  $('controls').hidden = !active || Boolean(active.saved);
  if (!active) return;
  const { profile, qualification, turns, proposed, offers } = active;
  list($('profile'), {
    'Name': profile.name, 'Contact': active.hasContact ? 'Email added for handoff' : null, 'Use case': profile.need, 'Team size': profile.teamSize,
    'Timeline': profile.timelineDays == null ? null : profile.timelineDays + ' days',
    'Language': ({ en: 'English', hi: 'Hindi', kn: 'Kannada' }[active.language] || active.language),
    'Outcome': qualification.outcome, 'Reason': qualification.reason, 'Sentiment': active.sentiment.label,
  });
  const messages = turns.map(turn => {
    const entry = node('div');
    entry.className = 'turn ' + turn.role;
    entry.append(node('strong', turn.role === 'user' ? 'Prospect' : 'FlowDesk'), node('p', turn.text));
    for (const source of turn.sources || (turn.source ? [turn.source] : [])) {
      entry.append(node('small', source.id + ' · ' + source.title));
    }
    if (turn.warning) entry.append(node('small', turn.warning));
    return entry;
  });
  $('transcript').replaceChildren(...messages);
  $('transcript').scrollTop = $('transcript').scrollHeight;
  $('slots').replaceChildren();
  if (active.saved) {
    $('slots').append(node('p', active.saved.result.bookingOutcome));
  } else if (proposed) {
    $('slots').append(node('p', proposed.label));
    slotButton('Confirm ' + proposed.label, { action: 'confirm', slotId: proposed.id });
    slotButton('Show other times', { action: 'turn', text: 'Show available demo slots' });
  } else if (offers.length) {
    offers.forEach(slot => slotButton(slot.label, { action: 'propose', slotId: slot.id }));
  } else {
    $('slots').append(node('p', 'Ask to see available demo times.'));
  }
  controls();
}

function slotButton(label, input) {
  const button = node('button', label);
  button.addEventListener('click', () => perform(() => act(input)));
  $('slots').append(button);
}

async function refreshSaved() {
  if (!savedId) return;
  try {
    const record = await request('/api/sales/saved?id=' + encodeURIComponent(savedId));
    const summary = node('dl');
    const r = record.result;
    list(summary, {
      'Lead ID': record.id, 'Name': r.prospectName, 'Need': r.need, 'Team': r.teamSize, 'Timeline': r.timeline,
      'Language': r.language, 'Outcome': r.qualification, 'Reason': r.reason, 'Objection': r.objection,
      'Sentiment': r.sentiment, 'Sentiment reason': r.sentimentReason,
      'Booking': r.bookingOutcome, 'Reference': r.bookingReference, 'Next action': r.nextAction,
    });
    const timeline = node('ul');
    if (record.conversation) {
      const call = record.conversation;
      timeline.append(node('li', call.type + ' · ' + call.status + ' · ' + call.summary));
    }
    for (const item of record.timeline) timeline.append(node('li', item.description));
    $('saved').replaceChildren(summary, node('h3', 'Conversation timeline'), timeline);
    $('refresh').hidden = false;
  } catch (error) {
    $('refresh').hidden = false;
    throw error;
  }
}

async function audioReady() {
  if (!$('speech').checked) return;
  speaker ||= new AudioContext();
  if (speaker.state === 'suspended') await speaker.resume();
}

async function speak(text) {
  if (!$('speech').checked || autoPaused) return;
  const controller = new AbortController();
  playback = controller;
  controls();
  const started = performance.now();
  let startedPlayback = false;
  const firstAudio = () => {
    startedPlayback = true;
    trackTiming('TTS to playable audio', started);
    if (speechEndedAt != null) trackTiming('End of recording to playable audio', speechEndedAt);
  };
  try {
    await audioReady();
    try {
      const settings = await request('/api/ws-connect', { text, model: 'mulberry' }, { signal: controller.signal, timeout: 4500 });
      await playSalesStream(speaker, settings, text, controller.signal, firstAudio);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (startedPlayback) throw error;
      const bytes = await request('/api/tts', { text, model: 'mulberry', speaker: 'speaker_1' }, { signal: controller.signal, timeout: 12000 });
      const buffer = await speaker.decodeAudioData(bytes);
      if (controller.signal.aborted) return;
      await new Promise(resolve => {
        const player = speaker.createBufferSource();
        source = player;
        const stop = () => player.stop();
        player.buffer = buffer;
        player.connect(speaker.destination);
        player.onended = () => {
          controller.signal.removeEventListener('abort', stop);
          player.disconnect();
          if (source === player) source = null;
          resolve();
        };
        player.start();
        controller.signal.addEventListener('abort', stop, { once: true });
        firstAudio();
      });
    }
  } catch (error) {
    if (!controller.signal.aborted) status('Speech playback failed. The written reply is above.', true);
  } finally {
    if (playback === controller) playback = null;
    controls();
  }
}

async function act(input) {
  status(input.action === 'confirm' ? 'Saving the appointment and timeline…' : 'Working…');
  const started = performance.now();
  const key = JSON.stringify([active.id, input]);
  if (pendingRequest?.key !== key) pendingRequest = { key, id: crypto.randomUUID() };
  try {
    active = await request('/api/sales/action', { id: active.id, requestId: pendingRequest.id, ...input });
    pendingRequest = null;
    trackTiming(input.action === 'turn' ? 'Agent reply' : 'Sales action', started);
  } catch (error) {
    if (error.status && error.status < 500 && error.code !== 'busy') pendingRequest = null;
    if (error.code === 'slot_unavailable') {
      active.proposed = null;
      active.offers = [];
      renderSession();
    }
    throw error;
  }
  if (active.saved) {
    savedId = active.id;
    localStorage.setItem(savedKey, savedId);
    sessionStorage.removeItem(activeKey);
    renderSession();
    try { await refreshSaved(); }
    catch (_) { status('Saved in LeadPulse. Use Refresh LeadPulse to reload the record.', true); return; }
  }
  renderSession();
  status(active.saved ? 'Saved in LeadPulse.' : 'Ready for your next turn.');
  if (input.action !== 'contact') await speak(active.turns.at(-1).text);
  else status('Email added. It will be saved when you finish or book.');
}

function encode(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function monitorSilence(stream, onSpeechEnd, onNoSpeech) {
  const ctx = new AudioContext();
  const micSource = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  micSource.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let heardSpeech = false;
  let speechFrames = 0;
  let silenceStart = 0;
  const startedAt = Date.now();
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    if (rms > 0.018) {
      speechFrames++;
      if (speechFrames >= 2) heardSpeech = true;
      silenceStart = 0;
    } else if (heardSpeech) {
      if (!silenceStart) silenceStart = Date.now();
      else if (Date.now() - silenceStart >= 900) onSpeechEnd();
    } else if (Date.now() - startedAt >= 15000) {
      onNoSpeech();
    }
  }, 80);
  return () => {
    clearInterval(timer);
    micSource.disconnect();
    ctx.close().catch(() => {});
  };
}

function canAutoListen() {
  return Boolean($('autolisten')?.checked && active && !active.saved && !autoPaused);
}

async function recordTurn() {
  if (recording) {
    if (recording.state !== 'recording') return;
    if ($('autolisten').checked) autoPaused = true;
    autoStop?.();
    recording.stop();
    return;
  }
  autoPaused = false;
  let shouldContinue = false;
  await perform(async () => {
    await audioReady();
    source?.stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Microphone recording requires Chrome or Edge on localhost or HTTPS.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .catch(() => { throw new Error('Microphone unavailable. Check site permission in Chrome or Edge, or type a turn.'); });
    let timeout;
    let stopVad;
    let skipped = false;
    let live;
    const preview = $('voice-preview');
    const voiceSessionId = active.id;
    timings = {};
    speechEndedAt = null;
    try {
      const type = 'audio/webm;codecs=opus';
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(type) ? { mimeType: type } : undefined);
      const chunks = [];
      try {
        live = openSalesTranscription(active.language, text => {
          preview.textContent = text;
          preview.hidden = !text;
        });
      } catch (_) {}
      const done = new Promise((resolve, reject) => {
        recorder.ondataavailable = event => {
          if (!event.data.size) return;
          chunks.push(event.data);
          live?.push(event.data);
        };
        recorder.onerror = () => reject(new Error('Microphone recording failed.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      });
      recording = recorder;
      recorder.start(200);
      const autoMode = Boolean($('autolisten')?.checked);
      if (autoMode) {
        stopVad = monitorSilence(
          stream,
          () => { if (recorder.state === 'recording') recorder.stop(); },
          () => { skipped = true; if (recorder.state === 'recording') recorder.stop(); },
        );
        autoStop = stopVad;
      }
      timeout = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 25000);
      controls();
      status(autoMode ? 'Listening automatically… speak now.' : 'Listening. Click Send voice turn when you finish speaking.');
      const blob = await done;
      speechEndedAt = performance.now();
      stopVad?.();
      autoStop = null;
      stream.getTracks().forEach(track => track.stop());
      recording = null;
      controls();
      if (autoPaused) { status('Listening stopped.'); return; }
      if (skipped || blob.size < 900) {
        if (canAutoListen()) { shouldContinue = true; return; }
        throw new Error('The recording was too short. Try a full sentence.');
      }
      status('Transcribing with Deepgram…');
      const streamed = await live?.finish();
      if (autoPaused || active?.id !== voiceSessionId) return;
      const result = streamed ? { text: streamed } : await request('/api/stt', { audio: await encode(blob), mime: blob.type, language: active.language }, { timeout: 15000 })
        .catch(error => { throw new Error('Transcription failed. You can type this turn and continue.'); });
      if (autoPaused || active?.id !== voiceSessionId) return;
      trackTiming(streamed ? 'Streaming transcript' : 'Batch transcript', speechEndedAt);
      if (!result.text?.trim()) {
        if (canAutoListen()) { shouldContinue = true; return; }
        throw new Error('Deepgram heard no words. Check the mic or type this turn.');
      }
      if ($('review-transcript').checked) {
        $('text').value = result.text;
        $('text').focus();
        status('Review the transcript, then press Send.');
        return;
      }
      try { await act({ action: 'turn', text: result.text }); }
      catch (error) {
        $('text').value = result.text;
        throw error;
      }
      shouldContinue = canAutoListen();
    } finally {
      clearTimeout(timeout);
      live?.close();
      preview.hidden = true;
      stopVad?.();
      autoStop = null;
      recording = null;
      stream.getTracks().forEach(track => track.stop());
    }
  });
  if (shouldContinue) recordTurn();
}

$('mic').addEventListener('click', recordTurn);
$('switch-text').addEventListener('click', () => {
  autoPaused = true;
  $('autolisten').checked = false;
  if (recording?.state === 'recording') recording.stop();
  playback?.abort();
  $('text').focus();
  status('Type your next turn.');
});
$('interrupt').addEventListener('click', () => {
  playback?.abort();
  status('Reply interrupted.');
});
$('end').addEventListener('click', () => perform(async () => {
  await request('/api/sales/action', { id: active.id, action: 'end' });
  sessionStorage.removeItem(activeKey);
  active = null;
  pendingRequest = null;
  $('transcript').replaceChildren();
  $('profile').replaceChildren();
  $('slots').replaceChildren(node('p', 'Ask to see available demo times.'));
  $('text').value = '';
  $('contact').reset();
  renderSession();
  status('Conversation ended. You can start a new one.');
}));
$('contact').addEventListener('submit', event => {
  event.preventDefault();
  perform(async () => {
    await act({ action: 'contact', email: $('email').value, consent: $('contact-consent').checked });
    $('contact').reset();
  });
});
$('login').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  perform(async () => {
    await request('/api/auth/login', Object.fromEntries(form));
    $('login').reset();
    await boot();
  });
});
$('start').addEventListener('submit', event => {
  event.preventDefault();
  autoPaused = false;
  perform(async () => {
    await audioReady();
    active = await request('/api/sales/start', { language: $('language').value, consent: $('consent').checked });
    sessionStorage.setItem(activeKey, active.id);
    renderSession();
    status('Ready. Speak a turn or type a message.');
    await speak(active.turns.at(-1).text);
  }).then(() => {
    if (canAutoListen()) recordTurn();
  });
});
$('typed').addEventListener('submit', event => {
  event.preventDefault();
  const value = $('text').value.trim();
  if (value) perform(async () => {
    timings = {};
    speechEndedAt = null;
    autoPaused = false;
    await audioReady();
    await act({ action: 'turn', text: value });
    $('text').value = '';
  });
});
$('finish').addEventListener('click', () => perform(() => act({ action: 'finish' })));
$('refresh').addEventListener('click', () => perform(refreshSaved));
window.addEventListener('pagehide', () => {
  autoPaused = true;
  playback?.abort();
  if (recording?.state === 'recording') recording.stop();
});

async function boot() {
  await request('/api/me');
  $('login').hidden = true;
  $('workspace').hidden = false;
  status('');
  const resumeId = sessionStorage.getItem(activeKey);
  if (resumeId) {
    try {
      active = await request('/api/sales/session?id=' + encodeURIComponent(resumeId));
      if (active.saved) {
        savedId = active.id;
        localStorage.setItem(savedKey, savedId);
        sessionStorage.removeItem(activeKey);
      }
      renderSession();
      status(active.saved ? 'Saved in LeadPulse.' : 'Conversation resumed. Speak or type to continue.');
    } catch (error) {
      if (error.code === 'session_expired') sessionStorage.removeItem(activeKey);
      else status(error.message, true);
    }
  }
  if (savedId) await refreshSaved().catch(error => status(error.message, true));
}

perform(boot);
