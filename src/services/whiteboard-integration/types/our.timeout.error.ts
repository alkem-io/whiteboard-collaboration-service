export class OurTimeoutError extends Error {
  constructor() {
    super('Timeout');
    this.name = this.constructor.name;
  }
}
