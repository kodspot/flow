// Minimal stand-in for the Workers runtime module so services can be unit-tested in Node.
export class DurableObject {
  constructor(
    public ctx: unknown,
    public env: unknown,
  ) {}
}
