import { assert, assertEquals, assertThrows } from "$std/assert/mod.ts";
import {
  intersect3dRanges,
  intersectRanges,
  isEqualRange,
  isValid3dRange,
  isValidRange,
} from "./ranges.ts";
import { Range, ThreeDimensionalRange } from "./types.ts";

function orderNumber(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  }

  return 0;
}

Deno.test("isValidRange", () => {
  const nonsenseRange1: Range<number> = {
    kind: "closed_exclusive",
    start: 1,
    end: 1,
  };

  const nonsenseRange2: Range<number> = {
    kind: "closed_exclusive",
    start: 2,
    end: 1,
  };

  const nonsenseRange3: Range<number> = {
    kind: "closed_inclusive",
    start: 2,
    end: 1,
  };

  assert(!isValidRange(orderNumber, nonsenseRange1));
  assert(!isValidRange(orderNumber, nonsenseRange2));
  assert(!isValidRange(orderNumber, nonsenseRange3));

  const sensibleRange1: Range<number> = {
    kind: "closed_exclusive",
    start: 1,
    end: 3,
  };

  const sensibleRange2: Range<number> = {
    kind: "closed_inclusive",
    start: 2,
    end: 2,
  };

  const sensibleRange3: Range<number> = {
    kind: "open",
    start: 3,
  };

  assert(isValidRange(orderNumber, sensibleRange1));
  assert(isValidRange(orderNumber, sensibleRange2));
  assert(isValidRange(orderNumber, sensibleRange3));
});

Deno.test("isValid3dRange", () => {
  const timestampOld = new Uint8Array(8);
  const timestampOldView = new DataView(timestampOld.buffer);
  timestampOldView.setBigUint64(0, BigInt(1000));

  const timestampNew = new Uint8Array(8);
  const timestampNewView = new DataView(timestampNew.buffer);
  timestampNewView.setBigUint64(0, BigInt(3000));

  const pathA = new TextEncoder().encode("aaaa");
  const pathG = new TextEncoder().encode("gggg");

  const sensibleRange: ThreeDimensionalRange<number> = [
    {
      kind: "closed_exclusive",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed_inclusive",
      start: pathA,
      end: pathG,
    },
    {
      kind: "open",
      start: 8,
    },
  ];

  assert(isValid3dRange(orderNumber, sensibleRange));

  const nonsenseRange1: ThreeDimensionalRange<number> = [
    {
      kind: "closed_exclusive",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed_inclusive",
      start: pathG,
      end: pathA,
    },
    {
      kind: "open",
      start: 1,
    },
  ];

  assert(!isValid3dRange(orderNumber, nonsenseRange1));
});

function getNumbers(size: number, startAt = 0) {
  return [...Array(size).keys()].map((i) => i + startAt);
}

function getNumbersOfRange(range: Range<number>, maxSize: number): Set<number> {
  const numbers = new Set<number>();

  if (range.kind === "open") {
    for (let i = range.start; i <= maxSize; i++) {
      numbers.add(i);
    }
  } else if (range.kind === "closed_exclusive") {
    for (const num of getNumbers(range.end - range.start, range.start)) {
      numbers.add(num);
    }
  } else {
    for (const num of getNumbers(range.end - range.start + 1, range.start)) {
      numbers.add(num);
    }
  }

  return numbers;
}

Deno.test("intersectRanges", () => {
  const MAX_SIZE = 49;

  for (let i = 0; i < 1000; i++) {
    const startA = Math.floor(Math.random() * MAX_SIZE);
    const startB = Math.floor(Math.random() * MAX_SIZE);

    const aRoll = Math.random();
    const bRoll = Math.random();

    const aType: Range<number>["kind"] = aRoll < 0.33
      ? "open"
      : aRoll < 0.66
      ? "closed_exclusive"
      : "closed_inclusive";
    const bType: Range<number>["kind"] = bRoll < 0.33
      ? "open"
      : bRoll < 0.66
      ? "closed_exclusive"
      : "closed_inclusive";

    const aRange: Range<number> = aType === "open"
      ? {
        kind: "open",
        start: startA,
      }
      : aType === "closed_exclusive"
      ? {
        kind: "closed_exclusive",
        start: startA,
        end: Math.floor(Math.random() * (MAX_SIZE - startA + 1) + startA + 1),
      }
      : {
        kind: "closed_inclusive",
        start: startA,
        end: Math.floor(Math.random() * (MAX_SIZE - startA + 1) + startA + 1),
      };

    const bRange: Range<number> = bType === "open"
      ? {
        kind: "open",
        start: startB,
      }
      : bType === "closed_exclusive"
      ? {
        kind: "closed_exclusive",
        start: startB,
        end: Math.floor(Math.random() * (MAX_SIZE - startB + 1) + startB + 1),
      }
      : {
        kind: "closed_inclusive",
        start: startB,
        end: Math.floor(Math.random() * (MAX_SIZE - startB + 1) + startB + 1),
      };

    // get results from new range

    const intersectedRange = intersectRanges(
      {
        order: orderNumber,
        getSuccessor: getSuccessorNumber,
        isInclusiveSmaller: (a, b) => a < b,
      },
      aRange,
      bRange,
    );

    const aRangeNumbers = getNumbersOfRange(aRange, MAX_SIZE + 1);
    const bRangeNumbers = getNumbersOfRange(bRange, MAX_SIZE + 1);

    if (intersectedRange === null) {
      // Check that none of the numbers in one is in the other.
      console.log({
        aRange,
        bRange,
        aRangeNumbers,
        bRangeNumbers,
      });

      for (const numA of aRangeNumbers) {
        if (bRangeNumbers.has(numA)) {
          assert(false, "Got no intersection when there should be one");
        }
      }
    } else {
      const intersectedNumbers = getNumbersOfRange(
        intersectedRange,
        MAX_SIZE + 1,
      );

      console.log({
        aRange,
        bRange,
        intersectedRange,
        aRangeNumbers,
        bRangeNumbers,
        intersectedNumbers,
      });

      for (const numA of aRangeNumbers) {
        if (bRangeNumbers.has(numA)) {
          assert(
            intersectedNumbers.has(numA),
            "Missing number in intersection",
          );
        } else {
          assert(
            !intersectedNumbers.has(numA),
            `
aNumbers: ${Array.from(aRangeNumbers)}
bNumbers: ${Array.from(bRangeNumbers)}
intersectedNumbers: ${Array.from(intersectedNumbers)}
`,
          );
        }
      }

      for (const numB of bRangeNumbers) {
        if (aRangeNumbers.has(numB)) {
          assert(
            intersectedNumbers.has(numB),
            "Missing number in intersection",
          );
        } else {
          assert(
            !intersectedNumbers.has(numB),
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
  const timestampOld = new Uint8Array(8);
  const timestampOldView = new DataView(timestampOld.buffer);
  timestampOldView.setBigUint64(0, BigInt(1000));

  const timestampNew = new Uint8Array(8);
  const timestampNewView = new DataView(timestampNew.buffer);
  timestampNewView.setBigUint64(0, BigInt(3000));

  const timestampNewer = new Uint8Array(8);
  const timestampNewerView = new DataView(timestampNewer.buffer);
  timestampNewerView.setBigUint64(0, BigInt(9000));

  const pathA = new TextEncoder().encode("aaaa");
  const pathG = new TextEncoder().encode("gggg");
  const pathT = new TextEncoder().encode("tttt");

  // throws if passed nonsense product

  const nonsenseRange: ThreeDimensionalRange<number> = [
    { kind: "closed_exclusive", start: timestampNewer, end: timestampOld },
    { kind: "open", start: pathA },
    { kind: "open", start: 2 },
  ];

  const openRange: ThreeDimensionalRange<number> = [
    { kind: "open", start: timestampNewer },
    { kind: "open", start: pathA },
    { kind: "open", start: 2 },
  ];

  assertThrows(() => {
    intersect3dRanges(
      {
        orderSubspace: orderNumber,
        getSuccessorSubspace: getSuccessorNumber,
        isInclusiveSmaller: (a, b) => a < b,
      },
      nonsenseRange,
      openRange,
    );
  });

  // If any dimension is empty, it should be empty.

  const range1: ThreeDimensionalRange<number> = [
    {
      kind: "closed_exclusive",
      start: timestampOld,
      end: timestampNew,
    },

    {
      kind: "closed_exclusive",
      start: pathA,
      end: pathG,
    },

    {
      kind: "closed_exclusive",
      start: 2,
      end: 7,
    },
  ];

  const range2: ThreeDimensionalRange<number> = [
    {
      kind: "closed_exclusive",
      start: timestampOld,
      end: timestampNew,
    },

    // The dimension with no intersection

    {
      kind: "closed_exclusive",
      start: pathG,
      end: pathT,
    },

    {
      kind: "closed_exclusive",
      start: 2,
      end: 7,
    },
  ];

  const res1 = intersect3dRanges(
    {
      orderSubspace: orderNumber,
      getSuccessorSubspace: getSuccessorNumber,
      isInclusiveSmaller: (a, b) => a < b,
    },
    range1,
    range2,
  );

  assert(!res1);

  // Otherwise all disjoint ranges have at least one range in them

  const range3: ThreeDimensionalRange<number> = [
    {
      kind: "closed_exclusive",
      start: timestampOld,
      end: timestampNewer,
    },
    {
      kind: "closed_exclusive",
      start: pathA,
      end: pathT,
    },
    {
      kind: "closed_exclusive",
      start: 2,
      end: 7,
    },
  ];

  const range4: ThreeDimensionalRange<number> = [
    {
      kind: "closed_exclusive",
      start: timestampOld,
      end: timestampNew,
    },
    // The dimension with no intersection
    {
      kind: "closed_exclusive",
      start: pathG,
      end: pathT,
    },
    {
      kind: "closed_exclusive",
      start: 1,
      end: 4,
    },
  ];

  const res2 = intersect3dRanges(
    {
      orderSubspace: orderNumber,
      getSuccessorSubspace: getSuccessorNumber,
      isInclusiveSmaller: (a, b) => a < b,
    },
    range3,
    range4,
  );

  assertEquals(res2, [
    {
      kind: "closed_exclusive",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed_exclusive",
      start: pathG,
      end: pathT,
    },
    {
      kind: "closed_exclusive",
      start: 2,
      end: 4,
    },
  ]);

  // we trust they are correct as they rely on intersectDisjointRange
});

function getSuccessorNumber(num: number): number {
  return num + 1;
}

Deno.test("isEqualRange", () => {
  // Valid

  assert(isEqualRange(orderNumber, getSuccessorNumber, {
    kind: "open",
    start: 3,
  }, {
    kind: "open",
    start: 3,
  }));

  assert(isEqualRange(orderNumber, getSuccessorNumber, {
    kind: "closed_exclusive",
    start: 3,
    end: 6,
  }, {
    kind: "closed_exclusive",
    start: 3,
    end: 6,
  }));

  assert(isEqualRange(orderNumber, getSuccessorNumber, {
    kind: "closed_exclusive",
    start: 3,
    end: 7,
  }, {
    kind: "closed_inclusive",
    start: 3,
    end: 6,
  }));

  assert(isEqualRange(orderNumber, getSuccessorNumber, {
    kind: "closed_inclusive",
    start: 3,
    end: 7,
  }, {
    kind: "closed_inclusive",
    start: 3,
    end: 7,
  }));

  // Not valid

  assert(
    !isEqualRange(orderNumber, getSuccessorNumber, {
      kind: "open",
      start: 3,
    }, {
      kind: "open",
      start: 4,
    }),
  );

  assert(
    !isEqualRange(orderNumber, getSuccessorNumber, {
      kind: "open",
      start: 3,
    }, {
      kind: "closed_exclusive",
      start: 3,
      end: 6,
    }),
  );

  assert(
    !isEqualRange(orderNumber, getSuccessorNumber, {
      kind: "open",
      start: 3,
    }, {
      kind: "closed_inclusive",
      start: 3,
      end: 6,
    }),
  );

  assert(
    !isEqualRange(orderNumber, getSuccessorNumber, {
      kind: "closed_exclusive",
      start: 3,
      end: 6,
    }, {
      kind: "closed_exclusive",
      start: 2,
      end: 6,
    }),
  );

  assert(
    !isEqualRange(orderNumber, getSuccessorNumber, {
      kind: "closed_exclusive",
      start: 3,
      end: 6,
    }, {
      kind: "closed_inclusive",
      start: 3,
      end: 6,
    }),
  );

  assert(
    !isEqualRange(orderNumber, getSuccessorNumber, {
      kind: "closed_inclusive",
      start: 3,
      end: 6,
    }, {
      kind: "closed_inclusive",
      start: 3,
      end: 7,
    }),
  );
});
