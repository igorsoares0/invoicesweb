import "server-only";

/**
 * How a document left the building, stored on its `SENT` event. One action is one history
 * line: "Marked as sent" when the user shares the link themselves, "Emailed to …" otherwise.
 */
export type SendChannel = { channel: "manual" } | { channel: "email"; to: string[] };
