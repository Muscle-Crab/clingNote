#!/usr/bin/env node
// Regenerate the robot voiceover MP3s in the ONE robot voice (src/voiceover/scripts.js VOICE).
//   public/voiceover/<key>.mp3      onboarding / report intro / manager intro (SCRIPTS)
//   public/voiceover/p/<hash>.mp3   static report / coach lines (src/voiceover/phrases.js), played offline by speakLive
// ElevenLabs (eleven_multilingual_v2) when ELEVENLABS_API_KEY is in the env or /workspace/.secrets/elevenlabs.env;
// otherwise the edge-tts interim voice (python3 -m pip install edge-tts). The key is never printed or written anywhere.
// Unchanged lines are skipped (public/voiceover/manifest.json holds a hash of voice+model+text), so re-runs cost no characters.
// Usage: node scripts/gen-voiceover-elevenlabs.mjs [--force] [--only=key1,key2] [--dry] [--sample=out.mp3 "text"]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import path from 'path'; import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { VOICE, SCRIPTS } = await import(path.join(root, 'src/voiceover/scripts.js'));
const { PHRASES, phraseKey } = await import(path.join(root, 'src/voiceover/phrases.js'));
const args = process.argv.slice(2); const flag = (n) => args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const val = (n) => { const a = flag(n); return a && a.includes('=') ? a.split('=').slice(1).join('=') : ''; };

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  for (const f of [process.env.ELEVENLABS_ENV_FILE, '/workspace/.secrets/elevenlabs.env'].filter(Boolean)) {
    if (!existsSync(f)) continue;
    const m = /^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m.exec(readFileSync(f, 'utf8'));
    if (m) return m[1];
  }
  return '';
}
const key = loadKey();
const engine = key ? 'elevenlabs' : 'edge-tts';
const out = path.join(root, 'public/voiceover'); const pdir = path.join(out, 'p'); mkdirSync(pdir, { recursive: true });
const manPath = path.join(out, 'manifest.json');
const manifest = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : {};
const sig = (text) => createHash('sha1').update(engine === 'elevenlabs' ? `${VOICE.voiceId}|${VOICE.model}|${JSON.stringify(VOICE.settings)}|${text}` : `${VOICE.edge.name}|${text}`).digest('hex').slice(0, 16);
let chars = 0; let billed = 0;

async function eleven(text, file) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.voiceId}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: VOICE.model, voice_settings: VOICE.settings }),
    });
    if (r.ok) { writeFileSync(file, Buffer.from(await r.arrayBuffer())); chars += text.length; billed += Number(r.headers.get('character-cost')) || text.length; return; }
    const detail = (await r.text().catch(() => '')).slice(0, 200).replace(key, '***');
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 2000 + attempt * 3000)); continue; }
    throw new Error(`ElevenLabs ${r.status}: ${detail}`);
  }
  throw new Error('ElevenLabs: retries exhausted');
}
function edge(text, file) {
  const py = 'import asyncio,sys,edge_tts\nasyncio.run(edge_tts.Communicate(sys.argv[1], sys.argv[2], rate=sys.argv[3], pitch=sys.argv[4]).save(sys.argv[5]))';
  execFileSync('python3', ['-c', py, text, VOICE.edge.name, VOICE.edge.rate, VOICE.edge.pitch, file], { stdio: 'inherit' });
}
const say = (text, file) => (engine === 'elevenlabs' ? eleven(text, file) : edge(text, file));

const sample = val('sample');
if (sample) {
  const text = args.find((a) => !a.startsWith('--')) || "Hey, it's your robot coach. Nice work so far. Let's knock out one more task before lunch.";
  await say(text, path.resolve(sample)); console.log(`sample (${engine}) -> ${sample}, ${text.length} characters sent, ${billed || text.length} billed`); process.exit(0);
}

const only = val('only') ? new Set(val('only').split(',')) : null;
const jobs = [
  ...Object.entries(SCRIPTS).map(([k, text]) => ({ id: k, text, file: path.join(out, `${k}.mp3`) })),
  ...PHRASES.map((text) => ({ id: phraseKey(text), text, file: path.join(pdir, `${phraseKey(text)}.mp3`) })),
].filter((j) => !only || only.has(j.id));
const todo = jobs.filter((j) => flag('force') || manifest[j.id]?.sig !== sig(j.text) || !existsSync(j.file));
console.log(`${engine}: ${todo.length}/${jobs.length} to (re)generate, ${todo.reduce((s, j) => s + j.text.length, 0)} characters`);
if (flag('dry')) process.exit(0);
for (const j of todo) {
  await say(j.text, j.file);
  manifest[j.id] = { sig: sig(j.text), engine, text: j.text };
  writeFileSync(manPath, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log('ok', j.id);
}
// Drop phrase MP3s whose line no longer exists.
const live = new Set(PHRASES.map(phraseKey));
for (const f of readdirSync(pdir)) { const id = f.replace(/\.mp3$/, ''); if (!live.has(id)) { unlinkSync(path.join(pdir, f)); delete manifest[id]; } }
for (const id of Object.keys(manifest)) if (!SCRIPTS[id] && !live.has(id)) delete manifest[id];
writeFileSync(manPath, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`done (${engine}): ${todo.length} files, ${chars} characters sent, ${billed} billed (provider header)`);
