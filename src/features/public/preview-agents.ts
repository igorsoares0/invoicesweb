/** Link previews (Slack, WhatsApp, mail scanners) shouldn't count as the client viewing a document. */
export const PREVIEW_AGENTS =
  /bot|crawler|spider|preview|slack|whatsapp|telegram|discord|facebookexternalhit|skype|outlook|google-read-aloud/i;
