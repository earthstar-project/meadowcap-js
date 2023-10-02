/** Generic top-level error class that other Meadowcap errors inherit from. */
export class MeadowcapError extends Error {
  constructor(message?: string) {
    super(message || "");
    this.name = "MeadowcapError";
  }
}

/** Thrown when an invalid capability was produced. */
export class InvalidCapError extends MeadowcapError {
  constructor(message?: string) {
    super(message || "InvalidCapError");
    this.name = "InvalidCapError";
  }
}

/** Check if any value is a subclass of MeadowcapError (return true) or not (return false) */
export function isErr<T>(x: T | Error): x is MeadowcapError {
  return x instanceof MeadowcapError;
}

/** Check if any value is a subclass of MeadowcapError (return false) or not (return true) */
export function notErr<T>(x: T | Error): x is T {
  return !(x instanceof MeadowcapError);
}
