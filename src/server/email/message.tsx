import "server-only";
import { createElement } from "react";
import { formatLongDate, type IsoDate } from "@/lib/dates";
import type { DocumentKind } from "@/lib/documents/view";
import { formatMoney } from "@/lib/money";

export interface DocumentEmailInput {
  kind: DocumentKind;
  number: string;
  total: string;
  currency: string;
  /** Due date for invoices, expiry date for estimates. */
  endDate: IsoDate;
  businessName: string;
  businessEmail: string | null;
  /** Absolute link to the public page, already resolved. */
  publicUrl: string;
  /** The user's own paragraphs, as typed in the send dialog. */
  message: string;
  /** Accent colour of the document, so the email matches its PDF. */
  accentColor: string;
  /** Printed on invoices only, when the business filled it in. */
  paymentInstructions?: string | null;
}

/**
 * The email body. Deliberately tiny and inline-styled: Gmail clips messages around 102 KB, so
 * this shares no CSS and no embedded fonts with the PDF templates — only the data.
 */
function DocumentEmail(input: DocumentEmailInput) {
  const estimate = input.kind === "estimate";
  const facts: [string, string][] = [
    [estimate ? "Estimate" : "Invoice", input.number],
    [estimate ? "Total" : "Amount", formatMoney(input.total, input.currency)],
    [estimate ? "Valid until" : "Due", formatLongDate(input.endDate)],
  ];

  const text = { margin: "0 0 12px", fontSize: "15px", lineHeight: "1.55", color: "#18181b" };
  const cell = { padding: "6px 0", fontSize: "14px", color: "#3f3f46" };

  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse", backgroundColor: "#f4f4f5", padding: "24px 0" }}
    >
      <tbody>
        <tr>
          <td align="center" style={{ padding: "0 16px" }}>
            <table
              role="presentation"
              width="600"
              cellPadding={0}
              cellSpacing={0}
              style={{
                width: "600px",
                maxWidth: "100%",
                borderCollapse: "collapse",
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: "28px 32px 0" }}>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#18181b" }}>{input.businessName}</p>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "20px 32px 4px" }}>
                    {input.message
                      .split(/\n{2,}/)
                      .map((paragraph) => paragraph.trim())
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p key={index} style={text}>
                          {paragraph.split("\n").map((line, lineIndex, lines) => (
                            <span key={lineIndex}>
                              {line}
                              {lineIndex < lines.length - 1 ? <br /> : null}
                            </span>
                          ))}
                        </p>
                      ))}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 32px 0" }}>
                    <table
                      role="presentation"
                      width="100%"
                      cellPadding={0}
                      cellSpacing={0}
                      style={{
                        borderCollapse: "collapse",
                        backgroundColor: "#fafafb",
                        borderRadius: "8px",
                        padding: "4px 16px",
                      }}
                    >
                      <tbody>
                        {facts.map(([label, value]) => (
                          <tr key={label}>
                            <td style={cell}>{label}</td>
                            <td align="right" style={{ ...cell, fontWeight: 600, color: "#18181b" }}>
                              {value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "22px 32px 6px" }}>
                    <a
                      href={input.publicUrl}
                      style={{
                        display: "inline-block",
                        padding: "12px 22px",
                        borderRadius: "6px",
                        backgroundColor: input.accentColor,
                        color: "#ffffff",
                        fontSize: "15px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {estimate ? "View estimate" : "View invoice"}
                    </a>
                    <p style={{ margin: "12px 0 0", fontSize: "13px", lineHeight: "1.5", color: "#5f5f68" }}>
                      {estimate
                        ? "You can accept or decline it there, and download the PDF."
                        : "You can view it and download the PDF there."}{" "}
                      No account needed.
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: "12.5px", wordBreak: "break-all", color: "#71717a" }}>
                      {input.publicUrl}
                    </p>
                  </td>
                </tr>
                {!estimate && input.paymentInstructions?.trim() ? (
                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 600, color: "#3f3f46" }}>How to pay</p>
                      <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.55", whiteSpace: "pre-line", color: "#5f5f68" }}>
                        {input.paymentInstructions.trim()}
                      </p>
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td style={{ padding: "24px 32px 28px" }}>
                    <p style={{ margin: 0, borderTop: "1px solid #e4e4e7", paddingTop: "16px", fontSize: "12.5px", color: "#71717a" }}>
                      Sent by {input.businessName}
                      {input.businessEmail ? ` · ${input.businessEmail}` : ""}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** The plain-text alternative, built from the same data rather than stripped from the HTML. */
function documentEmailText(input: DocumentEmailInput): string {
  const estimate = input.kind === "estimate";
  const lines = [
    input.message.trim(),
    "",
    `${estimate ? "Estimate" : "Invoice"}: ${input.number}`,
    `${estimate ? "Total" : "Amount"}: ${formatMoney(input.total, input.currency)}`,
    `${estimate ? "Valid until" : "Due"}: ${formatLongDate(input.endDate)}`,
    "",
    `${estimate ? "View, accept or decline it" : "View it and download the PDF"}: ${input.publicUrl}`,
  ];
  if (!estimate && input.paymentInstructions?.trim()) {
    lines.push("", "How to pay:", input.paymentInstructions.trim());
  }
  lines.push("", `Sent by ${input.businessName}${input.businessEmail ? ` · ${input.businessEmail}` : ""}`);
  return lines.join("\n");
}

export async function buildDocumentEmail(input: DocumentEmailInput): Promise<{ html: string; text: string }> {
  // Imported lazily: Next.js only allows react-dom/server outside of component modules.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(DocumentEmail, input));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${input.number}</title></head><body style="margin:0;padding:0;background:#f4f4f5;">${markup}</body></html>`;
  return { html, text: documentEmailText(input) };
}
