export function predecessorTimestamp(time: bigint): bigint {
  const next = time - BigInt(1);

  if (next >= BigInt(0)) {
    return next;
  }

  return BigInt(0);
}

export function predecessorPath(bytes: Uint8Array): Uint8Array {
  const last = bytes[bytes.byteLength - 1];

  if (last === 0) {
    const newBytes = new Uint8Array(bytes.slice(0, bytes.byteLength - 1));

    return newBytes;
  } else {
    const newBytes = new Uint8Array(bytes);

    if (newBytes.byteLength > 0) {
      newBytes.set([last - 1], bytes.byteLength - 1);
    }

    return newBytes;
  }
}
