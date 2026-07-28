export type DomainErrorCode =
  | "INVALID_AMOUNT"
  | "INVALID_DATE"
  | "INVALID_IDENTITY"
  | "INVALID_NOTES"
  | "INVALID_QUANTITY"
  | "INVALID_SIGN"
  | "OVERFLOW";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}
