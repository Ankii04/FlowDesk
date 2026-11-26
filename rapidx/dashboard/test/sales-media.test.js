'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/assets/sales-media.js'), 'utf8');

function mediaFixture() {
  const sockets = [];
  class Socket {
    static OPEN = 1;
    static CLOSING = 2;
    constructor(url) {
      this.url = url;
      this.readyState = Socket.OPEN;
      this.bufferedAmount = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(message) { this.sent.push(message); }
    close() { this.readyState = 3; }
    json(message) { this.onmessage({ data: JSON.stringify(message) }); }
  }
  const api = vm.createContext({
    WebSocket: Socket, URL, DOMException, setTimeout, clearTimeout,
    location: { href: 'http://localhost:8787/sales.html', protocol: 'http:' },
  });
  vm.runInContext(source, api);
  return { api, sockets };
}

test('live transcript queues microphone audio, carries language, and finalizes once', async () => {
  const { api, sockets } = mediaFixture();
  let preview;
  const live = api.openSalesTranscription('hi', text => { preview = text; });
  const socket = sockets[0];
  assert.equal(socket.url.searchParams.get('language'), 'hi');
  const chunk = new Blob(['audio']);
  live.push(chunk);
  assert.equal(socket.sent.length, 0);
  socket.json({ type: 'ProxyReady' });
  assert.equal(socket.sent[0], chunk);
  const result = live.finish();
  socket.json({ type: 'Results', from_finalize: true, is_final: true, start: 0,
    channel: { alternatives: [{ transcript: 'नमस्ते FlowDesk' }] } });
  assert.equal(await result, 'नमस्ते FlowDesk');
  assert.equal(preview, 'नमस्ते FlowDesk');
  assert.equal(JSON.parse(socket.sent[1]).type, 'Finalize');
  assert.equal(socket.readyState, 3);
});

test('failed live transcription signals the caller to use batch audio', async () => {
  const { api, sockets } = mediaFixture();
  const live = api.openSalesTranscription('en', () => {});
  sockets[0].json({ type: 'ProxyError' });
  assert.equal(await live.finish(), '');
});

test('interrupting a voice reply stops scheduled audio and closes its socket', async () => {
  const { api, sockets } = mediaFixture();
  let stopped = false;
  let playable = false;
  const controller = new AbortController();
  const audio = {
    currentTime: 1,
    createBuffer: (_, length) => ({ duration: length / 24000, getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => ({ connect() {}, disconnect() {}, start() {}, stop() { stopped = true; } }),
  };
  const speaking = api.playSalesStream(audio, { ws_url: 'wss://voice.example.test/session' },
    'Hello', controller.signal, () => { playable = true; });
  sockets[0].onopen();
  sockets[0].onmessage({ data: new Int16Array([100, 200]).buffer });
  assert.equal(playable, true);
  controller.abort();
  await assert.rejects(speaking, { name: 'AbortError' });
  assert.equal(stopped, true);
  assert.equal(sockets[0].readyState, 3);
});
