// utils/fbUrl.js
export const normalizeFirebaseDownloadUrl = (url) => {
  if (!url) return '';
  
  let normalized = String(url)
    .trim()
    .replace(/%252F/gi, '%2F')
    .replace(/\\u0026/gi, '&')
    .replace(/&amp;/gi, '&');

  // Handle Firebase Storage URLs specifically
  if (normalized.includes('firebasestorage.googleapis.com')) {
    try {
      // Use a manual approach instead of URL constructor
      const urlParts = normalized.split('://');
      if (urlParts.length < 2) return normalized;
      
      const protocol = urlParts[0];
      const rest = urlParts[1];
      const hostAndPath = rest.split('/');
      const host = hostAndPath[0];
      const pathParts = hostAndPath.slice(1);
      
      // Decode and re-encode path segments properly
      const normalizedPathParts = pathParts.map(segment => {
        try {
          // Handle query parameters separately
          if (segment.includes('?')) {
            const [pathSegment, query] = segment.split('?');
            const encodedSegment = encodeURIComponent(decodeURIComponent(pathSegment));
            return `${encodedSegment}?${query}`;
          }
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return segment;
        }
      });
      
      normalized = `${protocol}://${host}/${normalizedPathParts.join('/')}`;
    } catch (error) {
      console.warn('URL normalization failed:', error);
    }
  }
  
  return normalized;
};