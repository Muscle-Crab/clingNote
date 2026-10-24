#!/usr/bin/env python3
"""Regenerate public/voiceover/*.mp3 from src/voiceover/scripts.js with edge-tts (free, no API key). pip install edge-tts
Usage: python3 scripts/gen-voiceover.py [path/to/node]"""
import asyncio, json, subprocess, pathlib, sys
import edge_tts
root = pathlib.Path(__file__).resolve().parent.parent
node = sys.argv[1] if len(sys.argv) > 1 else 'node'
js = "import('" + (root / 'src/voiceover/scripts.js').as_uri() + "').then(m=>console.log(JSON.stringify({v:m.VOICE,s:m.SCRIPTS})))"
data = json.loads(subprocess.check_output([node, '--input-type=module', '-e', js]))
out = root / 'public/voiceover'; out.mkdir(parents=True, exist_ok=True)
async def main():
    v = data['v']
    for k, text in data['s'].items():
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, v['name'], rate=v['rate'], pitch=v['pitch']).save(str(out / f'{k}.mp3'))
                print('ok', k, flush=True); break
            except Exception as e:
                print('retry', k, e, flush=True); await asyncio.sleep(2 + attempt * 3)
        else:
            sys.exit(f'failed: {k}')
asyncio.run(main())
