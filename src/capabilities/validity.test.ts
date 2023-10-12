import { assert } from "$std/assert/mod.ts";
import {
  orderNumber,
  randomCap,
  randomCapInvalid,
  TEST_MINIMAL_SUBSPACE_KEY,
  testHash,
  testIsCommunalFn,
  testNamespaceScheme,
  testPathLengthScheme,
  testPredecessorSubspace,
  testSubspaceScheme,
  testSuccessorSubspace,
} from "../test/util.ts";
import { isCapabilityValid } from "./validity.ts";

Deno.test("isCapabilityValid (valid)", async () => {
  for (let i = 0; i < 100; i++) {
    const cap = await randomCap({
      depthMaxDepth: [0, 3],
    });

    assert(
      await isCapabilityValid({
        namespaceScheme: testNamespaceScheme,
        subspaceScheme: testSubspaceScheme,
        encodePathLength: testPathLengthScheme.encode,
        isCommunalFn: testIsCommunalFn,
        isInclusiveSmallerSubspace: () => false,
        hashCapability: testHash,
        minimalSubspaceKey: TEST_MINIMAL_SUBSPACE_KEY,
        orderSubspace: orderNumber,
        predecessorSubspace: testPredecessorSubspace,
        successorSubspace: testSuccessorSubspace,
      }, cap),
    );
  }
});

Deno.test("isCapabilityValid (invalid)", async () => {
  for (let i = 0; i < 100; i++) {
    const invalidCap = await randomCapInvalid({
      depthMaxDepth: [0, 2],
    });

    if (invalidCap.kind === "source") {
      if (testIsCommunalFn(invalidCap.namespaceId)) {
        // We can't make an invalid one.
        continue;
      }
    }

    if (
      invalidCap.kind === "restriction" && invalidCap.parent.kind === "source"
    ) {
      if (testIsCommunalFn(invalidCap.parent.namespaceId)) {
        // We can't make an invalid one.
        continue;
      }
    }

    assert(
      await isCapabilityValid({
        namespaceScheme: testNamespaceScheme,
        subspaceScheme: testSubspaceScheme,
        encodePathLength: testPathLengthScheme.encode,
        isCommunalFn: testIsCommunalFn,
        isInclusiveSmallerSubspace: () => false,
        hashCapability: testHash,
        minimalSubspaceKey: TEST_MINIMAL_SUBSPACE_KEY,
        orderSubspace: orderNumber,
        predecessorSubspace: testPredecessorSubspace,
        successorSubspace: testSuccessorSubspace,
      }, invalidCap) === false,
    );
  }
});
