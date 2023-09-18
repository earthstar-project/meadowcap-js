import { assert } from "$std/assert/mod.ts";
import { equals as equalsBytes } from "$std/bytes/mod.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import {
  getIncludedValues,
  getIncludedValues3d,
  getRandom3dRange,
  getRandom3dRangeInvalid,
  getRandomRange,
  getRandomRangeInvalid,
} from "../test/util.ts";
import {
  intersect3dRanges,
  intersectRanges,
  isEqualRange,
  isValid3dRange,
  isValidRange,
  orderRangePair,
} from "./ranges.ts";
import { Range } from "./types.ts";

function orderNumber(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  }

  return 0;
}

Deno.test("isValidRange", () => {
  for (let i = 0; i < 1000; i++) {
    const isValid = Math.random() > 0.5;

    if (isValid) {
      const validRange = getRandomRange({
        minValue: 0,
        successor: successorNumber,
      });

      assert(isValidRange(orderNumber, validRange));
    } else {
      const invalidRange = getRandomRangeInvalid({
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
      ? getRandom3dRange({
        minPathValue: new Uint8Array(),
        minTimeValue: BigInt(0),
        minSubspaceValue: 0,
        successorSubspace: successorNumber,
      })
      : getRandom3dRangeInvalid({
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

Deno.test("intersectRanges", () => {
  for (let i = 0; i < 100; i++) {
    const aRange: Range<number> = getRandomRange({
      minValue: 0,
      successor: successorNumber,
    });

    const bRange: Range<number> = getRandomRange({
      minValue: 0,
      successor: successorNumber,
    });

    // get results from new range

    const intersectedRange = intersectRanges(
      {
        order: orderNumber,
        getPredecessor: predecessorNumber,
        getSuccessor: successorNumber,
        isInclusiveSmaller: (a, b) => a < b,
      },
      aRange,
      bRange,
    );

    const aRangeNumbers = getIncludedValues({
      max: 100,
      order: orderNumber,
      successor: successorNumber,
    }, aRange);
    const bRangeNumbers = getIncludedValues({
      max: 100,
      order: orderNumber,
      successor: successorNumber,
    }, bRange);

    if (intersectedRange === null) {
      // Check that none of the numbers in one is in the other.

      for (const numA of aRangeNumbers) {
        if (bRangeNumbers.includes(numA)) {
          assert(false, "Got no intersection when there should be one");
        }
      }
    } else {
      const intersectedNumbers = getIncludedValues({
        max: 100,
        order: orderNumber,
        successor: successorNumber,
      }, intersectedRange);

      for (const numA of aRangeNumbers) {
        if (bRangeNumbers.includes(numA)) {
          assert(
            intersectedNumbers.includes(numA),
            "Missing number in intersection",
          );
        } else {
          assert(
            !intersectedNumbers.includes(numA),
            `
aNumbers: ${Array.from(aRangeNumbers)}
bNumbers: ${Array.from(bRangeNumbers)}
intersectedNumbers: ${Array.from(intersectedNumbers)}
`,
          );
        }
      }

      for (const numB of bRangeNumbers) {
        if (aRangeNumbers.includes(numB)) {
          assert(
            intersectedNumbers.includes(numB),
            "Missing number in intersection",
          );
        } else {
          assert(
            !intersectedNumbers.includes(numB),
            `
aNumbers: ${Array.from(aRangeNumbers)}
bNumbers: ${Array.from(bRangeNumbers)}
intersectedNumbers: ${Array.from(intersectedNumbers)}
`,
          );
        }
      }
    }

    assert(true);
  }
});

// This test can only be trusted while intersect3dRange is dependent on intersectRange
Deno.test("intersect3dRanges", () => {
  for (let i = 0; i < 100; i++) {
    const rangeA = getRandom3dRange({
      minPathValue: new Uint8Array(),
      minTimeValue: BigInt(0),
      minSubspaceValue: 0,
      successorSubspace: successorNumber,
    });

    const rangeB = getRandom3dRange({
      minPathValue: new Uint8Array(),
      minTimeValue: BigInt(0),
      minSubspaceValue: 0,
      successorSubspace: successorNumber,
    });

    const [timesA, pathsA, subspacesA] = getIncludedValues3d({
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
      maxSubspace: 100,
      maxPath: new Uint8Array([0, 0, 0, 255]),
      maxTime: BigInt(100),
    }, rangeA);

    const [timesB, pathsB, subspacesB] = getIncludedValues3d({
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
      maxSubspace: 100,
      maxPath: new Uint8Array([0, 0, 0, 255]),
      maxTime: BigInt(100),
    }, rangeB);

    const intersected = intersect3dRanges(
      {
        orderSubspace: orderNumber,
        getPredecessorSubspace: predecessorNumber,
        getSuccessorSubspace: successorNumber,
        isInclusiveSmaller: (a, b) => a < b,
        maxPathLength: 4,
      },
      rangeA,
      rangeB,
    );

    if (intersected === null) {
      // check that all intersections...

      const timeIntersection = intersectRanges(
        {
          order: orderTimestamps,
          getPredecessor: predecessorTimestamp,
          getSuccessor: successorTimestamp,
          isInclusiveSmaller: () => false,
        },
        rangeA[0],
        rangeB[0],
      );

      if (timeIntersection === null) {
        assert(true);
        continue;
      }

      const pathIntersection = intersectRanges(
        {
          order: orderPaths,
          getPredecessor: predecessorPath,
          getSuccessor: makeSuccessorPath(4),
          isInclusiveSmaller: (a, b) => a.byteLength < b.byteLength,
        },
        rangeA[1],
        rangeB[1],
      );

      if (pathIntersection === null) {
        assert(true);
        continue;
      }

      const subspaceIntersection = intersectRanges(
        {
          order: orderNumber,
          getPredecessor: predecessorNumber,
          getSuccessor: successorNumber,
          isInclusiveSmaller: () => false,
        },
        rangeA[2],
        rangeB[2],
      );

      if (subspaceIntersection === null) {
        assert(true);
        continue;
      }

      for (const time of timesA) {
        if (timesB.includes(time)) {
          assert(false, "Got no intersection when there should be one");
        }
      }

      for (const pathA of pathsA) {
        if (
          pathsB.find((pathB) => {
            return equalsBytes(pathA, pathB);
          })
        ) {
          assert(false, "Got no intersection when there should be one");
        }
      }

      for (const subspace of subspacesA) {
        if (subspacesB.includes(subspace)) {
          assert(false, "Got no intersection when there should be one");
        }
      }
    } else {
      // console.log({ rangeA, rangeB, intersected });

      const [timesIntersected, pathsIntersected, subspacesIntersected] =
        getIncludedValues3d({
          orderSubspace: orderNumber,
          successorSubspace: successorNumber,
          maxSubspace: 100,
          maxPath: new Uint8Array([0, 0, 0, 255]),
          maxTime: BigInt(100),
        }, intersected);

      // console.log({ timesA, timesB, timesIntersected });

      for (const time of timesA) {
        if (timesB.includes(time)) {
          assert(
            timesIntersected.includes(time),
            `Missing time in intersection: ${time}`,
          );
        } else {
          assert(
            !timesIntersected.includes(time),
            `Time included that should not be: ${time}`,
          );
        }
      }

      for (const time of timesB) {
        if (timesA.includes(time)) {
          assert(
            timesIntersected.includes(time),
            `Missing time in intersection: ${time}`,
          );
        } else {
          assert(
            !timesIntersected.includes(time),
            `Time included that should not be: ${time}`,
          );
        }
      }

      // console.log({ pathsA, pathsB, pathsIntersected });

      for (const path of pathsA) {
        if (pathsB.find((otherPath) => equalsBytes(path, otherPath))) {
          assert(
            pathsIntersected.find((otherPath) => equalsBytes(path, otherPath)),
            `Missing path in intersection: ${path}`,
          );
        } else {
          assert(
            !pathsIntersected.find((otherPath) => equalsBytes(path, otherPath)),
            `Path included that should not be: ${path}`,
          );
        }
      }

      for (const path of pathsB) {
        if (pathsA.find((otherPath) => equalsBytes(path, otherPath))) {
          assert(
            pathsIntersected.find((otherPath) => equalsBytes(path, otherPath)),
            `Missing path in intersection: ${path}`,
          );
        } else {
          assert(
            !pathsIntersected.find((otherPath) => equalsBytes(path, otherPath)),
            `Path included that should not be: ${path}`,
          );
        }
      }

      // console.log({ subspacesA, subspacesB, subspacesIntersected });

      for (const subspace of subspacesA) {
        if (subspacesB.includes(subspace)) {
          assert(
            subspacesIntersected.includes(subspace),
            `Missing subspace in intersection: ${subspace}`,
          );
        } else {
          assert(
            !subspacesIntersected.includes(subspace),
            `Subspace included that should not be: ${subspace}`,
          );
        }
      }

      for (const subspace of subspacesB) {
        if (subspacesA.includes(subspace)) {
          assert(
            subspacesIntersected.includes(subspace),
            `Missing subspace in intersection: ${subspace}`,
          );
        } else {
          assert(
            !subspacesIntersected.includes(subspace),
            `Subspace included that should not be: ${subspace}`,
          );
        }
      }
    }
  }
});

function successorNumber(num: number): number {
  return num + 1;
}

function predecessorNumber(num: number): number {
  return Math.max(0, num - 1);
}

Deno.test("isEqualRange", () => {
  // Valid

  for (let i = 0; i < 100; i++) {
    const rangeA = getRandomRange({
      minValue: 0,
      successor: successorNumber,
    });

    const rangeB = getRandomRange({
      minValue: 0,
      successor: successorNumber,
    });

    const [x, y] = orderRangePair(rangeA, rangeB);

    if (x.kind === "open" && y.kind === "open") {
      if (orderNumber(x.start, y.start) === 0) {
        assert(
          isEqualRange(
            { order: orderNumber, getSuccessor: successorNumber },
            x,
            y,
          ),
        );
      } else {
        assert(
          !isEqualRange(
            { order: orderNumber, getSuccessor: successorNumber },
            x,
            y,
          ),
        );
      }
    } else if (
      x.kind === "open" &&
      (y.kind === "closed_exclusive" || y.kind === "closed_inclusive")
    ) {
      assert(
        !isEqualRange(
          { order: orderNumber, getSuccessor: successorNumber },
          x,
          y,
        ),
      );
    } else if (
      (x.kind === "closed_exclusive" && y.kind === "closed_exclusive") ||
      (x.kind === "closed_inclusive" && y.kind === "closed_inclusive")
    ) {
      const startIsSame = orderNumber(x.start, y.start) === 0;
      const endIsSame = orderNumber(x.end, y.end) === 0;

      if (startIsSame && endIsSame) {
        assert(
          isEqualRange(
            { order: orderNumber, getSuccessor: successorNumber },
            x,
            y,
          ),
        );
      } else {
        assert(
          !isEqualRange(
            { order: orderNumber, getSuccessor: successorNumber },
            x,
            y,
          ),
        );
      }
    } else if (
      x.kind === "closed_exclusive" && y.kind === "closed_inclusive"
    ) {
      const startIsSame = orderNumber(x.start, y.start) === 0;
      const endIsSame = orderNumber(x.end, successorNumber(y.end)) === 0;

      if (startIsSame && endIsSame) {
        assert(
          isEqualRange(
            { order: orderNumber, getSuccessor: successorNumber },
            x,
            y,
          ),
        );
      } else {
        assert(
          !isEqualRange(
            { order: orderNumber, getSuccessor: successorNumber },
            x,
            y,
          ),
        );
      }
    }
  }
});
