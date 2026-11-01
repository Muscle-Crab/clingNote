// One character, one voice: the robot coach. No device TTS anywhere; every static line has a bundled ElevenLabs MP3.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'; import { join } from 'path'; import assert from 'assert';
const { PHRASES, PHRASE_KEYS, phraseKey, liveChunks, MAX_LIVE_CHARS } = await import('../src/voiceover/phrases.js');
const { SCRIPTS, VOICE } = await import('../src/voiceover/scripts.js');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = walk('src').filter((f) => /\.(js|vue)$/.test(f));
for (const f of src) { const s = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
  assert(!/SpeechSynthesisUtterance|speechSynthesis\.speak|ClingVoice\.speak\(/.test(s), `${f}: device TTS`);
  assert(!/sergeant\.jpg|BossSergeant/.test(s), `${f}: old sergeant character`); }
// visible copy: no boss / sergeant naming left in templates
for (const f of src.filter((x) => x.endsWith('.vue'))) { const t = (readFileSync(f, 'utf8').match(/<template>[\s\S]*<\/template>/) || [''])[0]
  .replace(/\{\{([^}]*)\}\}/g, (m, e) => (e.match(/'[^']*'|`[^`]*`/g) || []).join(' '))
  .replace(/(class|data-test|:class|@[\w-]+|v-[\w-]+|:[\w-]+)="[^"]*"/g, '');
  assert(!/\bboss\b|sergeant|drill sergeant/i.test(t.replace(/<[^>]*>/g, ' ')), `${f}: visible boss/sergeant copy`); }
assert.equal(VOICE.provider, 'elevenlabs'); assert.equal(readFileSync('netlify/functions/lib/voice.js', 'utf8').includes(VOICE.voiceId), true, 'same voice live + bundled');
const man = JSON.parse(readFileSync('public/voiceover/manifest.json', 'utf8'));
for (const k of Object.keys(SCRIPTS)) assert(existsSync(`public/voiceover/${k}.mp3`), `missing ${k}.mp3`);
for (const p of PHRASES) assert(existsSync(`public/voiceover/p/${phraseKey(p)}.mp3`), `missing phrase mp3: ${p}`);
assert(PHRASE_KEYS.size === PHRASES.length && man && JSON.stringify(man).includes('elevenlabs'));
assert.deepEqual(liveChunks(''), []);
const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
const ch = liveChunks(long); assert(ch.length > 1 && ch.every((c) => c.length <= MAX_LIVE_CHARS) && ch.join(' ') === long, 'chunks');
assert.deepEqual(liveChunks('**Hi** there.'), ['Hi there.']);
const uv = readFileSync('src/composables/useVoiceover.js', 'utf8'); assert(uv.includes("fnUrl('tts')") || uv.includes('fnUrl("tts")'), 'live tts path');
console.log(`ok   robot voice: ${src.length} files clean, ${PHRASES.length} phrases + ${Object.keys(SCRIPTS).length} scripts bundled`);

// WebKit without an MP3 decoder (Playwright Linux WebKit) crashed its web process when a tapped task set an MP3 src.
{
  const vo = readFileSync('src/composables/useVoiceover.js', 'utf8');
  const m = vo.match(/export const canPlayMp3 = (\(a\) => \{.*\});/); assert(m, 'canPlayMp3 helper');
  const canPlayMp3 = new Function(`return ${m[1]}`)();
  assert.strictEqual(canPlayMp3({ canPlayType: () => 'maybe' }), true); assert.strictEqual(canPlayMp3({ canPlayType: () => '' }), false); assert.strictEqual(canPlayMp3({}), true);
  assert(/if \(!a \|\| my !== token \|\| !canPlayMp3\(a\)\)/.test(vo), 'playSrc guarded');
  assert(/function speakChunk[^\n]*\n\s*if \(!canPlayMp3\(el\(\)\)\)/.test(vo), 'speakChunk guarded');
  assert(/if \(a && canPlayMp3\(a\)\) \{ try \{ a\.muted = true/.test(vo), 'unlockVoice guarded');
  assert(/x && canPlayMp3\(x\)/.test(readFileSync('src/composables/useNowPlaying.js', 'utf8')), 'now playing guarded');
  console.log('ok   robot voice: no media on engines without an MP3 decoder');
}
