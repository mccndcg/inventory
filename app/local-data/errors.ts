export type RepositoryErrorCode =
  | "ALREADY_EXISTS"
  | "IMMUTABLE_RECORD"
  | "INVALID_RECORD"
  | "NOT_FOUND"
  | "OWNERSHIP_MISMATCH";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}
