import "server-only";
import type { EmailLogDto, EstimateDto, InvoiceDto } from "@/lib/api-types";
import { defaultEmailMessage, defaultEmailSubject } from "@/lib/documents/email-text";
import { isZero } from "@/lib/documents/math";
import type { DocumentKind } from "@/lib/documents/view";
import { canPerform } from "@/lib/invoices/status";
import { canPerformEstimate } from "@/lib/estimates/status";
import { sendDocumentEmailSchema } from "@/lib/validation/document";
import { toFieldErrors } from "@/lib/validation/errors";
import { ApiError, ErrorCode } from "@/server/api/errors";
import { documentEmailLimiter } from "@/server/auth/rate-limit";
import type { BusinessContext } from "@/server/auth/types";
import { db } from "@/server/db";
import { buildDocumentEmail } from "@/server/email/message";
import { emailSender, getEmailTransport, type EmailAttachment } from "@/server/email/transport";
import { toEmailLogDto } from "@/server/email/serializers";
import { estimateRepository } from "@/server/repositories/estimate-repository";
import { invoiceRepository } from "@/server/repositories/invoice-repository";
import { businessRepository } from "@/server/repositories/business-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { estimateService } from "./estimate-service";
import { businessToday, invoiceService } from "./invoice-service";

export interface DocumentEmailResult {
  email: EmailLogDto;
  invoice?: InvoiceDto;
  estimate?: EstimateDto;
}

/** An email whose view button leads nowhere is worse than no email at all. */
function publicTokenOf(document: { number: string; publicToken: string | null }): string {
  if (!document.publicToken) {
    throw new ApiError(ErrorCode.CONFLICT, `${document.number} has no public link to send. Create one and try again.`);
  }
  return document.publicToken;
}

/** The PDF filename matches the one a download gives, so the client sees the same file twice. */
function attachmentName(number: string) {
  return `${number.replace(/[^\w.-]+/g, "_")}.pdf`;
}

export const emailService = {
  /**
   * Emails an invoice or estimate. A draft is marked as sent first (its own transaction), then
   * the PDF and the provider call happen outside any transaction. Because the send has already
   * committed, a provider failure is reported as a *result*, not an exception: the document
   * stays sent, the attempt is logged FAILED, and the caller decides what to tell the user.
   */
  async sendDocument(
    context: BusinessContext,
    kind: DocumentKind,
    id: string,
    input: unknown,
    baseUrl: string,
  ): Promise<DocumentEmailResult> {
    const parsed = sendDocumentEmailSchema.safeParse(input ?? {});
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error));
    const { to, attachPdf, sendCopy } = parsed.data;

    const transport = getEmailTransport();
    if (!transport) {
      throw new ApiError(ErrorCode.EMAIL_DISABLED, "Email isn't set up yet. Mark the document as sent and share its link.");
    }

    const limit = documentEmailLimiter.consume(`business:${context.businessId}`);
    if (!limit.allowed) throw ApiError.rateLimited(limit.retryAfterSeconds);

    const document = await this.prepare(context, kind, id, to);
    const [business, user] = await Promise.all([
      businessRepository.findById(context.businessId),
      userRepository.findById(context.userId),
    ]);

    const settled = document.kind === "invoice" ? isZero(document.dto.amountDue) : false;
    const text = {
      kind,
      number: document.dto.number,
      clientName: document.dto.client?.name ?? null,
      businessName: business.name,
      settled,
    };
    const subject = parsed.data.subject ?? defaultEmailSubject(text);
    const message = parsed.data.message ?? defaultEmailMessage(text);
    const copyTo = sendCopy ? (user?.email ?? business.email) : null;

    const log = await db.emailLog.create({
      data: {
        businessId: context.businessId,
        invoiceId: kind === "invoice" ? id : null,
        estimateId: kind === "estimate" ? id : null,
        type: kind === "invoice" ? "INVOICE" : "ESTIMATE",
        recipient: to[0],
        recipients: to,
        subject,
        attachedPdf: attachPdf,
        copyToSelf: Boolean(copyTo),
      },
    });

    const fail = async (reason: string, detail: string) => {
      // `reason` is what the user reads; the provider's own wording only goes to the logs.
      console.error("Document email failed", { kind, id, emailLogId: log.id, detail });
      await db.$transaction(async (tx) => {
        await tx.emailLog.update({ where: { id: log.id }, data: { status: "FAILED", error: reason } });
        if (kind === "invoice") await invoiceRepository.addEvent(tx, id, "EMAIL_FAILED", { to, reason });
        else await estimateRepository.addEvent(tx, id, "EMAIL_FAILED", { to, reason });
      });
      return this.result(context, kind, id, log.id);
    };

    let attachments: EmailAttachment[] | undefined;
    if (attachPdf) {
      try {
        const pdf =
          kind === "invoice" ? await invoiceService.pdf(context, id) : await estimateService.pdf(context, id);
        attachments = [{ filename: attachmentName(pdf.number), content: pdf.pdf }];
      } catch (error) {
        // The attachment was asked for: sending without it would misrepresent what the client got.
        return fail("the PDF attachment couldn't be built", error instanceof Error ? error.message : "PDF render failed");
      }
    }

    const { html, text: plain } = await buildDocumentEmail({
      kind,
      number: document.dto.number,
      total: document.dto.total,
      currency: document.dto.currency,
      endDate: document.endDate,
      businessName: business.name,
      businessEmail: business.email,
      publicUrl: `${baseUrl}/${kind === "invoice" ? "i" : "e"}/${document.publicToken}`,
      message,
      accentColor: document.dto.color,
      paymentInstructions: business.paymentInstructions,
    });

    const sent = await transport.send({
      from: emailSender(business.name),
      to,
      bcc: copyTo ? [copyTo] : undefined,
      // Without this, replies go to the sandbox sender instead of the business.
      replyTo: business.email ?? user?.email ?? undefined,
      subject,
      html,
      text: plain,
      attachments,
      idempotencyKey: `${kind}-email/${log.id}`,
    });

    if (!sent.ok) return fail(sent.reason, sent.detail);

    await db.$transaction(async (tx) => {
      await tx.emailLog.update({
        where: { id: log.id },
        data: { status: "SENT", providerId: sent.providerId, sentAt: new Date() },
      });
      // A first send already logged SENT with the email channel; only a re-send needs its own row.
      if (document.resend) {
        if (kind === "invoice") await invoiceRepository.addEvent(tx, id, "EMAIL_SENT", { to });
        else await estimateRepository.addEvent(tx, id, "EMAIL_SENT", { to });
      }
    });

    return this.result(context, kind, id, log.id);
  },

  /**
   * Brings the document into a state that can be emailed: sends a draft (freezing snapshots and
   * publishing the link) or, for an already-sent document, makes sure the link is still live.
   */
  async prepare(context: BusinessContext, kind: DocumentKind, id: string, to: string[]) {
    if (kind === "invoice") {
      const current = await invoiceService.get(context, id);
      if (!canPerform(current.status, "email")) {
        throw new ApiError(ErrorCode.INVALID_STATUS_TRANSITION, "A cancelled invoice can no longer be emailed.");
      }
      // A draft is sent now; anything else is a re-send, which only needs a live link.
      const resend = !canPerform(current.status, "send");
      let dto = current;
      if (!resend) dto = await invoiceService.send(context, id, { channel: "email", to });
      else if (!dto.publicToken) dto = await invoiceService.createLink(context, id);
      return { kind, dto, endDate: dto.dueDate, publicToken: publicTokenOf(dto), resend } as const;
    }

    const current = await estimateService.get(context, id);
    const { today } = await businessToday(context.businessId);
    const canEmail = canPerformEstimate(
      { status: current.status, expiryDate: current.expiryDate, convertedInvoiceId: current.convertedInvoice?.id ?? null },
      "email",
      today,
    );
    if (!canEmail) {
      throw new ApiError(
        ErrorCode.INVALID_STATUS_TRANSITION,
        current.displayStatus === "EXPIRED"
          ? "This estimate has expired. Duplicate it to send a fresh one."
          : "This estimate became an invoice — email that instead.",
      );
    }
    const resend = current.status !== "DRAFT";
    let dto = current;
    if (!resend) dto = await estimateService.send(context, id, { channel: "email", to });
    else if (!dto.publicToken) dto = await estimateService.createLink(context, id);
    return { kind, dto, endDate: dto.expiryDate, publicToken: publicTokenOf(dto), resend } as const;
  },

  async result(context: BusinessContext, kind: DocumentKind, id: string, logId: string): Promise<DocumentEmailResult> {
    const log = await db.emailLog.findUniqueOrThrow({ where: { id: logId } });
    const email = toEmailLogDto(log);
    return kind === "invoice"
      ? { email, invoice: await invoiceService.get(context, id) }
      : { email, estimate: await estimateService.get(context, id) };
  },
};
