// App/utils/postService.js
import firestore from '@react-native-firebase/firestore';

export async function toggleLike({ postId, currentUserId }) {
  if (!postId || !currentUserId) {
    throw new Error('Missing postId or currentUserId');
  }

  const db = firestore();
  const postRef = db.collection('Posts').doc(postId);

  await db.runTransaction(async transaction => {
    const postSnap = await transaction.get(postRef);

    if (!postSnap.exists) {
      throw new Error(`Post ${postId} does not exist`);
    }

    const data = postSnap.data() || {};
    const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
    const currentlyLiked = likedBy.includes(currentUserId);

    if (currentlyLiked) {
      transaction.update(postRef, {
        likedBy: firestore.FieldValue.arrayRemove(currentUserId),
        likes: firestore.FieldValue.increment(-1),
      });
    } else {
      transaction.update(postRef, {
        likedBy: firestore.FieldValue.arrayUnion(currentUserId),
        likes: firestore.FieldValue.increment(1),
      });
    }
  });
}

export function formatLikeCount(likes) {
  const n = Number(likes) || 0;
  if (n <= 0) return null;
  return n === 1 ? '1 like' : `${n} likes`;
}
