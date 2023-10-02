import { assertEquals } from "$std/assert/mod.ts";
import { canonicProduct } from "../products/products.ts";
import {
  getRandom3dProduct,
  orderNumber,
  predecessorNumber,
  randomCap,
  successorNumber,
  testDecodeAuthorSignature,
  testDecodePathLength,
  testDecodeSubspace,
  testEncodeAuthor,
  testEncodeAuthorSignature,
  testEncodeNamespace,
  testEncodePathLength,
  testEncodeSubspace,
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
    encodeSubspace: testEncodeSubspace,
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
      encodeSubspace: testEncodeSubspace,
      encodePathLength: testEncodePathLength,
    }, canonic);

    const decoded = decodeProduct({
      decodeSubspace: testDecodeSubspace,
      encodedSubspaceLength: 8,
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
      encodeNamespace: testEncodeNamespace,
      encodePathLength: testEncodePathLength,
      encodeSubspace: testEncodeSubspace,
      isCommunalFn: testIsCommunalFn,
      orderSubspace: orderNumber,
      encodeAuthorPublicKey: testEncodeAuthor,
      encodeAuthorSignature: testEncodeAuthorSignature,
      isInclusiveSmallerSubspace: () => false,
      predecessorSubspace: predecessorNumber,
    }, cap);

    // Decode it.
    const { capability: decoded, length } = decodeCapability({
      decodeNamespace: testDecodeSubspace,
      decodeSubspace: testDecodeSubspace,
      isCommunalFn: testIsCommunalFn,
      minimalSubspaceKey: 0,
      namespaceKeyLength: 8,
      authorPubkeyLength: 8,
      authorSigLength: 49,
      decodeAuthorPubKey: testDecodeSubspace,
      decodeAuthorSignature: testDecodeAuthorSignature,
      decodePathLength: testDecodePathLength,
      encodedSubspaceLength: 8,
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
