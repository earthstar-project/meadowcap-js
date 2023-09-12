export function predecessorTimestamp(bytes: Uint8Array): Uint8Array {
  const newBytes = new Uint8Array(bytes);

  const last = bytes[bytes.byteLength - 1];

  if (last === 0 && bytes.byteLength > 1) {
    const left = predecessorTimestamp(bytes.slice(0, bytes.byteLength - 1));

    if (last === 0 && left[left.byteLength - 1] === 0) {
      return newBytes;
    }

    newBytes.set([255], bytes.byteLength - 1);
    newBytes.set(left, 0);

    return newBytes;
  } else if (last === 0) {
    return newBytes;
  } else {
    newBytes.set([last - 1], bytes.byteLength - 1);

    return newBytes;
  }
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
