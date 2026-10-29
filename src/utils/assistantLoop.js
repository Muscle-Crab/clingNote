// Client tool loop for the ClingNote assistant (pure: network, executor and confirm UI are injected; tested in scripts/test-assistant.js).
// One user message = one server call per round; the model's raw parts (incl. thought signatures) are kept in `contents` unchanged.
import { validateCall, needsConfirm, describeCall } from './assistantTools';

export const MAX_STEPS = 5;
// call(input) -> { parts, toolCalls, text, remaining }; executor: { snapshot() -> { refs, context, tasksByKey, today, limitRemaining }, run(name, args) -> result }
// confirm({ name, args, summary }) -> Promise<boolean>; onEvent(e) for UI (tool ran / declined).
export async function runAgentTurn({ text, contents = [], call, executor, confirm, onEvent = () => {} }) {
  const convo = [...contents, { role: 'user', parts: [{ text: String(text) }] }];
  let remaining;
  for (let step = 0; step <= MAX_STEPS; step++) {
    const snap = await executor.snapshot();
    const res = await call({ contents: convo, context: snap.context, step });
    if (res.remaining !== undefined) remaining = res.remaining;
    const parts = Array.isArray(res.parts) ? res.parts : [];
    if (parts.length) convo.push({ role: 'model', parts });
    const calls = (res.toolCalls || []).slice(0, 6);
    if (!calls.length || step === MAX_STEPS) return { reply: String(res.text || '').trim() || (calls.length ? 'I stopped there. Anything else?' : 'Done.'), contents: convo, remaining };
    const responses = [];
    for (const c of calls) {
      const v = validateCall(c.name, c.args, { ...snap, userText: text });
      let response;
      if (!v.ok) response = { error: v.error, ...(v.limit ? { limitReached: true } : {}) };
      else if (needsConfirm(c.name, v.args) && !(await confirm({ name: c.name, args: v.args, summary: describeCall(c.name, v.args) }))) { response = c.name === 'create_tasks' ? { declined: true, note: 'Not saved. If the user said what to change, apply it and call create_tasks again with the full corrected list; otherwise drop it.' } : { declined: true, note: 'The user said no. Do not retry.' }; onEvent({ type: 'declined', name: c.name }); }
      else {
        try { response = (await executor.run(c.name, v.args)) || { ok: true }; }
        catch (e) { response = { error: (e && e.message) || 'Failed' }; }
        onEvent({ type: 'ran', name: c.name, response });
      }
      responses.push({ functionResponse: { name: c.name, response: JSON.parse(JSON.stringify(response)) } });
    }
    convo.push({ role: 'user', parts: responses });
    const fin = responses.map((r) => r.functionResponse.response).find((r) => r && r.done === true); // tool handed the turn to UI (e.g. lock guide)
    if (fin) return { reply: String(fin.summary || 'Done.'), contents: convo, remaining };
  }
  return { reply: 'Done.', contents: convo, remaining };
}
// History stored on-device only (last N turns; a turn's tool exchange is trimmed together so a functionCall never loses its response).
export const trimContents = (contents, max = 30) => {
  let c = (contents || []).slice(-max);
  while (c.length && !(c[0].role === 'user' && c[0].parts.some((p) => typeof p.text === 'string'))) c = c.slice(1);
  return c;
};
