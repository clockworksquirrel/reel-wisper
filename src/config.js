import crypto from 'crypto';

const SECRET = process.env.CONFIG_SECRET || 'reelwhisper-default-secret';

function getKey() {
  return crypto.createHash('sha256').update(SECRET).digest();
}

/**
 * Encrypt a config object into a URL-safe base64 string.
 */
export function encryptConfig(config) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(config);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64url');
}

/**
 * Decrypt a URL-safe base64 string back into a config object.
 */
export function decryptConfig(encoded) {
  const key = getKey();
  const combined = Buffer.from(encoded, 'base64url');
  const iv = combined.subarray(0, 12);
  const tag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}
