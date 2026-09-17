import { afterEach, describe, expect, it } from "vitest";
import { resolveBaseUrl } from "./base-url";

const request = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

afterEach(() => {
  delete process.env.AUTH_URL;
});

describe("resolveBaseUrl", () => {
  it("uses the request origin when nothing else is configured", () => {
    expect(resolveBaseUrl(request("http://localhost:3000/api/v1/invoices/abc/email"))).toBe("http://localhost:3000");
  });

  it("trusts the proxy headers behind a reverse proxy", () => {
    const forwarded = request("http://127.0.0.1:3000/api/v1/invoices/abc/email", {
      "x-forwarded-host": "app.example.com",
      "x-forwarded-proto": "https",
    });
    expect(resolveBaseUrl(forwarded)).toBe("https://app.example.com");
  });

  it("assumes https when the proxy only forwards the host", () => {
    expect(resolveBaseUrl(request("http://127.0.0.1:3000/x", { "x-forwarded-host": "app.example.com" }))).toBe(
      "https://app.example.com",
    );
  });

  it("prefers AUTH_URL over a forged host, so links can't be pointed elsewhere", () => {
    process.env.AUTH_URL = "https://app.example.com/";
    const forged = request("http://localhost:3000/x", { "x-forwarded-host": "evil.example.net" });
    expect(resolveBaseUrl(forged)).toBe("https://app.example.com");
  });

  it("ignores an empty AUTH_URL", () => {
    process.env.AUTH_URL = "   ";
    expect(resolveBaseUrl(request("http://localhost:3000/x"))).toBe("http://localhost:3000");
  });
});
