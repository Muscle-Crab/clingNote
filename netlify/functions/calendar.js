// GET /.netlify/functions/calendar?token=<48 hex>  -> text/calendar feed of the token owner's scheduled/dated tasks.
// Token -> uid lookup in Firestore icsTokens/{token} (created/revoked by the owner in the app). Unknown/revoked -> 404.
const { getAdmin } = require('./lib/notify');
const { buildCalendar, feedEvents, isValidToken } = require('../../src/utils/ics.js');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

exports.buildFeed = async (db, token) => {
  if (!isValidToken(token)) return null;
  const tok = await db.doc(`icsTokens/${token}`).get();
  if (!tok.exists || tok.data().revoked) return null;
  const { uid } = tok.data();
  const [user, ...days] = await Promise.all([db.doc(`users/${uid}`).get(), ...DAY_NAMES.map((d) => db.doc(`weeklyRoutines/${uid}_${d}`).get())]);
  const scheduled = user.exists ? (user.data().scheduledTasks?.tasks || []) : [];
  const dayLists = Object.fromEntries(DAY_NAMES.map((d, i) => [d, days[i].exists ? days[i].data().tasks || [] : []]));
  return buildCalendar(feedEvents(scheduled, dayLists));
};

exports.handler = async (event, ctx, deps = {}) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') return { statusCode: 405, body: '' };
  const token = event.queryStringParameters?.token || '';
  try {
    const ics = await exports.buildFeed(deps.db || getAdmin().firestore(), token);
    if (!ics) return { statusCode: 404, body: 'Not found' };
    return { statusCode: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'X-Robots-Tag': 'noindex' }, body: ics };
  } catch (e) { return { statusCode: 500, body: 'Error' }; }
};
