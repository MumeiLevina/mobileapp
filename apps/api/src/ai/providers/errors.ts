export type ProviderOperation =
  "text_generation" | "structured_generation" | "embedding";

export type ProviderErrorCategory =
  "timeout" | "rate_limit" | "unavailable" | "invalid_response";

export abstract class ProviderError extends Error {
  abstract readonly category: ProviderErrorCategory;

  protected constructor(
    message: string,
    readonly operation: ProviderOperation,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ProviderTimeoutError extends ProviderError {
  readonly category = "timeout" as const;

  constructor(operation: ProviderOperation) {
    super("The AI provider timed out.", operation);
  }
}

export class ProviderRateLimitError extends ProviderError {
  readonly category = "rate_limit" as const;

  constructor(operation: ProviderOperation, httpStatus = 429) {
    super("The AI provider rate limit was reached.", operation, httpStatus);
  }
}

export class ProviderUnavailableError extends ProviderError {
  readonly category = "unavailable" as const;

  constructor(operation: ProviderOperation, httpStatus?: number) {
    super("The AI provider is unavailable.", operation, httpStatus);
  }
}

export class ProviderInvalidResponseError extends ProviderError {
  readonly category = "invalid_response" as const;

  constructor(operation: ProviderOperation) {
    super("The AI provider returned an invalid response.", operation);
  }
}
