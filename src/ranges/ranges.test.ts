import { assert } from "$std/assert/assert.ts";
import {
  getRandomClosedRangeInvalid,
  getRandomInvalidRange3d,
  getRandomRange,
  getRandomRange3d,
  orderNumber,
  predecessorNumber,
  successorNumber,
} from "../test/util.ts";
import { isValid3dRange, isValidRange } from "./ranges.ts";

Deno.test("isValidRange", () => {
  for (let i = 0; i < 1000; i++) {
    const isValid = Math.random() > 0.5;

    if (isValid) {
      const validRange = getRandomRange({
        minValue: 0,
        predecessor: predecessorNumber,
        successor: successorNumber,
      });

      assert(isValidRange(orderNumber, validRange));
    } else {
      const invalidRange = getRandomClosedRangeInvalid({
        maxValue: 100,
        predecessor: predecessorNumber,
      });

      assert(!isValidRange(orderNumber, invalidRange));
    }
  }
});

Deno.test("isValid3dRange", () => {
  for (let i = 0; i < 500; i++) {
    const isValid = Math.random() > 0.5;

    const threeDimensionalRange = isValid
      ? getRandomRange3d({
        minPathValue: new Uint8Array(),
        minTimeValue: BigInt(0),
        minSubspaceValue: 0,
        predecessorSubspace: predecessorNumber,
        successorSubspace: successorNumber,
      })
      : getRandomInvalidRange3d({
        maxPathValue: new Uint8Array([0, 0, 0, 255]),
        maxTimeValue: BigInt(1000),
        maxSubspaceValue: 100,
        predecessorSubspace: predecessorNumber,
      });

    if (!isValid) {
      assert(!isValid3dRange(orderNumber, threeDimensionalRange));
    } else {
      assert(isValid3dRange(orderNumber, threeDimensionalRange));
    }
  }
});
