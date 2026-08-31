/** Strip API keys and tokens from error text before showing in the UI. */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return message;
  return message
    .replace(/key=[^&\s'"]+/gi, "key=[REDACTED]")
    .replace(/AIza[0-9A-Za-z\-_]+/g, "[REDACTED]")
    .replace(/AQ\.[0-9A-Za-z\-_]+/g, "[REDACTED]")
    .replace(/sk-ant-[0-9A-Za-z\-_]+/g, "[REDACTED]")
    .replace(/sk-[0-9A-Za-z\-_]+/g, "[REDACTED]")
    .replace(/Bearer\s+[0-9A-Za-z\-_.]+/gi, "Bearer [REDACTED]");
}
