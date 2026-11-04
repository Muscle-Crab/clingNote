import { NO_DATA_MIN } from './pointsVault.js';
// No usage history at all yet (e.g. onboarding, before DeviceActivity has logged a day): a typical daily-minutes guess by app/category,
// shown as an estimate. Rough public averages, deliberately coarse (bucket values) so nothing looks more precise than it is.
const TYPICAL = [[/tiktok/i, 90], [/youtube/i, 60], [/instagram|insta\b/i, 60], [/snap/i, 45], [/facebook|\bfb\b/i, 30], [/reddit/i, 45], [/^x$|twitter/i, 30],
  [/netflix|hulu|disney|prime video|max\b|twitch/i, 60], [/game|pubg|fortnite|roblox|minecraft|clash|candy|cod\b/i, 60], [/whatsapp|messenger|telegram|discord/i, 30]];
export const typicalMin = (label) => { const l = String(label || ''); const hit = TYPICAL.find(([re]) => re.test(l)); return hit ? hit[1] : NO_DATA_MIN; };

