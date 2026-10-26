// Server-side prompt builders: the client sends structured input only, so the function can't be used as an open OpenAI proxy.
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f`]/g, ' ').trim().slice(0, n);
const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

const MEAL_IMAGE_TEXT = `You are analyzing a product image like a smoothie or drink. If it shows a visible nutrition label, extract the values **exactly as shown**. Return the full nutrient data per container (not per 100g).

Return JSON like:
{
  "foods": ["Bolthouse Farms Blue Goodness Smoothie"],
  "nutrients": { "Calories": 260, "Carbs": 62, "Protein": 1, "Fat": 0, "Sugar": 52, "Sodium": 30, "Fiber": 3, "VitaminC": 140, "VitaminD": 0 }
}

If no label is visible, do your best to estimate. Do not explain anything. Output only JSON.`;

const EQUIP = { 'None': 'No equipment at all', 'Resistance Bands': 'Only resistance bands', 'Resistance Bands + Equipment': 'Resistance bands with dumbbells or kettlebells' };

// Returns { body (OpenAI request), costsCredit }
const buildRequest = (task, input = {}) => {
  if (task === 'meal-image') {
    const b64 = String(input.imageBase64 || '');
    if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length < 100) throw Object.assign(new Error('Bad image'), { status: 400 });
    if (b64.length > 6_000_000) throw Object.assign(new Error('Image too large'), { status: 413 });
    return { costsCredit: true, body: { model: 'gpt-4o', max_tokens: 1000, messages: [{ role: 'user', content: [{ type: 'text', text: MEAL_IMAGE_TEXT }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }] }] } };
  }
  if (task === 'meal-text') {
    const food = clip(input.food, 200);
    if (!food) throw Object.assign(new Error('Empty food'), { status: 400 });
    return { costsCredit: false, body: { model: 'gpt-4o-mini', max_tokens: 500, messages: [{ role: 'user', content: `Estimate these nutrients (Calories, Protein, Fat, Carbs, Sugar, Sodium, Fiber, VitaminC, VitaminD) for this food: ${food}. Return a JSON object.` }] } };
  }
  if (task === 'workout') {
    const p = input || {};
    const equipment = EQUIP[p.equipment] || 'Full gym equipment';
    const prompt = `Create a ${int(p.daysPerWeek, 1, 7, 6)}-day workout routine for someone who wants to train with: ${equipment}.
Goal: ${clip(p.goal, 40) || 'General Fitness'}, Duration: ${int(p.duration, 5, 180, 20)} minutes, Fitness Level: ${pick(p.fitnessLevel, ['Beginner', 'Intermediate', 'Advanced'], 'Beginner')}, Focus: ${clip(p.focusArea, 40) || 'Full Body'}, Intensity: ${pick(p.intensity, ['Low', 'Moderate', 'High'], 'Moderate')}, Style: ${clip(p.style, 40) || 'any'}.
Limit to a maximum of ${int(p.maxPerDay, 1, 10, 3)} workouts per day.
Return in JSON format like:
{
  "Mon": [{ "title": "...", "type": "recurring", "completed": false }],
  ...
}`;
    return { costsCredit: false, body: { model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] } };
  }
  if (task === 'voice-intent') {
    // Spoken utterance -> JSON items. The client validates the result (src/utils/voiceIntent.js normalizeItems) and falls back to its local parser.
    const text = clip(input.text, 500); const nowLocal = clip(input.now, 25); const tz = clip(input.tz, 60);
    if (!text) throw Object.assign(new Error('Empty text'), { status: 400 });
    const sys = `You turn one spoken sentence into planner items. The user's local time is ${nowLocal || 'unknown'} (${tz || 'local'} timezone).
Return ONLY JSON: {"items":[{"type":"task|reminder|schedule","title":"short imperative title","date":"YYYY-MM-DD","start":"HH:MM or empty","durationMin":0,"remindAt":"YYYY-MM-DDTHH:MM or empty"}]}
Rules: "remind me"/"don't forget" or an action at a clock time without a length = reminder (remindAt required). "schedule"/"block"/"book" or a time range or length on a day = schedule (start + durationMin). Otherwise task.
A time already past today with no date means tomorrow. Morning 09:00, after lunch 13:00, afternoon 15:00, evening 18:00 (3h block), tonight 20:00. Split several requests into several items. Never invent items.`;
    return { costsCredit: false, body: { model: 'gpt-4o-mini', temperature: 0, max_tokens: 600, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: text }] } };
  }
  throw Object.assign(new Error('Unknown task'), { status: 400 });
};

module.exports = { buildRequest };
