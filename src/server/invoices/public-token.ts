import { randomBytes } from "node:crypto";

// Crockford base32: no I, L, O or U, so tokens survive being read aloud or retyped.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TOKEN_LENGTH = 20; // 100 bits of entropy

export const PUBLIC_TOKEN_PATTERN = /^inv_[0-9A-HJKMNP-TV-Z]{20}$/;

/** Unguessable id for public invoice links (spec §63). Never derived from the database id. */
export function generatePublicToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) token += ALPHABET[bytes[i] & 31];
  return `inv_${token}`;
}
