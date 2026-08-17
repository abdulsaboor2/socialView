// utils/media.js
import { normalizeFirebaseDownloadUrl } from './fbUrl';

export const toUrlString = (val) => {
  if (!val) return null;
  let url = null;
  if (typeof val === 'string') url = val;
  else if (typeof val === 'object' && typeof val.uri === 'string') url = val.uri;
  else if (typeof val === 'object') url = val.url || val.downloadURL || null;
  return url ? normalizeFirebaseDownloadUrl(url) : null;
};

export const getImageSource = (val, fallback) => {
  const url = toUrlString(val);
  return url ? { uri: url } : (fallback !== undefined ? fallback : undefined);
};