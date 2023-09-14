export function successorTimestamp(bytes: Uint8Array): Uint8Array {
  const newBytes = new Uint8Array(bytes.byteLength);

  const last = bytes[bytes.byteLength - 1];

  if (last === 255 && bytes.byteLength > 1) {
    newBytes.set([last + 1], bytes.byteLength - 1);

    const left = successorTimestamp(bytes.slice(0, bytes.byteLength - 1));

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

export function successorPath(bytes: Uint8Array): Uint8Array {
  const last = bytes[bytes.byteLength - 1];

  if (last === 255) {
    const newBytes = new Uint8Array(bytes.byteLength + 1);

    newBytes.set(bytes, 0);
    newBytes.set([0], bytes.byteLength);

    return newBytes;
  } else {
    const newBytes = new Uint8Array(bytes);

    newBytes.set([last + 1], bytes.byteLength - 1);

    return newBytes;
  }
}
