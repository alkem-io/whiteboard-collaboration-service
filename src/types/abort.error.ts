export class AbortError extends Error {
  constructor(public message: string, public code: string, public cause: string) {
    super(message);
    this.name = 'AbortError';
  }
}