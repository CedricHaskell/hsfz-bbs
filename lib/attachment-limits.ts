export const DOCUMENT_LIMITS = {
  maxFiles: 3,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 8 * 1024 * 1024,
  maxSubmissionBytes: 10 * 1024 * 1024,
  globalStoredBytes: 512 * 1024 * 1024,
  userBytes: 32 * 1024 * 1024,
} as const;
