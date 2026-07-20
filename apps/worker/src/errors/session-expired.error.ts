export class SessionExpiredError extends Error {
  readonly universityId?: string;

  constructor(
    message = 'Browser session expired — re-login required',
    universityId?: string,
  ) {
    super(message);
    this.name = 'SessionExpiredError';
    this.universityId = universityId;
  }
}
