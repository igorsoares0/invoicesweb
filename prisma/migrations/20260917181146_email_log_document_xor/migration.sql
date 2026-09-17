-- An email belongs to exactly one document: an invoice or an estimate, never both and never neither.
ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_one_document" CHECK (
    ("invoiceId" IS NOT NULL AND "estimateId" IS NULL) OR ("invoiceId" IS NULL AND "estimateId" IS NOT NULL)
  );
