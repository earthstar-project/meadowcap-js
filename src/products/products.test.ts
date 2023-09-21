import { assert } from "$std/assert/assert.ts";
import { assertEquals } from "$std/assert/assert_equals.ts";
import { assertThrows } from "$std/assert/assert_throws.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import { equals as equalsBytes } from "$std/bytes/mod.ts";

import { Range, ThreeDimensionalRange } from "../ranges/types.ts";
import {
  getIncludedValues,
  getIncludedValues3d,
  getIncludedValues3dProduct,
  getIncludedValuesDisjointInterval,
  getRandom3dInterval,
  getRandom3dProduct,
  getRandomDisjointInterval,
  getRandomInterval,
  predecessorNumber,
  successorNumber,
} from "../test/util.ts";
import {
  addTo3dProduct,
  addToDisjointIntervalCanonically,
  canonicProduct,
  intersect3dProducts,
  intersectDisjointIntervals,
  isEqualDisjointInterval,
  merge3dProducts,
  mergeDisjointIntervals,
} from "./products.ts";
import { DisjointInterval, ThreeDimensionalProduct } from "./types.ts";
import { predecessorPath } from "../order/predecessors.ts";

function orderNumber(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  }

  return 0;
}

Deno.test("addToDisjointRange", () => {
  for (let i = 0; i < 100; i++) {
    let disjointInterval: DisjointInterval<number> = [];

    const MAX_SIZE = 100;

    for (let j = 0; j < 10; j++) {
      const expectedNumbers = getIncludedValuesDisjointInterval(
        { max: MAX_SIZE, order: orderNumber, successor: successorNumber },
        disjointInterval,
      );

      const newRange = getRandomInterval({
        minValue: 0,
        successor: successorNumber,
      });

      const newNumbers = getIncludedValues({
        max: MAX_SIZE,
        order: orderNumber,
        successor: successorNumber,
      }, newRange);

      for (const num of newNumbers) {
        if (!expectedNumbers.includes(num)) {
          expectedNumbers.push(num);
        }
      }

      const newDisjointRange = addToDisjointIntervalCanonically(
        { order: orderNumber },
        newRange,
        disjointInterval,
      );

      const newDisjointRangeNumbers = getIncludedValuesDisjointInterval(
        { max: MAX_SIZE, order: orderNumber, successor: successorNumber },
        newDisjointRange,
      );

      assertEquals(
        expectedNumbers.toSorted(orderNumber),
        newDisjointRangeNumbers.toSorted(orderNumber),
      );

      let openRangePresent = false;

      // Check canonicity.
      for (const range of newDisjointRange) {
        if (range.kind === "open") {
          if (openRangePresent) {
            assert(false, "More than one open range");
          } else {
            openRangePresent = true;
          }
        }

        if (range.kind === "closed_exclusive") {
          for (const otherRange of disjointInterval) {
            if (orderNumber(otherRange.start, range.end) === 0) {
              assert(false, "Adjacent range detected");
            }
          }
        }
      }

      {
        const allNumbers = new Set<number>();

        for (const num of newDisjointRangeNumbers) {
          if (allNumbers.has(num)) {
            assert(false, "Duplicate value included!");
          } else {
            allNumbers.add(num);
          }
        }
      }

      disjointInterval = newDisjointRange;
    }
  }
});

Deno.test("intersectDisjointInterval", () => {
  for (let i = 0; i < 100; i++) {
    const di1 = getRandomDisjointInterval({
      minValue: 0,
      maxSize: 200,
      order: orderNumber,
      successor: successorNumber,
    });
    const di2 = getRandomDisjointInterval({
      minValue: 0,
      maxSize: 200,
      order: orderNumber,
      successor: successorNumber,
    });

    const intersection = intersectDisjointIntervals(
      { order: orderNumber },
      di1,
      di2,
    );

    const numbers1 = getIncludedValuesDisjointInterval({
      max: 200,
      order: orderNumber,
      successor: successorNumber,
    }, di1);
    const numbers2 = getIncludedValuesDisjointInterval({
      max: 200,
      order: orderNumber,
      successor: successorNumber,
    }, di2);

    if (intersection) {
      const intersectionNumbers = getIncludedValuesDisjointInterval({
        max: 200,
        order: orderNumber,
        successor: successorNumber,
      }, intersection);

      for (const num1 of numbers1) {
        if (numbers2.includes(num1)) {
          assert(intersectionNumbers.includes(num1));
        } else {
          assert(!intersectionNumbers.includes(num1));
        }
      }
    } else {
      for (const num1 of numbers1) {
        assert(!numbers2.includes(num1));
      }
    }
  }
});

Deno.test("isEqualDisjointInterval", () => {
  for (let i = 0; i < 200; i++) {
    const willBeEqual = Math.random() > 0.5;

    if (willBeEqual) {
      const disjointInterval = getRandomDisjointInterval({
        minValue: 0,
        maxSize: 200,
        order: orderNumber,
        successor: successorNumber,
      });

      assert(
        isEqualDisjointInterval(
          { order: orderNumber },
          disjointInterval,
          disjointInterval,
        ),
      );
    } else {
      const disjointInterval = getRandomDisjointInterval({
        minValue: 0,
        maxSize: 200,
        order: orderNumber,
        successor: successorNumber,
      });

      const disjointInterval2 = structuredClone(disjointInterval);

      let tweaked = false;

      for (let i = 0; i < disjointInterval2.length; i++) {
        if (
          Math.random() > 0.5 ||
          (i === disjointInterval2.length - 1 && !tweaked)
        ) {
          const interval = disjointInterval2[i];

          interval.start = successorNumber(interval.start);

          if (interval.kind === "closed_exclusive") {
            interval.end = successorNumber(interval.end);
          }

          tweaked = true;
        }
      }

      assert(
        !isEqualDisjointInterval(
          { order: orderNumber },
          disjointInterval,
          disjointInterval2,
        ),
      );
    }
  }
});

// This test being this way is premised on it using addToDisjointRanges

Deno.test("mergeDisjointRanges", () => {
  for (let i = 0; i < 200; i++) {
    const expectedIncluded: number[] = [];

    const disjointIntervals: DisjointInterval<number>[] = [];

    while (true) {
      if (Math.random() > 0.9) {
        break;
      }

      const interval = getRandomDisjointInterval({
        minValue: 0,
        maxSize: 100,
        order: orderNumber,
        successor: successorNumber,
      });

      disjointIntervals.push(interval);

      const includedValues = getIncludedValuesDisjointInterval({
        max: 100,
        order: orderNumber,
        successor: successorNumber,
      }, interval);

      for (const num of includedValues) {
        if (!expectedIncluded.includes(num)) {
          expectedIncluded.push(num);
        }
      }
    }

    const merged = mergeDisjointIntervals({
      order: orderNumber,
    }, ...disjointIntervals);

    const actualIncluded: number[] = getIncludedValuesDisjointInterval({
      max: 100,
      order: orderNumber,
      successor: successorNumber,
    }, merged);

    assertEquals(
      expectedIncluded.toSorted(orderNumber),
      actualIncluded.toSorted(orderNumber),
    );
  }
});

Deno.test("addTo3dProduct", () => {
  for (let i = 0; i < 100; i++) {
    const product = getRandom3dProduct({
      minValue: 0,
      maxSize: 100,
      order: orderNumber,
      successor: successorNumber,
    });

    const interval3d = getRandom3dInterval({
      minPathValue: new Uint8Array(),
      minSubspaceValue: 0,
      minTimeValue: BigInt(0),
      successorSubspace: successorNumber,
    });

    const includedFromProduct = getIncludedValues3dProduct({
      maxSubspace: 100,
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
    }, product);

    const includedFromInterval3d = getIncludedValues3d({
      maxPath: new Uint8Array([0, 0, 0, 255]),
      maxSubspace: 100,
      maxTime: BigInt(1000),
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
    }, interval3d);

    const expectedSubspaces = new Set<number>();
    const expectedPaths: Uint8Array[] = [];
    const expectedTimes = new Set<bigint>();

    for (const num of includedFromProduct[0]) {
      expectedSubspaces.add(num);
    }

    for (const path of includedFromProduct[1]) {
      if (!expectedPaths.find((bytes) => equalsBytes(bytes, path))) {
        expectedPaths.push(path);
      }
    }

    for (const time of includedFromProduct[2]) {
      expectedTimes.add(time);
    }

    for (const num of includedFromInterval3d[0]) {
      expectedSubspaces.add(num);
    }

    for (const path of includedFromInterval3d[1]) {
      if (!expectedPaths.find((bytes) => equalsBytes(bytes, path))) {
        expectedPaths.push(path);
      }
    }

    for (const time of includedFromInterval3d[2]) {
      expectedTimes.add(time);
    }

    const actual = addTo3dProduct(
      {
        orderSubspace: orderNumber,
      },
      interval3d,
      product,
    );

    const includedFromActual = getIncludedValues3dProduct({
      maxSubspace: 100,
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
    }, actual);

    assertEquals(
      Array.from(expectedSubspaces).toSorted(orderNumber),
      includedFromActual[0].toSorted(orderNumber),
    );

    assertEquals(
      expectedPaths.toSorted(orderPaths),
      includedFromActual[1].toSorted(orderPaths),
    );

    assertEquals(
      Array.from(expectedTimes).toSorted(orderTimestamps),
      includedFromActual[2].toSorted(orderTimestamps),
    );
  }
});

Deno.test("intersect3dProducts", () => {
  for (let i = 0; i < 100; i++) {
    // Create two 3d products.
    const product1 = getRandom3dProduct({
      minValue: 0,
      maxSize: 100,
      order: orderNumber,
      successor: successorNumber,
    });

    const product2 = getRandom3dProduct({
      minValue: 0,
      maxSize: 100,
      order: orderNumber,
      successor: successorNumber,
    });

    const [expSubspaces1, expPaths1, expTimes1] = getIncludedValues3dProduct({
      maxSubspace: 100,
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
    }, product1);

    const [expSubspaces2, expPaths2, expTimes2] = getIncludedValues3dProduct({
      maxSubspace: 100,
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
    }, product2);

    const expectedSubspaces = new Set<number>();
    const expectedPaths = [];
    const expectedTimes = new Set<bigint>();

    for (const sub of expSubspaces1) {
      if (expSubspaces2.includes(sub)) {
        expectedSubspaces.add(sub);
      }
    }

    for (const path of expPaths1) {
      if (expPaths2.find((bytes) => equalsBytes(bytes, path))) {
        expectedPaths.push(path);
      }
    }

    for (const time of expTimes1) {
      if (expTimes2.includes(time)) {
        expectedTimes.add(time);
      }
    }

    const intersection = intersect3dProducts(
      {
        orderSubspace: orderNumber,
      },
      product1,
      product2,
    );

    if (
      expectedSubspaces.size === 0 || expectedPaths.length === 0 ||
      expectedTimes.size === 0
    ) {
      assertEquals(intersection, [[], [], []]);
    } else {
      const includedFromIntersected = getIncludedValues3dProduct({
        maxSubspace: 100,
        orderSubspace: orderNumber,
        successorSubspace: successorNumber,
      }, intersection);

      assertEquals(
        Array.from(expectedSubspaces).toSorted(orderNumber),
        includedFromIntersected[0].toSorted(orderNumber),
      );

      assertEquals(
        expectedPaths.toSorted(orderPaths),
        includedFromIntersected[1].toSorted(orderPaths),
      );

      assertEquals(
        Array.from(expectedTimes).toSorted(orderTimestamps),
        includedFromIntersected[2].toSorted(orderTimestamps),
      );
    }
  }
});

Deno.test("merge3dProducts", () => {
  // Okay we've tested mergeDisjointRanges...
  // and isEqualDisjointRange
  // this test is not as thorough as I'd like
  // TODO: Generate random products, make two dimensions match
  // Compare the merged non-matching dimension with addToDisjointRange result

  // Until then...
  // If any pairs match, return the merged version

  for (let i = 0; i < 200; i++) {
    const twoDimensionsMatch = Math.random() > 0.5;

    if (twoDimensionsMatch) {
      // gen one product, dupe, modify one of the dimensions
      const product1 = getRandom3dProduct({
        minValue: 0,
        maxSize: 100,
        order: orderNumber,
        successor: successorNumber,
        noEmpty: true,
      });

      const dimToModifyRoll = Math.random();
      const dimToModify = dimToModifyRoll > 0.66
        ? "subspace"
        : dimToModifyRoll > 0.33
        ? "path"
        : "timestamp";

      const product2: ThreeDimensionalProduct<number> = structuredClone(
        product1,
      );

      if (dimToModify === "subspace") {
        product2[0] = getRandomDisjointInterval({
          minValue: 0,
          maxSize: 100,
          order: orderNumber,
          successor: successorNumber,
        });
      } else if (dimToModify === "path") {
        product2[1] = getRandomDisjointInterval({
          minValue: new Uint8Array(),
          maxSize: new Uint8Array([0, 0, 0, 255]),
          order: orderPaths,
          successor: makeSuccessorPath(4),
        });
      } else {
        product2[2] = getRandomDisjointInterval({
          minValue: BigInt(0),
          maxSize: BigInt(1000),
          order: orderTimestamps,
          successor: successorTimestamp,
        });
      }

      const product3: ThreeDimensionalProduct<number> = structuredClone(
        product1,
      );

      if (dimToModify === "subspace") {
        product3[0] = getRandomDisjointInterval({
          minValue: 0,
          maxSize: 100,
          order: orderNumber,
          successor: successorNumber,
        });
      } else if (dimToModify === "path") {
        product3[1] = getRandomDisjointInterval({
          minValue: new Uint8Array(),
          maxSize: new Uint8Array([0, 0, 0, 255]),
          order: orderPaths,
          successor: makeSuccessorPath(4),
        });
      } else {
        product3[2] = getRandomDisjointInterval({
          minValue: BigInt(0),
          maxSize: BigInt(1000),
          order: orderTimestamps,
          successor: successorTimestamp,
        });
      }

      const merged = merge3dProducts(
        {
          orderSubspace: orderNumber,
        },
        product1,
        product2,
        product3,
      );

      if (dimToModify === "subspace") {
        const included1 = getIncludedValuesDisjointInterval({
          max: 100,
          order: orderNumber,
          successor: successorNumber,
        }, product1[0]);
        const included2 = getIncludedValuesDisjointInterval({
          max: 100,
          order: orderNumber,
          successor: successorNumber,
        }, product2[0]);
        const included3 = getIncludedValuesDisjointInterval({
          max: 100,
          order: orderNumber,
          successor: successorNumber,
        }, product3[0]);

        const expected = new Set<number>();

        for (const num of included1) {
          expected.add(num);
        }

        for (const num of included2) {
          expected.add(num);
        }
        for (const num of included3) {
          expected.add(num);
        }

        const actual = getIncludedValuesDisjointInterval({
          max: 100,
          order: orderNumber,
          successor: successorNumber,
        }, merged[0]);

        assertEquals(
          Array.from(expected).toSorted(orderNumber),
          actual,
        );
      } else if (dimToModify === "path") {
        const included1 = getIncludedValuesDisjointInterval({
          max: new Uint8Array([0, 0, 0, 255]),
          order: orderPaths,
          successor: makeSuccessorPath(4),
        }, product1[1]);
        const included2 = getIncludedValuesDisjointInterval({
          max: new Uint8Array([0, 0, 0, 255]),
          order: orderPaths,
          successor: makeSuccessorPath(4),
        }, product2[1]);
        const included3 = getIncludedValuesDisjointInterval({
          max: new Uint8Array([0, 0, 0, 255]),
          order: orderPaths,
          successor: makeSuccessorPath(4),
        }, product3[1]);

        const expected: Uint8Array[] = [];

        for (const path of included1) {
          if (
            expected.find((bytes) => orderPaths(path, bytes) === 0) ===
              undefined
          ) {
            expected.push(path);
          }
        }

        for (const path of included2) {
          if (
            expected.find((bytes) => orderPaths(path, bytes) === 0) ===
              undefined
          ) {
            expected.push(path);
          }
        }

        for (const path of included3) {
          if (
            expected.find((bytes) => orderPaths(path, bytes) === 0) ===
              undefined
          ) {
            expected.push(path);
          }
        }

        const actual = getIncludedValuesDisjointInterval({
          max: new Uint8Array([0, 0, 0, 255]),
          order: orderPaths,
          successor: makeSuccessorPath(4),
        }, merged[1]);

        assertEquals(
          expected.toSorted(orderPaths),
          actual,
        );
      } else {
        const included1 = getIncludedValuesDisjointInterval({
          max: BigInt(1000),
          order: orderTimestamps,
          successor: successorTimestamp,
        }, product1[2]);
        const included2 = getIncludedValuesDisjointInterval({
          max: BigInt(1000),
          order: orderTimestamps,
          successor: successorTimestamp,
        }, product2[2]);
        const included3 = getIncludedValuesDisjointInterval({
          max: BigInt(1000),
          order: orderTimestamps,
          successor: successorTimestamp,
        }, product3[2]);

        const expected = new Set<bigint>();

        for (const num of included1) {
          expected.add(num);
        }

        for (const num of included2) {
          expected.add(num);
        }
        for (const num of included3) {
          expected.add(num);
        }

        const actual = getIncludedValuesDisjointInterval({
          max: BigInt(1000),
          order: orderTimestamps,
          successor: successorTimestamp,
        }, merged[2]);

        assertEquals(
          Array.from(expected).toSorted(orderTimestamps),
          actual,
        );
      }

      // merged will include stuff from both
    } else {
      const product1 = getRandom3dProduct({
        minValue: 0,
        maxSize: 100,
        order: orderNumber,
        successor: successorNumber,
      });

      const product2 = getRandom3dProduct({
        minValue: 0,
        maxSize: 100,
        order: orderNumber,
        successor: successorNumber,
      });

      const product3 = getRandom3dProduct({
        minValue: 0,
        maxSize: 100,
        order: orderNumber,
        successor: successorNumber,
      });

      const merged = merge3dProducts(
        {
          orderSubspace: orderNumber,
        },
        product1,
        product2,
        product3,
      );

      assertEquals(merged, [[], [], []]);
    }
  }
});

Deno.test("canonicProduct", () => {
  for (let i = 0; i < 100; i++) {
    // Make a random product.

    const product = getRandom3dProduct({
      minValue: 0,
      maxSize: 100,
      order: orderNumber,
      successor: successorNumber,
    });

    const [subspaceDisjointRange, pathDisjointRange, timeDisjointRange] =
      canonicProduct({
        predecessorSubspace: predecessorNumber,
        isInclusiveSmallerSubspace: () => false,
      }, product);

    for (const range of subspaceDisjointRange) {
      if (range.kind === "open") {
        continue;
      }

      assert(range.kind === "closed_exclusive");
    }

    for (const range of pathDisjointRange) {
      if (range.kind === "open") {
        continue;
      } else if (range.kind === "closed_exclusive") {
        const inclusiveIsNotSmaller =
          predecessorPath(range.end).byteLength >= range.end.byteLength;

        assert(inclusiveIsNotSmaller);
      } else {
        const inclusiveIsSmaller = makeSuccessorPath(4)(range.end) > range.end;

        assert(inclusiveIsSmaller);
      }
    }

    for (const range of timeDisjointRange) {
      if (range.kind === "open") {
        continue;
      }

      assert(range.kind === "closed_exclusive");
    }
  }
});
