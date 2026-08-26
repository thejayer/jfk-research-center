/** Typed failure from the server-side API client. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string) {
    super(`API request failed: ${status} ${path}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.path = path;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}
