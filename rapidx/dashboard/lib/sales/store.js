'use strict';
const { randomUUID } = require('node:crypto');

function unavailable(message, code, status) {
  return Object.assign(new Error(message), { code, status });
}

function memoryStore() {
  const accounts = new Map();
  const locks = new Set();
  return {
    async update(account, now, work) {
      if (locks.has(account)) throw unavailable('One request is already in progress. Retry shortly.', 'busy', 409);
      locks.add(account);
      try {
        for (const [key, sessions] of accounts) {
          if (!sessions.some(session => session.expiresAt > now) && !locks.has(key)) accounts.delete(key);
        }
        const sessions = (accounts.get(account) || []).filter(session => session.expiresAt > now);
        if (!accounts.has(account) && accounts.size >= 100) throw unavailable('Demo session capacity reached.', 'busy', 503);
        accounts.set(account, sessions);
        return await work(sessions);
      } finally {
        locks.delete(account);
      }
    },
  };
}

function redisStore(url, ttlMs) {
  const client = require('redis').createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: 3000, reconnectStrategy: false } });
  client.on('error', error => console.error('FlowDesk session store:', error.code || error.name));
  let connecting;
  const leaseMs = 180000;
  const release = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
  const save = "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('PSETEX', KEYS[2], ARGV[2], ARGV[3]); return 1";
  return {
    async update(account, now, work) {
      if (!client.isReady) {
        connecting ||= client.connect().finally(() => { connecting = undefined; });
        await connecting.catch(() => { throw unavailable('Session storage is unavailable. Try again shortly.', 'session_store_unavailable', 503); });
      }
      const key = 'flowdesk:sales:v1:' + account;
      const lock = key + ':lock';
      const token = randomUUID();
      let acquired = false;
      try {
        acquired = Boolean(await client.set(lock, token, { NX: true, PX: leaseMs }));
        if (!acquired) throw unavailable('One request is already in progress. Retry shortly.', 'busy', 409);
        const sessions = JSON.parse(await client.get(key) || '[]').filter(session => session.expiresAt > now);
        try {
          return await work(sessions);
        } finally {
          const saved = await client.eval(save, { keys: [lock, key], arguments: [token, String(ttlMs), JSON.stringify(sessions)] });
          if (!saved) throw unavailable('The request lease expired. Retry your request.', 'session_store_unavailable', 503);
        }
      } catch (error) {
        if (error.status) throw error;
        throw unavailable('Session storage is unavailable. Try again shortly.', 'session_store_unavailable', 503);
      } finally {
        if (acquired) await client.eval(release, { keys: [lock], arguments: [token] }).catch(() => {});
      }
    },
  };
}

module.exports = { memoryStore, redisStore };
