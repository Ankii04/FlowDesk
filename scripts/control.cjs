'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const crm = path.join(root, 'leadpulse');
const rapidx = path.join(root, 'rapidx', 'dashboard');
const envPath = path.join(root, '.env');
const windows = process.platform === 'win32';

function secret() { return randomBytes(24).toString('hex'); }

function ensureConfig() {
  if (fs.existsSync(envPath)) return;
  const template = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const user = process.env.USERPROFILE;
  const existing = user && path.join(user, 'rapidx-voice-agent-stack', '.env');
  const existingKeys = existing && fs.existsSync(existing) ? require('node:util').parseEnv(fs.readFileSync(existing, 'utf8')) : {};
  const generated = Object.fromEntries(['FORTIVEX_CRM_PASSWORD', 'TEST_USER_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']
    .map(key => [key, secret()]));
  for (const key of ['DEEPGRAM_API_KEY', 'GROQ_API_KEY', 'RUMIK_API_KEY']) {
    if (existingKeys[key]) generated[key] = existingKeys[key];
  }
  const config = template.replace(/^([A-Z_]+)=$/gm, (line, key) => generated[key] ? key + '=' + generated[key] : line);
  fs.writeFileSync(envPath, config, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with a local demo login. Existing RapidX provider keys were copied if present.');
}

const npm = windows ? 'npm.cmd' : 'npm';
function execute(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd, stdio: 'inherit', shell: windows && command === npm,
  });
  if (result.error || result.status !== 0) throw new Error(command + ' ' + args.slice(0, 2).join(' ') + ' failed. See terminal output.');
}

function loadConfig() {
  process.loadEnvFile(envPath);
  for (const key of ['FORTIVEX_CRM_EMAIL', 'FORTIVEX_CRM_PASSWORD', 'TEST_USER_EMAIL', 'TEST_USER_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!process.env[key]) throw new Error('Missing ' + key + ' in .env. Use setup to generate a new local configuration.');
  }
  for (const key of ['DEEPGRAM_API_KEY', 'GROQ_API_KEY', 'RUMIK_API_KEY']) {
    if (!process.env[key]) console.log(key + ' is blank. Add it to .env for the live provider.');
  }
}

const prisma = (...args) => execute(process.execPath, ['node_modules/prisma/build/index.js', ...args], crm);
const seed = (...args) => execute(process.execPath, ['node_modules/ts-node/dist/bin.js', 'prisma/sales-demo-seed.ts', ...args], crm);

function setup() {
  execute('docker', ['compose', 'up', '-d', '--wait']);
  execute(npm, ['ci', '--no-audit', '--no-fund'], crm);
  prisma('generate');
  prisma('migrate', 'deploy');
  execute(npm, ['run', 'build'], crm);
  seed();
  execute(npm, ['exec', '--yes', '--package=pnpm@10.32.1', '--', 'pnpm', 'install', '--frozen-lockfile'], rapidx);
  console.log('Setup complete. Run node scripts/control.cjs login to view the local demo login.');
}

async function start() {
  const children = [];
  function launch(port, script, cwd) {
    const child = spawn(process.execPath, [script], {
      cwd, env: { ...process.env, PORT: port, FORTIVEX_LOOPBACK: '1' }, stdio: 'inherit',
    });
    children.push(child);
    child.on('exit', code => {
      if (code !== 0 && code !== null) process.exitCode = code;
      for (const item of children) if (item.exitCode === null) item.kill();
    });
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => children.forEach(child => child.kill()));
  launch('3100', 'dist/src/server.js', crm);
  launch('8787', 'server.js', rapidx);
  console.log('Open http://localhost:8787/sales.html once both servers are listening.');
}

const action = process.argv[2];
try {
  if (action === 'setup') ensureConfig();
  loadConfig();
  if (action === 'setup') setup();
  else if (action === 'start') start();
  else if (action === 'reset') {
    if (!/^postgresql:\/\/[^@]+@(?:127\.0\.0\.1|localhost):5434\/fortivex_voice(?:\?|$)/.test(process.env.DATABASE_URL || '')) {
      throw new Error('Reset is scoped to the local Fortivex demo database on port 5434.');
    }
    seed('--reset');
  } else if (action === 'login') {
    console.log('Local browser login:', process.env.TEST_USER_EMAIL);
    console.log('Local browser password:', process.env.TEST_USER_PASSWORD);
  } else throw new Error('Use setup, start, reset or login.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
