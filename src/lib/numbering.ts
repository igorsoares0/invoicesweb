/** Sequential document numbers never reset and are zero-padded to at least four digits: INV-0044. */
export function formatDocumentNumber(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}
