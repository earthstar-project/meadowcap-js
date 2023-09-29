import {
  orderNumber,
  predecessorNumber,
  successorNumber,
  TEST_MINIMAL_SUBSPACE_KEY,
  testDecodePathLength,
  testEncodePathLength,
  testHash,
  testIsCommunalFn,
  testNamespaceScheme,
  testSubspaceScheme,
} from "../test/util.ts";
import { Meadowcap } from "./meadowcap.ts";

Deno.test("isAuthorisedWrite", async () => {
  const meadowcap = new Meadowcap({
    namespaceKeypairScheme: testNamespaceScheme,
    subspaceKeypairScheme: testSubspaceScheme,
    isCommunalFn: testIsCommunalFn,
    minimalSubspacePublicKey: TEST_MINIMAL_SUBSPACE_KEY,
    orderSubspace: orderNumber,
    predecessorSubspace: predecessorNumber,
    successorSubspace: successorNumber,
    isInclusiveSmallerSubspace: () => false,
    encodePathLength: testEncodePathLength,
    decodePathLength: testDecodePathLength,
    maxPathLength: 4,
    pathBitIntLength: 1,
    hashCapability: testHash,
    encodePayloadHash: (hash: Uint8Array) => hash,
  });

  console.log(await meadowcap.generateNamespaceKeyPair(1, true));
});
