// App/utils/chatService.js
import firestore from '@react-native-firebase/firestore';

const BATCH_LIMIT = 400; // stay safely under Firestore's 500-write batch cap

// Firestore has no single "delete this subcollection" call from the client,
// and a single batch write can only hold 500 operations — so we repeatedly
// grab a page of docs and batch-delete them until none remain.
async function deleteCollectionInBatches(collectionRef) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await collectionRef.limit(BATCH_LIMIT).get();
    if (snap.empty) return;
    const batch = firestore().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < BATCH_LIMIT) return; // that was the last page
  }
}

// Deletes a conversation "for me": wipes my own message history with this
// peer (Chats/{me}/{peerId}/*) and removes the entry that makes the
// conversation show up in my chat list. This does NOT touch the peer's
// side (Chats/{peerId}/{me}/*) or their own ListOfCollection entry — they
// keep their copy of the conversation. If a new message is sent by either
// side afterward, the conversation naturally reappears in both lists,
// same as before.
export async function deleteConversation({ me, peerId }) {
  if (!me || !peerId) return;

  const myMessages = firestore().collection('Chats').doc(me).collection(peerId);
  await deleteCollectionInBatches(myMessages);

  await firestore()
    .collection('ListOfCollection')
    .doc(me)
    .collection('Chat')
    .doc(peerId)
    .delete();
}
