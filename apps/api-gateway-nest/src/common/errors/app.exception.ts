export class AppException extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
