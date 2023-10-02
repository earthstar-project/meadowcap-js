export function orderPaths(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
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

export function orderTimestamps(a: bigint, b: bigint): -1 | 0 | 1 {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}
