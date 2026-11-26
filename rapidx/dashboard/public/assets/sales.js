'use strict';
const $ = id => document.getElementById(id);
const savedKey = 'flowdesk-last-saved-run';
let active = null;
let savedId = localStorage.getItem(savedKey);
let busy = false;
let recording = null;
let autoStop = null;
let autoPaused = false;
let speaker;
let source;

function node(tag, text) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
}

function status(text, error = false) {
  $('status').textContent = text;
  $('status').dataset.error = String(error);
}

async function request(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body && JSON.stringify(body), signal: AbortSignal.timeout(50000),
  });
  if (response.ok && response.headers.get('content-type')?.includes('audio/')) return response.arrayBuffer();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed. Check the local server.'), { status: response.status, code: data.code });
  return data;
}

function controls() {
  document.querySelectorAll('main button').forEach(button => { button.disabled = busy && !(button.id === 'mic' && recording); });
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
    'Name': profile.name, 'Use case': profile.need, 'Team size': profile.teamSize,
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
      'Lead ID': record.id, 'Need': r.need, 'Team': r.teamSize, 'Timeline': r.timeline,
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
  if (!$('speech').checked) return;
  try {
    await audioReady();
    if (!speaker) return;
    const bytes = await request('/api/tts', { text, model: 'mulberry', speaker: 'speaker_1' });
    source?.stop();
    const audioBuffer = await speaker.decodeAudioData(bytes);
    await new Promise(resolve => {
      const node = speaker.createBufferSource();
      source = node;
      node.buffer = audioBuffer;
      node.connect(speaker.destination);
      const done = () => { if (source === node) source = null; resolve(); };
      node.onended = done;
      node.playbackRate.value = 1.15;
      setTimeout(done, Math.ceil(((audioBuffer.duration / 1.15) + 1) * 1000));
      node.start();
    });
  } catch (error) {
    status('Speech playback failed. The written reply is above. ' + error.message, true);
  }
}

async function act(input) {
  status(input.action === 'confirm' ? 'Saving the appointment and timeline…' : 'Working…');
  try {
    active = await request('/api/sales/action', { id: active.id, ...input });
  } catch (error) {
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
    renderSession();
    await refreshSaved();
  }
  renderSession();
  status(active.saved ? 'Saved in LeadPulse.' : 'Ready for your next turn.');
  await speak(active.turns.at(-1).text);
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
      else if (Date.now() - silenceStart >= 650) onSpeechEnd();
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
    autoPaused = true;
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
    try {
      const type = 'audio/webm;codecs=opus';
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(type) ? { mimeType: type } : undefined);
      const chunks = [];
      const done = new Promise((resolve, reject) => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error('Microphone recording failed.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      });
      recording = recorder;
      recorder.start();
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
      const result = await request('/api/stt', { audio: await encode(blob), mime: blob.type, language: active.language })
        .catch(error => { throw new Error('Deepgram: ' + error.message + ' You can type this turn and continue.'); });
      if (!result.text?.trim()) {
        if (canAutoListen()) { shouldContinue = true; return; }
        throw new Error('Deepgram heard no words. Check the mic or type this turn.');
      }
      await act({ action: 'turn', text: result.text });
      shouldContinue = canAutoListen();
    } finally {
      clearTimeout(timeout);
      stopVad?.();
      autoStop = null;
      recording = null;
      stream.getTracks().forEach(track => track.stop());
    }
  });
  if (shouldContinue) recordTurn();
}

$('mic').addEventListener('click', recordTurn);
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
    await audioReady();
    await act({ action: 'turn', text: value });
    $('text').value = '';
  });
});
$('finish').addEventListener('click', () => perform(() => act({ action: 'finish' })));
$('refresh').addEventListener('click', () => perform(refreshSaved));
window.addEventListener('pagehide', () => { if (recording?.state === 'recording') recording.stop(); });

async function boot() {
  await request('/api/me');
  $('login').hidden = true;
  $('workspace').hidden = false;
  status('');
  if (savedId) await refreshSaved().catch(error => status(error.message, true));
}

perform(boot);
