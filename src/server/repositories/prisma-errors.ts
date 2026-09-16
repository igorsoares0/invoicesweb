/** Duck-typed so it survives module duplication between the generated client and tests. */
export function isPrismaError(error: unknown, code: "P2002" | "P2025"): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === code;
}
