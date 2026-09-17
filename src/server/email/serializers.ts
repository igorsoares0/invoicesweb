import type { EmailLog } from "@/generated/prisma/client";
import type { EmailLogDto } from "@/lib/api-types";

/** The recipient list is exposed; the provider id stays server-side. */
export function toEmailLogDto(log: EmailLog): EmailLogDto {
  return {
    id: log.id,
    type: log.type,
    status: log.status,
    recipients: log.recipients,
    subject: log.subject,
    attachedPdf: log.attachedPdf,
    copyToSelf: log.copyToSelf,
    error: log.error,
    sentAt: log.sentAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}
