import { assert } from "$std/assert/assert.ts";
import { equals as equalsBytes } from "$std/bytes/mod.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import {
  getIncludedValues,
  getIncludedValues3d,
  getRandom3dInterval,
  getRandom3dIntervalInvalid,
  getRandomInterval,
  orderNumber,
  predecessorNumber,
  randomClosedIntervalInvalid,
  successorNumber,
} from "../test/util.ts";
import {
  intersect3dIntervals,
  intersectIntervals,
  isEqualInterval,
  isValid3dInterval,
  isValidInterval,
  orderIntervalPair,
} from "./intervals.ts";
import { Interval } from "./types.ts";

Deno.test("isEqualInterval", () => {
  // Valid

  for (let i = 0; i < 100; i++) {
    const intervalA = getRandomInterval({
      minValue: 0,
      successor: successorNumber,
    });

    const intervalB = getRandomInterval({
      minValue: 0,
      successor: successorNumber,
    });

    const [x, y] = orderIntervalPair(intervalA, intervalB);

    if (x.kind === "open" && y.kind === "open") {
      if (orderNumber(x.start, y.start) === 0) {
        assert(
          isEqualInterval({ order: orderNumber }, x, y),
        );
      } else {
        assert(
          !isEqualInterval({ order: orderNumber }, x, y),
        );
      }
    } else if (
      x.kind === "open" &&
      y.kind === "closed_exclusive"
    ) {
      assert(
        !isEqualInterval({ order: orderNumber }, x, y),
      );
    } else if (
      x.kind === "closed_exclusive" && y.kind === "closed_exclusive"
    ) {
      const startIsSame = orderNumber(x.start, y.start) === 0;
      const endIsSame = orderNumber(x.end, y.end) === 0;

      if (startIsSame && endIsSame) {
        assert(
          isEqualInterval({ order: orderNumber }, x, y),
        );
      } else {
        assert(
          !isEqualInterval({ order: orderNumber }, x, y),
        );
      }
    }
  }
});

Deno.test("isValidInterval", () => {
  for (let i = 0; i < 1000; i++) {
    const isValid = Math.random() > 0.5;

    if (isValid) {
      const validRange = getRandomInterval({
        minValue: 0,
        successor: successorNumber,
      });

      assert(isValidInterval(orderNumber, validRange));
    } else {
      const invalidRange = randomClosedIntervalInvalid(
        100,
        predecessorNumber,
      );

      assert(!isValidInterval(orderNumber, invalidRange));
    }
  }
});

Deno.test("isValid3dInterval", () => {
  for (let i = 0; i < 500; i++) {
    const isValid = Math.random() > 0.5;

    const threeDimensionalRange = isValid
      ? getRandom3dInterval({
        minPathValue: new Uint8Array(),
        minTimeValue: BigInt(0),
        minSubspaceValue: 0,
        successorSubspace: successorNumber,
      })
      : getRandom3dIntervalInvalid({
        minPathValue: new Uint8Array(),
        maxPathValue: new Uint8Array([0, 0, 0, 255]),
        minTimeValue: BigInt(0),
        maxTimeValue: BigInt(1000),
        minSubspaceValue: 0,
        maxSubspaceValue: 100,
        predecessorSubspace: predecessorNumber,
        successorSubspace: successorNumber,
      });

    if (!isValid) {
      assert(!isValid3dInterval(orderNumber, threeDimensionalRange));
    } else {
      assert(isValid3dInterval(orderNumber, threeDimensionalRange));
    }
  }
});

Deno.test("intersectIntervals", () => {
  for (let i = 0; i < 100; i++) {
    const aRange: Interval<number> = getRandomInterval({
      minValue: 0,
      successor: successorNumber,
    });

    const bRange: Interval<number> = getRandomInterval({
      minValue: 0,
      successor: successorNumber,
    });

    // get results from new range

    const intersectedRange = intersectIntervals(
      { order: orderNumber },
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

Deno.test("intersect3dRanges", () => {
  for (let i = 0; i < 100; i++) {
    const intervalA = getRandom3dInterval({
      minPathValue: new Uint8Array(),
      minTimeValue: BigInt(0),
      minSubspaceValue: 0,
      successorSubspace: successorNumber,
    });

    const intervalB = getRandom3dInterval({
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
    }, intervalA);

    const [timesB, pathsB, subspacesB] = getIncludedValues3d({
      orderSubspace: orderNumber,
      successorSubspace: successorNumber,
      maxSubspace: 100,
      maxPath: new Uint8Array([0, 0, 0, 255]),
      maxTime: BigInt(100),
    }, intervalB);

    const intersected = intersect3dIntervals(
      { orderSubspace: orderNumber },
      intervalA,
      intervalB,
    );

    if (intersected === null) {
      // check that all intersections...

      const subspaceIntersection = intersectIntervals(
        { order: orderNumber },
        intervalA[0],
        intervalB[0],
      );

      if (subspaceIntersection === null) {
        assert(true);
        continue;
      }

      const pathIntersection = intersectIntervals(
        { order: orderPaths },
        intervalA[1],
        intervalB[1],
      );

      if (pathIntersection === null) {
        assert(true);
        continue;
      }

      const timeIntersection = intersectIntervals(
        { order: orderTimestamps },
        intervalA[2],
        intervalB[2],
      );

      if (timeIntersection === null) {
        assert(true);
        continue;
      }

      for (const subspace of subspacesA) {
        if (subspacesB.includes(subspace)) {
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

      for (const time of timesA) {
        if (timesB.includes(time)) {
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
