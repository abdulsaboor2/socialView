// App/utils/blockService.js
import firestore from '@react-native-firebase/firestore';

const blockDocId = (blockerId, blockedId) => `${blockerId}_${blockedId}`;

export async function blockUser({ blockerId, blockedId }) {
  if (!blockerId || !blockedId || blockerId === blockedId) return;
  await firestore()
    .collection('Blocks')
    .doc(blockDocId(blockerId, blockedId))
    .set({
      blockerId,
      blockedId,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
}

export async function unblockUser({ blockerId, blockedId }) {
  if (!blockerId || !blockedId) return;
  await firestore()
    .collection('Blocks')
    .doc(blockDocId(blockerId, blockedId))
    .delete();
}

// Live: has `blockerId` blocked `blockedId`?
export function subscribeIsBlockedByMe({ blockerId, blockedId }, cb) {
  if (!blockerId || !blockedId) {
    cb(false);
    return () => {};
  }
  return firestore()
    .collection('Blocks')
    .doc(blockDocId(blockerId, blockedId))
    .onSnapshot(
      snap => cb(snap.exists),
      () => cb(false),
    );
}

// Live: has `otherUid` blocked `myUid` (the reverse direction)?
export function subscribeAmIBlockedBy({ myUid, otherUid }, cb) {
  if (!myUid || !otherUid) {
    cb(false);
    return () => {};
  }
  return firestore()
    .collection('Blocks')
    .doc(blockDocId(otherUid, myUid))
    .onSnapshot(
      snap => cb(snap.exists),
      () => cb(false),
    );
}
