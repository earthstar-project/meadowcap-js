import { assertEquals } from "$std/assert/mod.ts";
import { canonicProduct } from "../products/products.ts";
import {
  getRandom3dProduct,
  orderNumber,
  predecessorNumber,
  randomCap,
  successorNumber,
  testDecodeNamespacePublicKey,
  testDecodeNamespaceSignature,
  testDecodePathLength,
  testDecodeSubspacePublicKey,
  testDecodeSubspaceSignature,
  testEncodeNamespacePublicKey,
  testEncodeNamespaceSignature,
  testEncodePathLength,
  testEncodeSubspacePublicKey,
  testEncodeSubspaceSignature,
  testIsCommunalFn,
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
    encodeSubspacePublicKey: testEncodeSubspacePublicKey,
    encodePathLength: testEncodePathLength,
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
      encodeSubspacePublicKey: testEncodeSubspacePublicKey,
      encodePathLength: testEncodePathLength,
    }, canonic);

    const decoded = decodeProduct<number>({
      decodeSubspacePubKey: testDecodeSubspacePublicKey,
      subspacePubKeyLength: 2,
      isInclusiveSmallerSubspace: () => false,
      orderSubspace: orderNumber,
      decodePathLength: testDecodePathLength,
      maxPathLength: 4,
      pathBitIntLength: 1,
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
      encodeNamespacePublicKey: testEncodeNamespacePublicKey,
      encodePathLength: testEncodePathLength,
      encodeSubspacePublicKey: testEncodeSubspacePublicKey,
      isCommunalFn: testIsCommunalFn,
      orderSubspace: orderNumber,
      encodeNamespaceSignature: testEncodeNamespaceSignature,
      encodeSubspaceSignature: testEncodeSubspaceSignature,
      isInclusiveSmallerSubspace: () => false,
      predecessorSubspace: predecessorNumber,
    }, cap);

    // Decode it.
    const { capability: decoded, length } = decodeCapability({
      decodeNamespacePubKey: testDecodeNamespacePublicKey,
      decodeSubspacePubKey: testDecodeSubspacePublicKey,
      isCommunalFn: testIsCommunalFn,
      minimalSubspaceKey: 0,

      decodeNamespaceSignature: testDecodeNamespaceSignature,
      decodeSubspaceSignature: testDecodeSubspaceSignature,
      namespacePubKeyLength: 8,
      namespaceSignatureLength: 8,
      subspacePubKeyLength: 2,
      subspaceSignatureLength: 2,
      decodePathLength: testDecodePathLength,
      isInclusiveSmallerSubspace: () => false,
      maxPathLength: 4,
      orderSubspace: orderNumber,
      pathBitIntLength: 1,
      predecessorSubspace: predecessorNumber,
      successorSubspace: successorNumber,
    }, encoded);

    assertEquals(decoded, cap);
    assertEquals(length, encoded.byteLength);
  }
});
