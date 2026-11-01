// One shared avatar URL for the signed-in user, reused app-wide (side nav, header, profile, community).
// Cached in localStorage per uid so it paints instantly on the next launch; users/{uid}.avatarURL stays the source of truth.
import { reactive } from 'vue';
const KEY = (uid) => 'cn_avatar_' + uid;
export const myAvatar = reactive({ uid: '', url: '' });
const read = (uid) => { try { return localStorage.getItem(KEY(uid)) || ''; } catch (e) { return ''; } };
const write = (uid, url) => { try { if (url) localStorage.setItem(KEY(uid), url); else localStorage.removeItem(KEY(uid)); } catch (e) { /* quota: ignore */ } };
export const primeAvatar = (uid) => { if (!uid) { myAvatar.uid = ''; myAvatar.url = ''; return ''; } if (myAvatar.uid !== uid) { myAvatar.uid = uid; myAvatar.url = read(uid); } return myAvatar.url; };
export const setAvatar = (uid, url) => { if (!uid) return; myAvatar.uid = uid; myAvatar.url = url || ''; write(uid, myAvatar.url); };
