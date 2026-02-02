import { ROOT_TRUSTED_DOMAINS } from '../engines/root_trust.engine';

export type ArtifactClass =
  | 'INFRASTRUCTURE_ROOT'
  | 'TRUSTED_SERVICE'
  | 'CONTENT_ARTIFACT'
  | 'USER_GENERATED'
  | 'UNKNOWN';

export function classifyArtifact(input: string): ArtifactClass {
  let url: URL;
  try {
    // Attempt to parse as URL. If input is just "google.com", new URL() might fail or treat as relative if no protocol.
    // We assume input has been sanitized/normalized to have protocol if it's a URL,
    // but often it comes as "google.com".
    if (!input.includes('://')) {
        url = new URL(`https://${input}`);
    } else {
        url = new URL(input);
    }
  } catch (e) {
    // If it's not a valid URL/Domain, return UNKNOWN
    return 'UNKNOWN';
  }

  const hostname = url.hostname.toLowerCase();
  const path = url.pathname;
  const search = url.search;
  const hash = url.hash;

  // Check if it has significant path/query/hash
  // A path of "/" is insignificant.
  const hasContent = (path !== '/' && path !== '') || search !== '' || hash !== '';

  if (hasContent) {
      // It has content (path, query, etc.)

      // Check for user generated indicators (file extensions, common sharing paths)
      // This is a heuristic.
      if (/\.(pdf|docx|xlsx|pptx|zip|exe|apk|dmg|iso)$/i.test(path)) {
          return 'USER_GENERATED';
      }

      // Check for document sharing IDs (simple heuristic for now)
      if (path.includes('/document/d/') || path.includes('/drive/folders/') || path.includes('/file/d/')) {
           // These are often user generated content on trusted services,
           // but the prompt says "shared documents -> USER_GENERATED".
           // However, it also says "URLs with paths... -> CONTENT_ARTIFACT".
           // USER_GENERATED is a subset.
           return 'USER_GENERATED';
      }

      return 'CONTENT_ARTIFACT';
  }

  // It is a domain root (no path).

  // Check for Infrastructure Root
  // Exact match or www. match
  if (ROOT_TRUSTED_DOMAINS.has(hostname)) {
      return 'INFRASTRUCTURE_ROOT';
  }
  if (hostname.startsWith('www.')) {
      const root = hostname.slice(4);
      if (ROOT_TRUSTED_DOMAINS.has(root)) {
          return 'INFRASTRUCTURE_ROOT';
      }
  }

  // Check for Trusted Service (Subdomain of root)
  for (const root of ROOT_TRUSTED_DOMAINS) {
      if (hostname.endsWith('.' + root)) {
          return 'TRUSTED_SERVICE';
      }
  }

  return 'UNKNOWN';
}
