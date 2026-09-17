import "server-only";

export interface EmailAttachment {
  filename: string;
  /** Raw bytes; the transport encodes them however the provider wants. */
  content: Buffer;
}

export interface EmailMessage {
  from: string;
  to: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  /** Stable per attempt, so a retry of the same attempt can't send twice. */
  idempotencyKey: string;
}

export type EmailResult =
  | { ok: true; providerId: string | null }
  /** `reason` is shown to the user; `detail` is what we store for debugging. */
  | { ok: false; reason: string; detail: string };

export interface EmailTransport {
  readonly name: "resend" | "capture";
  send(message: EmailMessage): Promise<EmailResult>;
}

/** Recipient that the capture transport always refuses, so failures are testable. */
export const CAPTURE_FAILURE_ADDRESS = "fail@capture.test";

const captured: EmailMessage[] = [];

/** Everything the capture transport has "sent" in this process (tests only). */
export function capturedEmails(): readonly EmailMessage[] {
  return captured;
}

export function clearCapturedEmails() {
  captured.length = 0;
}

const captureTransport: EmailTransport = {
  name: "capture",
  async send(message) {
    captured.push(message);
    if (message.to.some((address) => address.toLowerCase() === CAPTURE_FAILURE_ADDRESS)) {
      return { ok: false, reason: "the address was rejected", detail: "capture transport: forced failure" };
    }
    return { ok: true, providerId: `cap_${captured.length}` };
  },
};

/** Provider wording mentions Resend and domain verification; users get plain language instead. */
function friendlyReason(name: string | undefined, detail: string): string {
  switch (name) {
    case "validation_error":
    case "unprocessable_entity":
      return "the address was rejected";
    case "authorization_error":
      return /testing emails|own email address/i.test(detail)
        ? "this sender can only email your own address until a domain is verified"
        : "the sender address isn't verified yet";
    case "authentication_error":
      return "the email API key was refused";
    case "rate_limit_exceeded":
      return "too many emails at once — try again in a minute";
    default:
      return "the email provider couldn't accept it";
  }
}

function resendTransport(apiKey: string): EmailTransport {
  return {
    name: "resend",
    async send(message) {
      // Imported lazily so the capture and disabled paths never pull the SDK into the graph.
      const { Resend } = await import("resend");
      const { data, error } = await new Resend(apiKey).emails.send(
        {
          from: message.from,
          to: message.to,
          bcc: message.bcc,
          replyTo: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
          attachments: message.attachments?.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content.toString("base64"),
          })),
        },
        { idempotencyKey: message.idempotencyKey },
      );
      // The SDK reports failures in `error` instead of throwing.
      if (error) return { ok: false, reason: friendlyReason(error.name, error.message), detail: `${error.name}: ${error.message}` };
      return { ok: true, providerId: data?.id ?? null };
    },
  };
}

function isTestDatabase(): boolean {
  return /\/\w+_test(\?|$)/.test(process.env.DATABASE_URL ?? "");
}

/**
 * `EMAIL_TRANSPORT` is read before the API key on purpose: both test runners load `.env` and
 * merge it into the environment, so a developer's real key must never reach a test run.
 */
export function getEmailTransport(): EmailTransport | null {
  if (process.env.EMAIL_TRANSPORT === "capture") return captureTransport;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (isTestDatabase()) {
    throw new Error("Refusing to send real email against a *_test database. Set EMAIL_TRANSPORT=capture.");
  }
  return resendTransport(apiKey);
}

/** Whether the app can send email at all (mirrors `isGoogleEnabled` in `src/auth.ts`). */
export function isEmailEnabled(): boolean {
  return process.env.EMAIL_TRANSPORT === "capture" || Boolean(process.env.RESEND_API_KEY?.trim());
}

/** `Alvorada Studio <onboarding@resend.dev>` — the business name, the configured address. */
export function emailSender(businessName: string): string {
  const address = process.env.EMAIL_FROM?.trim() || "onboarding@resend.dev";
  if (address.includes("<")) return address;
  const name = businessName.replace(/[<>"\\]/g, "").trim();
  return name ? `${name} <${address}>` : address;
}
