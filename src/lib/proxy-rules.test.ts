import { describe, expect, it } from "vitest";
import { signInRedirectFor } from "./proxy-rules";

describe("signInRedirectFor", () => {
  it("lets sign-in and sign-up through without a session", () => {
    expect(signInRedirectFor("/sign-in", "", [])).toBeNull();
    expect(signInRedirectFor("/sign-up", "", [])).toBeNull();
  });

  it("keeps public invoice and estimate links open", () => {
    expect(signInRedirectFor("/i/inv_ABC", "", [])).toBeNull();
    expect(signInRedirectFor("/i/inv_ABC/pdf", "", [])).toBeNull();
    expect(signInRedirectFor("/invoices", "", [])).not.toBeNull();
  });

  it("redirects app pages to sign-in and remembers where the user was going", () => {
    expect(signInRedirectFor("/clients", "?q=pine", [])).toBe("/sign-in?callbackUrl=%2Fclients%3Fq%3Dpine");
    expect(signInRedirectFor("/overview", "", ["theme"])).toBe("/sign-in");
  });

  it("recognizes plain, secure and chunked session cookies", () => {
    expect(signInRedirectFor("/clients", "", ["authjs.session-token"])).toBeNull();
    expect(signInRedirectFor("/clients", "", ["__Secure-authjs.session-token"])).toBeNull();
    expect(signInRedirectFor("/clients", "", ["authjs.session-token.0"])).toBeNull();
    expect(signInRedirectFor("/clients", "", ["authjs.csrf-token"])).not.toBeNull();
  });
});
