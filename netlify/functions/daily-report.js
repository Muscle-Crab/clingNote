// Scheduled (hourly, see netlify.toml). For each user with userSettings/{uid}.morningReport.enabled, when it is
// 8 AM+ in their saved time zone and not yet sent for that local date: build yesterday's recap and push it to
// their own devices (OneSignal external_id = uid). No email: the project has no email service configured.
const { getAdmin, sendOneSignal } = require('./lib/notify');
const { buildRecap, localParts, reportDue, prevDay } = require('../../src/utils/dailyReport.js');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayName = (ds) => DAY_NAMES[new Date(`${ds}T12:00:00Z`).getUTCDay()];

exports.runReports = async ({ db, now = new Date(), send }) => {
  const snap = await db.collection('userSettings').where('morningReport.enabled', '==', true).get();
  const results = [];
  for (const docSnap of snap.docs) {
    const uid = docSnap.id;
    const mr = docSnap.data().morningReport || {};
    let parts;
    try { parts = localParts(now, mr.timeZone || 'America/New_York'); } catch (e) { continue; }
    if (!reportDue(parts.date, parts.hour, mr.lastSent)) continue;
    const [streakDoc, yDoc, tDoc] = await Promise.all([
      db.doc(`streaks/${uid}`).get(),
      db.doc(`weeklyRoutines/${uid}_${weekdayName(prevDay(parts.date))}`).get(),
      db.doc(`weeklyRoutines/${uid}_${weekdayName(parts.date)}`).get(),
    ]);
    const recap = buildRecap({ today: parts.date, streakDoc: streakDoc.exists ? streakDoc.data() : {}, yesterdayTasks: yDoc.exists ? yDoc.data().tasks : [], todayTasks: tDoc.exists ? tDoc.data().tasks : [], now });
    try {
      await send({ app_id: process.env.ONESIGNAL_APP_ID, include_aliases: { external_id: [uid] }, target_channel: 'push', headings: { en: recap.title }, contents: { en: recap.text.slice(0, 300) }, url: 'https://clingnot.netlify.app/home' });
      await docSnap.ref.set({ morningReport: { lastSent: parts.date } }, { merge: true });
      results.push({ uid, sent: true });
    } catch (e) { results.push({ uid, sent: false }); }
  }
  return results;
};

exports.handler = async () => {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) return { statusCode: 500, body: 'not configured' };
  const db = getAdmin().firestore();
  const res = await exports.runReports({ db, send: (p) => sendOneSignal(p) });
  return { statusCode: 200, body: JSON.stringify({ sent: res.filter((r) => r.sent).length, total: res.length }) };
};
