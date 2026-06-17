/**
 * Shared error class for the API client.
 *
 * Extracted into its own module to break the circular import between
 * lib/api.ts (which throws it) and lib/query.ts (which inspects it for
 * retry decisions).  Both files import from here; neither imports from
 * the other.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
