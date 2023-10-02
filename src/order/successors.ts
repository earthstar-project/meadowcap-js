export function successorTimestamp(time: bigint): bigint {
  return time + BigInt(1);
}

// The successor of a path depends on the maximum length a path can have.
// Once a path reaches the maximum length, the bytestring is incremented to the left,
// e.g. [0, 0, 0, 255] -> [0, 0, 1, 255].
export function makeSuccessorPath(
  maxLength: number,
): (bytes: Uint8Array) => Uint8Array {
  return (bytes: Uint8Array) => {
    if (bytes.byteLength < maxLength) {
      const newBytes = new Uint8Array(bytes.byteLength + 1);

      newBytes.set(bytes, 0);
      newBytes.set([0], bytes.byteLength);

      return newBytes;
    } else {
      return incrementBytesLeft(bytes);
    }
  };
}

function incrementBytesLeft(bytes: Uint8Array): Uint8Array {
  const newBytes = new Uint8Array(bytes.byteLength);

  const last = bytes[bytes.byteLength - 1];

  if (last === 255 && bytes.byteLength > 1) {
    newBytes.set([last + 1], bytes.byteLength - 1);

    const left = incrementBytesLeft(bytes.slice(0, bytes.byteLength - 1));

    if (last === 255 && left[left.byteLength - 1] === 255) {
      return bytes;
    }

    newBytes.set(left, 0);

    return newBytes;
  } else if (last === 255) {
    return bytes;
  } else {
    newBytes.set([last + 1], bytes.byteLength - 1);
    newBytes.set(bytes.slice(0, bytes.byteLength - 1), 0);

    return newBytes;
  }
}
