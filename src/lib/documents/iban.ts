/**
 * Finds an IBAN inside free-text payment instructions so the public page can offer a Copy
 * button — nobody should retype an IBAN by hand. Returns it without spaces, or null.
 */
export function extractIban(text: string | null): string | null {
  if (!text) return null;
  const match = text.toUpperCase().match(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/);
  if (!match) return null;
  const iban = match[0].replace(/ /g, "");
  return iban.length >= 15 && iban.length <= 34 ? iban : null;
}

/** "PT50000201231234567890154" → "PT50 0002 0123 1234 5678 9015 4" */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, "$1 ");
}
