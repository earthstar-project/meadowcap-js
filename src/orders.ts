export function orderBytes(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
  const shorter = a.byteLength < b.byteLength ? a : b;

  for (let i = 0; i < shorter.byteLength; i++) {
    const aByte = a[i];
    const bByte = b[i];

    if (aByte === bByte) {
      continue;
    }

    if (aByte < bByte) {
      return -1;
    }

    if (aByte > bByte) {
      return 1;
    }
  }

  if (a.byteLength < b.byteLength) {
    return -1;
  } else if (a.byteLength > b.byteLength) {
    return 1;
  }

  return 0;
}

export function orderTimestamps(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
  const viewA = new DataView(a.buffer);
  const viewB = new DataView(b.buffer);

  const bigA = viewA.getBigUint64(0);
  const bigB = viewB.getBigUint64(0);

  if (bigA < bigB) {
    return -1;
  }

  if (bigA > bigB) {
    return 1;
  }

  return 0;
}
