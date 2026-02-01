import { ArtifactType } from './types';

export const MAX_INPUT_LENGTH = 2048;

export function sanitizeInput(input: string): string {
    // NFKC Canonicalization
    let cleaned = input.normalize('NFKC');

    // Trim
    cleaned = cleaned.trim();

    // Remove null bytes and other control characters (keeping newline/tab might be okay for text, but for artifacts usually not)
    // We strip everything < 32 except maybe TAB (9), LF (10), CR (13) if it were text.
    // But for artifacts (URL/Domain/Hash), control chars are invalid.
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Unicode homoglyph stripping or normalization is handled by NFKC mostly.

    // Prevent directory traversal sequences in raw string (visual only, as we don't use it for file access)
    // But good to clean.

    return cleaned;
}

const PRIVATE_IP_REGEX = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^0\.0\.0\.0/,
    /^169\.254\./,
    /^fc00:/,
    /^fe80:/,
    /^::1$/
];

export function validateInput(input: string): { valid: boolean; error?: string } {
    if (!input) {
        return { valid: false, error: 'Input is empty' };
    }

    if (input.length > MAX_INPUT_LENGTH) {
        return { valid: false, error: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters` };
    }

    // Basic ReDoS protection check (avoid super long repeated characters if not a hash)
    if (input.length > 100 && /(.)\1{50,}/.test(input)) {
        return { valid: false, error: 'Suspicious input pattern detected' };
    }

    // Metadata service protection (AWS/GCP/Azure)
    if (input.includes('169.254.169.254')) {
        return { valid: false, error: 'Restricted input' };
    }

    return { valid: true };
}

export function classifyArtifact(input: string): ArtifactType {
  // Strict regex patterns
  const patterns = {
      // URL: starts with http/ftp, has domain structure, no spaces
      url: /^(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i,
      // IPv4: 4 octets
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
      // IPv6: Simple check for colons and hex
      ipv6: /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])$/i,
      // Email
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      // Hashes
      hash_md5: /^[a-f0-9]{32}$/i,
      hash_sha1: /^[a-f0-9]{40}$/i,
      hash_sha256: /^[a-f0-9]{64}$/i,
      // Domain: standard hostname labels
      domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i
  };

  if (patterns.url.test(input)) return 'url';
  if (patterns.ipv4.test(input)) return 'ipv4';
  if (patterns.ipv6.test(input)) return 'ipv6';
  if (patterns.email.test(input)) return 'email';
  if (patterns.hash_md5.test(input)) return 'hash_md5';
  if (patterns.hash_sha1.test(input)) return 'hash_sha1';
  if (patterns.hash_sha256.test(input)) return 'hash_sha256';
  if (patterns.domain.test(input) && !input.includes('@')) return 'domain';

  return 'text';
}
