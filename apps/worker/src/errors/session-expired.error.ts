export class SessionExpiredError extends Error {
  constructor(message = 'ZZU session expired — update zzu-session.json manually') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}
