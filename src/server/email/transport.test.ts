import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CAPTURE_FAILURE_ADDRESS,
  capturedEmails,
  clearCapturedEmails,
  emailSender,
  getEmailTransport,
  isEmailEnabled,
} from "./transport";

const message = {
  from: "Alvorada Studio <onboarding@resend.dev>",
  to: ["billing@pineco.com"],
  subject: "Invoice INV-0044 from Alvorada Studio",
  html: "<p>Hi</p>",
  text: "Hi",
  idempotencyKey: "invoice-email/log_1",
};

const env = { ...process.env };

beforeEach(() => {
  clearCapturedEmails();
  delete process.env.EMAIL_TRANSPORT;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  process.env = { ...env };
});

describe("getEmailTransport", () => {
  it("reports no transport when nothing is configured", () => {
    expect(getEmailTransport()).toBeNull();
    expect(isEmailEnabled()).toBe(false);
  });

  it("prefers the capture transport over a real key, so tests can't send real email", () => {
    process.env.EMAIL_TRANSPORT = "capture";
    process.env.RESEND_API_KEY = "re_live_key";
    expect(getEmailTransport()?.name).toBe("capture");
    expect(isEmailEnabled()).toBe(true);
  });

  it("refuses to build a real transport against a *_test database", () => {
    process.env.RESEND_API_KEY = "re_live_key";
    process.env.DATABASE_URL = "postgresql://invoices:invoices@localhost:5434/invoices_test";
    expect(() => getEmailTransport()).toThrow(/\*_test database/);
  });

  it("builds the Resend transport with a key and a real database", () => {
    process.env.RESEND_API_KEY = "re_live_key";
    process.env.DATABASE_URL = "postgresql://invoices:invoices@localhost:5434/invoices_dev";
    expect(getEmailTransport()?.name).toBe("resend");
  });
});

describe("the capture transport", () => {
  beforeEach(() => {
    process.env.EMAIL_TRANSPORT = "capture";
  });

  it("records the message instead of sending it", async () => {
    const result = await getEmailTransport()!.send(message);
    expect(result).toEqual({ ok: true, providerId: "cap_1" });
    expect(capturedEmails()).toHaveLength(1);
    expect(capturedEmails()[0].subject).toBe(message.subject);
  });

  it("fails on purpose for the reserved address, so failures are testable", async () => {
    const result = await getEmailTransport()!.send({ ...message, to: [CAPTURE_FAILURE_ADDRESS] });
    expect(result).toEqual({ ok: false, reason: "the address was rejected", detail: expect.stringContaining("forced") });
  });
});

describe("emailSender", () => {
  it("shows the business name in front of the configured address", () => {
    expect(emailSender("Alvorada Studio")).toBe("Alvorada Studio <onboarding@resend.dev>");
  });

  it("honours a fully formed EMAIL_FROM", () => {
    process.env.EMAIL_FROM = "Billing <billing@example.com>";
    expect(emailSender("Alvorada Studio")).toBe("Billing <billing@example.com>");
  });

  it("strips characters that would break the header", () => {
    expect(emailSender('Ali<ce> "Studio"')).toBe("Alice Studio <onboarding@resend.dev>");
  });
});
