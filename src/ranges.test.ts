import { assert, assertEquals, assertThrows } from "$std/assert/mod.ts";
import {
  intersect3dRanges,
  intersectRanges,
  isSensible3dRange,
  isSensibleRange,
  Range,
  ThreeDimensionalRange,
} from "./ranges.ts";

function orderNumber(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  }

  return 0;
}

Deno.test("isRangeSensible", () => {
  const nonsenseRange1: Range<number> = {
    kind: "closed",
    start: 1,
    end: 1,
  };

  const nonsenseRange2: Range<number> = {
    kind: "closed",
    start: 2,
    end: 1,
  };

  assert(!isSensibleRange(orderNumber, nonsenseRange1));
  assert(!isSensibleRange(orderNumber, nonsenseRange2));

  const sensibleRange1: Range<number> = {
    kind: "closed",
    start: 1,
    end: 3,
  };

  const sensibleRange2: Range<number> = {
    kind: "open",
    start: 3,
  };

  assert(isSensibleRange(orderNumber, sensibleRange1));
  assert(isSensibleRange(orderNumber, sensibleRange2));
});

Deno.test("is3dRangeSensible", () => {
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
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed",
      start: pathA,
      end: pathG,
    },
    {
      kind: "open",
      start: 8,
    },
  ];

  assert(isSensible3dRange(orderNumber, sensibleRange));

  const nonsenseRange1: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed",
      start: pathG,
      end: pathA,
    },
    {
      kind: "open",
      start: 1,
    },
  ];

  assert(!isSensible3dRange(orderNumber, nonsenseRange1));
});

function getNumbers(size: number, startAt = 0) {
  return [...Array(size).keys()].map((i) => i + startAt);
}

function getNumbersOfRange(range: Range<number>, maxSize: number): Set<number> {
  const numbers = new Set<number>();

  if (range.kind === "open") {
    for (let i = range.start; i < maxSize; i++) {
      numbers.add(i);
    }
  } else {
    for (const num of getNumbers(range.end - range.start, range.start)) {
      numbers.add(num);
    }
  }

  return numbers;
}

Deno.test("intersectRanges", () => {
  for (let i = 0; i < 100; i++) {
    const startA = Math.floor(Math.random() * 49);
    const startB = Math.floor(Math.random() * 49);

    const aIsOpen = Math.random() >= 0.5;
    const bIsOpen = Math.random() >= 0.5;

    const aRange: Range<number> = aIsOpen
      ? {
        kind: "open",
        start: startA,
      }
      : {
        kind: "closed",
        start: startA,
        end: Math.floor(Math.random() * (49 - startA + 1) + startA + 1),
      };

    const bRange: Range<number> = bIsOpen
      ? {
        kind: "open",
        start: startB,
      }
      : {
        kind: "closed",
        start: startB,
        end: Math.floor(Math.random() * (49 - startB + 1) + startB + 1),
      };

    // get results from new range

    const intersectedRange = intersectRanges(orderNumber, aRange, bRange);

    const aRangeNumbers = getNumbersOfRange(aRange, 50);
    const bRangeNumbers = getNumbersOfRange(bRange, 50);

    if (intersectedRange === null) {
      // Check that none of the numbers in one is in the other.

      for (const numA of aRangeNumbers) {
        if (bRangeNumbers.has(numA)) {
          assert(false, "Found common number when there should be none");
        }
      }
    } else {
      const intersectedNumbers = getNumbersOfRange(intersectedRange, 50);

      for (const numA of aRangeNumbers) {
        if (bRangeNumbers.has(numA)) {
          assert(
            intersectedNumbers.has(numA),
            "Missing number in intersection",
          );
        } else {
          assert(
            !intersectedNumbers.has(numA),
            `${Array.from(aRangeNumbers)}
						
						${Array.from(bRangeNumbers)}
						
						${Array.from(intersectedNumbers)}
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
            `${Array.from(aRangeNumbers)}

${Array.from(bRangeNumbers)}

${Array.from(intersectedNumbers)}
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
    { kind: "closed", start: timestampNewer, end: timestampOld },
    { kind: "open", start: pathA },
    { kind: "open", start: 2 },
  ];

  const openRange: ThreeDimensionalRange<number> = [
    { kind: "open", start: timestampNewer },
    { kind: "open", start: pathA },
    { kind: "open", start: 2 },
  ];

  assertThrows(() => {
    intersect3dRanges(orderNumber, nonsenseRange, openRange);
  });

  // If any dimension is empty, it should be empty.

  const range1: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },

    {
      kind: "closed",
      start: pathA,
      end: pathG,
    },

    {
      kind: "closed",
      start: 2,
      end: 7,
    },
  ];

  const range2: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },

    // The dimension with no intersection

    {
      kind: "closed",
      start: pathG,
      end: pathT,
    },

    {
      kind: "closed",
      start: 2,
      end: 7,
    },
  ];

  const res1 = intersect3dRanges(orderNumber, range1, range2);

  assert(!res1);

  // Otherwise all disjoint ranges have at least one range in them

  const range3: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNewer,
    },
    {
      kind: "closed",
      start: pathA,
      end: pathT,
    },
    {
      kind: "closed",
      start: 2,
      end: 7,
    },
  ];

  const range4: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },
    // The dimension with no intersection
    {
      kind: "closed",
      start: pathG,
      end: pathT,
    },
    {
      kind: "closed",
      start: 1,
      end: 4,
    },
  ];

  const res2 = intersect3dRanges(orderNumber, range3, range4);

  assertEquals(res2, [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed",
      start: pathG,
      end: pathT,
    },
    {
      kind: "closed",
      start: 2,
      end: 4,
    },
  ]);

  // we trust they are correct as they rely on intersectDisjointRange
});
