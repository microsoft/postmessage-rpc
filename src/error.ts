/**
 * An RPCError can be thrown in socket.call() if bad input is
 * passed to the service.
 */
export class RPCError extends Error {
  constructor(
    public readonly code: number,
    public readonly message: string,
    public readonly path?: string[],
  ) {
    super(`Error #${code}: ${message}`);

    // Patch for ES5 compilation target errors:
    Object.setPrototypeOf(this, RPCError.prototype);
  }

  public toReplyError() {
    return {
      code: this.code,
      message: this.message,
      path: this.path,
    };
  }
}
