// App/utils/callService.js
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';

const calls = () => firestore().collection('calls');
const history = (uid) => firestore().collection('callHistory').doc(uid).collection('items');

const now = () => Date.now();
const sv = () => firestore.FieldValue.serverTimestamp();

/** If a↔b are already in the same active channel, return that call so we can resume. */
export const getActiveCallBetween = async ({ aUid, bUid }) => {
  const [a, b] = await Promise.all([calls().doc(aUid).get(), calls().doc(bUid).get()]);
  const A = a.data?.() || {};
  const B = b.data?.() || {};
  if (!A.active || !B.active) return null;
  if (!A.channel || A.channel !== B.channel) return null;
  const samePair =
    (A.callerUid === B.callerUid && A.receiverUid === B.receiverUid) ||
    (A.callerUid === B.receiverUid && A.receiverUid === B.callerUid);
  return samePair ? { A, B } : null;
};

/** Start a call. Prevents calling someone already ringing or on a call. Adds 60s ring timeout. */
export const startCall = async (receiver, callType = 'video') => {
  const me = auth().currentUser;
  if (!me) throw new Error('Not authenticated');
  const otherUid = receiver.uid;

  // If a call between us already exists (maybe minimized), just resume that.
  const existing = await getActiveCallBetween({ aUid: me.uid, bUid: otherUid });
  if (existing) {
    return {
      ongoing: true,
      channel: existing.A.channel,
      callType: existing.A.callType,
      callerUid: existing.A.callerUid,
      receiverUid: existing.A.receiverUid,
    };
  }

  // Is receiver busy? (picked already or still within their ring window)
  const rSnap = await calls().doc(otherUid).get().catch(() => null);
  const r = rSnap?.data?.() || {};
  const ringingNotExpired = r.active && !r.picked && (!r.ringUntilMs || now() <= r.ringUntilMs);
  const inCall = r.active && (r.picked || ringingNotExpired);
  if (inCall) {
    await calls().doc(me.uid).set({ active: false, busy: true }, { merge: true });
    return { busy: true, receiverUid: otherUid };
  }

  const channel = uuidv4();
  const base = {
    channel,
    callType,
    callerUid: me.uid,
    callerName: me.displayName || me.email || 'Me',
    callerImage: me.photoURL || '',
    receiverUid: otherUid,
    receiverName: receiver.name || '',
    receiverImage: receiver.image || '',
    active: true,
    picked: false,
    minimized: false,
    graceUntilMs: null,
    createdAt: sv(),
    ringUntilMs: now() + 60 * 1000, // 60 seconds to answer
    startedAt: null, // set when answered
    busy: false,
  };

  await Promise.all([
    calls().doc(me.uid).set({ ...base, role: 'caller' }),
    calls().doc(otherUid).set({ ...base, role: 'receiver' }),
  ]);

  return { channel, callType, callerUid: me.uid, receiverUid: otherUid };
};

/** Accept call on BOTH sides. Starts duration from now. */
export const pickCallForBoth = async ({ myUid, otherUid }) => {
  const startedAt = now();
  const updates = { picked: true, active: true, minimized: false, graceUntilMs: null, busy: false, startedAt };
  await Promise.all([
    calls().doc(myUid).set(updates, { merge: true }),
    calls().doc(otherUid).set(updates, { merge: true }),
  ]);
};

/** End call for BOTH, write history with status, and cleanup. */
export const endCallForBoth = async ({ callerUid, receiverUid, reason = 'ended' }) => {
  const endTs = now();

  const [c1, c2] = await Promise.allSettled([
    calls().doc(callerUid).get(),
    calls().doc(receiverUid).get(),
  ]);

  const d1 = c1.value?.data?.() || {};
  const d2 = c2.value?.data?.() || {};
  const ch = d1.channel || d2.channel || uuidv4();
  const ctype = d1.callType || d2.callType || 'video';

  const picked = !!(d1.picked || d2.picked);
  const startedAt = d1.startedAt ?? d2.startedAt ?? null;
  const durationSec = picked && startedAt ? Math.max(0, Math.round((endTs - startedAt) / 1000)) : null;

  const updates = {
    active: false,
    minimized: false,
    picked: false,
    graceUntilMs: null,
    endedAt: endTs,
    busy: false,
  };

  await Promise.allSettled([
    calls().doc(callerUid).set(updates, { merge: true }),
    calls().doc(receiverUid).set(updates, { merge: true }),
  ]);

  const statusForCaller =
    reason === 'timeout' ? 'no-answer' :
    reason === 'declined' ? 'declined' :
    durationSec != null ? 'completed' : 'no-answer';

  const statusForReceiver =
    reason === 'timeout' ? 'missed' :
    reason === 'declined' ? 'declined' :
    durationSec != null ? 'completed' : 'missed';

  const baseRec = {
    id: ch,
    channel: ch,
    callType: ctype,
    callerUid,
    receiverUid,
    startedAt,
    endedAt: endTs,
    durationSec,
    createdAt: sv(),
  };

  await Promise.allSettled([
    history(callerUid).doc(ch).set({ ...baseRec, status: statusForCaller }, { merge: true }),
    history(receiverUid).doc(ch).set({ ...baseRec, status: statusForReceiver }, { merge: true }),
  ]);

  await Promise.allSettled([
    calls().doc(callerUid).delete(),
    calls().doc(receiverUid).delete(),
  ]);
};

/** Minimize on BOTH (shows your MiniCallBar). */
export const minimizeCall = async ({ myUid }) => {
  if (!myUid) return;

  await calls().doc(myUid).set(
    {
      minimized: true,
      active: true,
    },
    { merge: true },
  );
};

/** Resume minimized on BOTH. */
export const resumeCall = async ({ myUid }) => {
  if (!myUid) return;

  await calls().doc(myUid).set(
    {
      minimized: false,
      active: true,
    },
    { merge: true },
  );
};
