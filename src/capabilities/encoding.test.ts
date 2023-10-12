import { assertEquals } from "$std/assert/mod.ts";
import { canonicProduct } from "../products/products.ts";
import {
  getRandom3dProduct,
  orderNumber,
  predecessorNumber,
  randomCap,
  successorNumber,
  testIsCommunalFn,
  testNamespaceScheme,
  testPathLengthScheme,
  testSubspaceScheme,
} from "../test/util.ts";
import {
  decodeCapability,
  decodeProduct,
  encodeCapability,
  encodeProduct,
} from "./encoding.ts";

Deno.test("empty product encoding", () => {
  // empty product is 0xff

  const actual = encodeProduct({
    orderSubspace: orderNumber,
    encodeSubspacePublicKey: testSubspaceScheme.encodingScheme.publicKey.encode,
    encodePathLength: testPathLengthScheme.encode,
  }, [[], [], []]);

  assertEquals(actual, new Uint8Array([0xff]));
});

Deno.test("non-empty product encoding (roundtrip)", () => {
  for (let i = 0; i < 100; i++) {
    const product = getRandom3dProduct({
      noEmpty: true,
    });

    const canonic = canonicProduct({
      predecessorSubspace: predecessorNumber,
      isInclusiveSmallerSubspace: () => false,
    }, product);

    const encoded = encodeProduct({
      orderSubspace: orderNumber,
      encodeSubspacePublicKey:
        testSubspaceScheme.encodingScheme.publicKey.encode,
      encodePathLength: testPathLengthScheme.encode,
    }, canonic);

    const decoded = decodeProduct<number>({
      subspacePublicKeyEncodingScheme:
        testSubspaceScheme.encodingScheme.publicKey,
      isInclusiveSmallerSubspace: () => false,
      orderSubspace: orderNumber,
      pathLengthScheme: testPathLengthScheme,
      successorSubspace: successorNumber,
      predecessorSubspace: predecessorNumber,
    }, encoded);

    assertEquals(decoded.product[0], canonic[0]);
    assertEquals(decoded.product[1], canonic[1]);
    assertEquals(decoded.length, encoded.byteLength);
  }
});

Deno.test("capability encoding", async () => {
  for (let i = 0; i < 10; i++) {
    // Generate a random capability.
    const maxDepth = Math.floor(Math.random() * (8 - 1) + 1);

    const cap = await randomCap({ depthMaxDepth: [0, maxDepth] });

    // Encode it.
    const encoded = encodeCapability({
      namespaceEncodingScheme: testNamespaceScheme.encodingScheme,
      subspaceEncodingScheme: testSubspaceScheme.encodingScheme,
      encodePathLength: testPathLengthScheme.encode,
      isCommunalFn: testIsCommunalFn,
      orderSubspace: orderNumber,
      isInclusiveSmallerSubspace: () => false,
      predecessorSubspace: predecessorNumber,
    }, cap);

    // Decode it.
    const { capability: decoded, length } = decodeCapability({
      namespaceEncodingScheme: testNamespaceScheme.encodingScheme,
      subspaceEncodingScheme: testSubspaceScheme.encodingScheme,
      isCommunalFn: testIsCommunalFn,
      minimalSubspaceKey: 0,
      isInclusiveSmallerSubspace: () => false,
      orderSubspace: orderNumber,
      pathLengthScheme: testPathLengthScheme,
      predecessorSubspace: predecessorNumber,
      successorSubspace: successorNumber,
    }, encoded);

    assertEquals(decoded, cap);
    assertEquals(length, encoded.byteLength);
  }
});
