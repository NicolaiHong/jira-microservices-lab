export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = () =>
  new DomainError(404, 'ISSUE_NOT_FOUND', 'Issue was not found');

export const validationError = (field: string, message: string) =>
  new DomainError(400, 'VALIDATION_ERROR', 'Request validation failed', {
    [field]: message,
  });

export const concurrentIssueModification = () =>
  new DomainError(
    409,
    'CONCURRENT_ISSUE_MODIFICATION',
    'Issue changed since it was last loaded',
  );
