import { assertEquals } from "$std/assert/mod.ts";
import { canonicProduct } from "../products/products.ts";
import {
  getRandom3dProduct,
  orderNumber,
  predecessorNumber,
  successorNumber,
} from "../test/util.ts";
import { decodeProduct, encodeProduct } from "./encoding.ts";

Deno.test("empty product encoding", () => {
  // empty product is 0xff

  const actual = encodeProduct({
    orderSubspace: testOrderSubspace,
    encodeSubspace: testEncodeSubspace,
    encodePathLength: testEncodePathLength,
  }, [[], [], []]);

  assertEquals(actual, new Uint8Array([0xff]));
});

Deno.test("non-empty product encoding (roundtrip)", () => {
  for (let i = 0; i < 100; i++) {
    const product = getRandom3dProduct({
      noEmpty: true,
      order: orderNumber,
      successor: successorNumber,
      maxSize: 200,
      minValue: 0,
    });

    const canonic = canonicProduct({
      predecessorSubspace: predecessorNumber,
      isInclusiveSmallerSubspace: () => false,
    }, product);

    const encoded = encodeProduct({
      orderSubspace: testOrderSubspace,
      encodeSubspace: testEncodeSubspace,
      encodePathLength: testEncodePathLength,
    }, canonic);

    const decoded = decodeProduct({
      decodeSubspace: testDecodeSubspace,
      encodedSubspaceLength: 8,
      getPredecessorSubspace: predecessorNumber,
      getSuccessorSubspace: successorNumber,
      isInclusiveSmallerSubspace: () => false,
      orderSubspace: orderNumber,
      decodePathLength: testDecodePathLength,
      maxPathLength: 4,
      pathBitIntLength: 1,
    }, encoded);

    assertEquals(canonic[0], decoded[0]);
    assertEquals(canonic[1], decoded[1]);
  }
});

function testEncodeNamespace(namespace: Uint8Array): Uint8Array {
  return namespace;
}

function testEncodeSubspace(number: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(number));

  return bytes;
}

function testDecodeSubspace(encoded: Uint8Array): number {
  const view = new DataView(encoded.buffer);
  return Number(view.getBigUint64(0));
}

function testIsCommunalFn(namespace: Uint8Array): boolean {
  return (namespace[0] | 0x80) === 0x80;
}
function testOrderSubspace(a: number, b: number): -1 | 0 | 1 {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  }

  return 0;
}

function testEncodePath(path: Uint8Array) {
  const len = path.byteLength;
  const bytes = new Uint8Array(path.byteLength + 1);
  bytes.set([len], 0);
  bytes.set(path, 1);
  return bytes;
}

function testEncodePathLength(length: number) {
  return new Uint8Array([length]);
}

function testDecodePathLength(bytes: Uint8Array) {
  return bytes[0];
}

function encodeAuthorPublicKey(key: Uint8Array): Uint8Array {
  return key;
}
function encodeAuthorSignature(sig: Uint8Array): Uint8Array {
  return sig;
}
