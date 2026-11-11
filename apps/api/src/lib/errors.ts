/** An error with an HTTP status; app.onError turns it into `{ error }` JSON. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
