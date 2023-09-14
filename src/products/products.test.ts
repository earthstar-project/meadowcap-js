import { assert } from "$std/assert/assert.ts";
import { assertEquals } from "$std/assert/assert_equals.ts";
import { assertThrows } from "$std/assert/assert_throws.ts";
import {
  getSmallerFromExclusiveRange,
  getSmallerFromInclusiveRange,
} from "../ranges/ranges.ts";
import { Range, ThreeDimensionalRange } from "../ranges/types.ts";
import {
  addTo3dProduct,
  addToDisjointIntervalCanonically,
  intersect3dProducts,
  intersectDisjointIntervals,
  isEqualDisjointInterval,
  merge3dProducts,
  mergeDisjointRanges,
} from "./products.ts";
import { DisjointInterval, ThreeDimensionalProduct } from "./types.ts";

function orderNumber(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  }

  return 0;
}

// Get numbers of product...

function getNumbers(size: number, startAt = 0) {
  return [...Array(size).keys()].map((i) => i + startAt);
}

function getNumbersOfDisjointRange(
  disjointRange: DisjointInterval<number>,
  max: number,
  throwOnHas?: boolean,
) {
  const numbers = new Set<number>();

  for (const range of disjointRange) {
    if (range.kind === "open") {
      for (let i = range.start; i <= max; i++) {
        if (throwOnHas && numbers.has(i)) {
          throw new Error("Tried to add number we already had");
        }

        numbers.add(i);
      }
    } else if (range.kind === "closed_exclusive") {
      const rangeNumbers = getNumbers(range.end - range.start, range.start);

      if (throwOnHas && rangeNumbers.length === 0) {
        throw new Error("Tried to get numbers from empty range");
      }

      for (const num of rangeNumbers) {
        if (throwOnHas && numbers.has(num)) {
          throw new Error("Tried to add number we already had");
        }

        numbers.add(num);
      }
    } else {
      const rangeNumbers = getNumbers(range.end - range.start + 1, range.start);

      if (throwOnHas && rangeNumbers.length === 0) {
        throw new Error("Tried to get numbers from empty range");
      }

      for (const num of rangeNumbers) {
        if (throwOnHas && numbers.has(num)) {
          throw new Error("Tried to add number we already had");
        }

        numbers.add(num);
      }
    }
  }

  return numbers;
}

Deno.test("getNumbersOfDisjointRange", () => {
  const dr1: DisjointInterval<number> = [
    { kind: "closed_exclusive", start: 8, end: 12 },
    { kind: "closed_inclusive", start: 1, end: 3 },
  ];

  const res1 = getNumbersOfDisjointRange(dr1, 11);

  assertEquals(Array.from(res1).toSorted(orderNumber), [1, 2, 3, 8, 9, 10, 11]);

  const dr2: DisjointInterval<number> = [
    { kind: "open", start: 8 },
    { kind: "closed_exclusive", start: 3, end: 5 },
  ];

  const res2 = getNumbersOfDisjointRange(dr2, 9);

  assertEquals(Array.from(res2).toSorted(orderNumber), [3, 4, 8, 9]);
});

Deno.test("addToDisjointRange", () => {
  for (let i = 0; i < 100; i++) {
    let disjointRange: DisjointInterval<number> = [];
    const forceInclusive = Math.random() >= 0.5;

    const MAX_SIZE = 100;

    for (let j = 0; j < 10; j++) {
      const expectedNumbers = getNumbersOfDisjointRange(
        disjointRange,
        MAX_SIZE,
      );

      const rangeKindRoll = Math.random();

      const rangeKind = rangeKindRoll >= 0.95
        ? "open"
        : rangeKindRoll >= 0.45
        ? "closed_exclusive"
        : "closed_inclusive";

      const newStart = Math.floor(Math.random() * MAX_SIZE);

      const newRange: Range<number> = rangeKind === "open"
        ? {
          kind: "open",
          start: newStart,
        }
        : rangeKind === "closed_exclusive" && !forceInclusive
        ? {
          kind: "closed_exclusive",
          start: newStart,
          end: Math.floor(
            Math.random() * (MAX_SIZE - newStart) + newStart + 1,
          ),
        }
        : {
          kind: "closed_inclusive",
          start: newStart,
          end: Math.floor(
            Math.random() * (MAX_SIZE - newStart) + newStart + 1,
          ),
        };

      const newNumbers = getNumbersOfDisjointRange([newRange], MAX_SIZE);

      for (const num of newNumbers) {
        expectedNumbers.add(num);
      }

      const newDisjointRange = addToDisjointIntervalCanonically(
        {
          getSuccessor: (num) => num + 1,
          getPredecessor: (num) => num - 1,
          order: orderNumber,
          isInclusiveSmaller: () => false,
          forceInclusive,
        },
        newRange,
        disjointRange,
      );

      const newDisjointRangeNumbers = getNumbersOfDisjointRange(
        newDisjointRange,
        MAX_SIZE,
        // Throw if the same number is added twice (overlap)
        true,
      );

      assertEquals(
        Array.from(expectedNumbers).toSorted(orderNumber),
        Array.from(newDisjointRangeNumbers).toSorted(orderNumber),
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
          if (forceInclusive) {
            assert(false, "Exclusive range added when forceInclusive was true");
          }

          const smaller = getSmallerFromExclusiveRange({
            getPredecessor: (num) => num - 1,
            isInclusiveSmaller: () => false,
          }, range);

          if (!forceInclusive && smaller.kind === "closed_inclusive") {
            assert(false, "Added a less efficient closed range");
          }

          for (const otherRange of disjointRange) {
            if (orderNumber(otherRange.start, range.end) === 0) {
              assert(false, "Adjacent range detected");
            }
          }
        }

        if (range.kind === "closed_inclusive") {
          const smaller = getSmallerFromInclusiveRange({
            getSuccessor: (num) => num + 1,
            isInclusiveSmaller: () => false,
          }, range);

          if (!forceInclusive && smaller.kind === "closed_exclusive") {
            assert(false, "Added a less efficient closed range");
          }

          for (const otherRange of disjointRange) {
            if (orderNumber(otherRange.start, range.end + 1) === 0) {
              assert(false, "Adjacent range detected");
            }
          }
        }
      }

      disjointRange = newDisjointRange;
    }
  }
});

function makeDisjointRange(maxSize: number) {
  const dj: DisjointInterval<number> = [];
  let rangeStart = 0;

  while (true) {
    const startDelta = Math.floor(Math.random() * (10 - 1) + 1);

    const isOpen = Math.random() < 0.15;

    if (isOpen) {
      dj.push({
        kind: "open",
        start: Math.min(maxSize, rangeStart + startDelta),
      });

      break;
    }

    const size = Math.floor(Math.random() * (10 - 1) + 1);

    const end = rangeStart + startDelta + size;

    if (end >= maxSize) {
      break;
    }

    dj.push({
      kind: "closed_exclusive",
      start: rangeStart + startDelta,
      end: rangeStart + startDelta + size,
    });

    rangeStart = rangeStart + startDelta + size;

    if (rangeStart >= maxSize) {
      break;
    }
  }

  return dj;
}

Deno.test("intersectDisjointRange", () => {
  for (let i = 0; i < 100; i++) {
    const di1 = makeDisjointRange(200);
    const di2 = makeDisjointRange(200);

    const intersection = intersectDisjointIntervals(
      {
        getSuccessor: (num) => num + 1,
        getPredecessor: (num) => num - 1,
        order: orderNumber,
        isInclusiveSmaller: () => false,
      },
      di1,
      di2,
    );

    const numbers1 = getNumbersOfDisjointRange(di1, 200);
    const numbers2 = getNumbersOfDisjointRange(di2, 200);

    if (intersection) {
      const intersectionNumbers = getNumbersOfDisjointRange(intersection, 200);

      for (const num1 of numbers1) {
        if (numbers2.has(num1)) {
          assert(intersectionNumbers.has(num1));
        } else {
          assert(!intersectionNumbers.has(num1));
        }
      }
    } else {
      for (const num1 of numbers1) {
        assert(!numbers2.has(num1));
      }
    }
  }
});

Deno.test("isEqualDisjointInterval", () => {
  assert(
    isEqualDisjointInterval(
      {
        order: orderNumber,
        getSuccessor: (a) => a + 1,
      },
      [],
      [],
    ),
  );

  assert(
    isEqualDisjointInterval({
      order: orderNumber,
      getSuccessor: (a) => a + 1,
    }, [
      { kind: "open", start: 10 },
      {
        kind: "closed_exclusive",
        start: 1,
        end: 5,
      },
      { kind: "closed_exclusive", start: 7, end: 9 },
    ], [
      { kind: "open", start: 10 },
      {
        kind: "closed_inclusive",
        start: 1,
        end: 4,
      },
      { kind: "closed_exclusive", start: 7, end: 9 },
    ]),
  );

  assert(
    !isEqualDisjointInterval({
      order: orderNumber,
      getSuccessor: (a) => a + 1,
    }, [
      { kind: "open", start: 10 },
      {
        kind: "closed_exclusive",
        start: 1,
        end: 5,
      },
      { kind: "closed_exclusive", start: 7, end: 9 },
    ], [
      { kind: "open", start: 14 },
      {
        kind: "closed_exclusive",
        start: 1,
        end: 5,
      },
      { kind: "closed_exclusive", start: 7, end: 9 },
    ]),
  );

  assert(
    !isEqualDisjointInterval({
      order: orderNumber,
      getSuccessor: (a) => a + 1,
    }, [
      { kind: "open", start: 10 },
      {
        kind: "closed_exclusive",
        start: 1,
        end: 5,
      },
      { kind: "closed_exclusive", start: 7, end: 9 },
    ], []),
  );
});

// This test being this way is premised on it using addToDisjointRanges
Deno.test("mergeDisjointRanges", () => {
  const range1: Range<number> = {
    kind: "open",
    start: 30,
  };

  const range2: Range<number> = {
    kind: "closed_exclusive",
    start: 4,
    end: 24,
  };

  const range3: Range<number> = {
    kind: "open",
    start: 29,
  };

  const range4: Range<number> = {
    kind: "closed_exclusive",
    start: 2,
    end: 16,
  };

  const firstStep = addToDisjointIntervalCanonically({
    getSuccessor: (num) => num + 1,
    getPredecessor: (num) => num - 1,
    order: orderNumber,
    isInclusiveSmaller: () => false,
  }, range1);
  const secondStep = addToDisjointIntervalCanonically(
    {
      getSuccessor: (num) => num + 1,
      getPredecessor: (num) => num - 1,
      order: orderNumber,
      isInclusiveSmaller: () => false,
    },
    range2,
    firstStep,
  );
  const thirdStep = addToDisjointIntervalCanonically(
    {
      getSuccessor: (num) => num + 1,
      getPredecessor: (num) => num - 1,
      order: orderNumber,
      isInclusiveSmaller: () => false,
    },
    range3,
    secondStep,
  );
  const expected = addToDisjointIntervalCanonically(
    {
      getSuccessor: (num) => num + 1,
      getPredecessor: (num) => num - 1,
      order: orderNumber,
      isInclusiveSmaller: () => false,
    },
    range4,
    thirdStep,
  );

  const actual = mergeDisjointRanges(
    {
      getSuccessor: (num) => num + 1,
      getPredecessor: (num) => num - 1,
      order: orderNumber,
      isInclusiveSmaller: () => false,
    },
    [range1],
    [range2, range3],
    [
      range4,
    ],
  );

  assertEquals(actual, expected);
});

Deno.test("addTo3dProduct", () => {
  // Throws on adding insensible range
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

  const nonsenseRange1: ThreeDimensionalRange<number> = [
    {
      kind: "closed_inclusive",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed_exclusive",
      start: pathG,
      end: pathA,
    },
    {
      kind: "open",
      start: 1,
    },
  ];

  const sensibleProduct1: ThreeDimensionalProduct<number> = [[], [], []];

  assertThrows(() => {
    addTo3dProduct(
      {
        orderSubspace: orderNumber,
        getSuccessorSubspace: (num) => num + 1,
        getPredecessorSubspace: (num) => num - 1,
        isInclusiveSmallerSubspace: () => false,
        shouldThrow: true,
      },
      nonsenseRange1,
      sensibleProduct1,
    );
  });

  // Throws on adding to insensible product

  const sensibleRange1: ThreeDimensionalRange<number> = [
    {
      kind: "closed_inclusive",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed_exclusive",
      start: pathA,
      end: pathG,
    },
    {
      kind: "open",
      start: 1,
    },
  ];

  const nonsenseProduct1: ThreeDimensionalProduct<number> = [
    [],
    [
      {
        kind: "closed_exclusive",
        start: pathA,
        end: pathG,
      },
      {
        kind: "open",
        start: pathT,
      },
    ],
    [
      {
        kind: "closed_inclusive",
        start: 1,
        end: 3,
      },
      {
        kind: "open",
        start: 7,
      },
    ],
  ];

  assertThrows(() => {
    addTo3dProduct(
      {
        orderSubspace: orderNumber,
        getSuccessorSubspace: (num) => num + 1,
        getPredecessorSubspace: (num) => num - 1,
        isInclusiveSmallerSubspace: () => false,
        shouldThrow: true,
      },
      sensibleRange1,
      nonsenseProduct1,
    );
  });

  const sensibleRange2: ThreeDimensionalRange<number> = [
    {
      kind: "closed_inclusive",
      start: timestampNew,
      end: timestampNewer,
    },
    {
      kind: "closed_exclusive",
      start: pathA,
      end: pathT,
    },
    {
      kind: "open",
      start: 4,
    },
  ];

  const sensibleProduct2: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed_inclusive",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: pathA,
        end: pathG,
      },
    ],
    [
      {
        kind: "closed_inclusive",
        start: 2,
        end: 10,
      },
    ],
  ];

  const result = addTo3dProduct(
    {
      orderSubspace: orderNumber,
      getSuccessorSubspace: (num) => num + 1,
      getPredecessorSubspace: (num) => num - 1,
      isInclusiveSmallerSubspace: () => false,
    },
    sensibleRange2,
    sensibleProduct2,
  );

  assertEquals(result, [
    [
      {
        kind: "closed_inclusive",
        start: timestampOld,
        end: timestampNewer,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: pathA,
        end: pathT,
      },
    ],
    [
      {
        kind: "open",
        start: 2,
      },
    ],
  ]);
});

// This test can only be trusted while intersect3dProduct is dependent on intersectDisjointRanges
Deno.test("intersect3dProducts", () => {
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

  const emptyProduct: ThreeDimensionalProduct<number> = [[], [], []];

  // If any dimension is empty, it should be empty.

  const product1: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed_inclusive",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: pathA,
        end: pathG,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 2,
        end: 7,
      },
    ],
  ];

  const product2: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed_inclusive",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    // The dimension with no intersection
    [
      {
        kind: "closed_exclusive",
        start: pathG,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 2,
        end: 7,
      },
    ],
  ];

  const res1 = intersect3dProducts(
    {
      orderSubspace: orderNumber,
      getSuccessorSubspace: (num) => num + 1,
      getPredecessorSubspace: (num) => num - 1,
      isInclusiveSmallerSubspace: () => false,
    },
    product1,
    product2,
  );

  assertEquals(res1, emptyProduct);

  // Otherwise all disjoint ranges have at least one range in them

  const product3: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed_inclusive",
        start: timestampOld,
        end: timestampNewer,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: pathA,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 2,
        end: 7,
      },
    ],
  ];

  const product4: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed_inclusive",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    // The dimension with no intersection
    [
      {
        kind: "closed_exclusive",
        start: pathG,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 1,
        end: 4,
      },
    ],
  ];

  const res2 = intersect3dProducts(
    {
      orderSubspace: orderNumber,
      getSuccessorSubspace: (num) => num + 1,
      getPredecessorSubspace: (num) => num - 1,
      isInclusiveSmallerSubspace: () => false,
    },
    product3,
    product4,
  );

  assertEquals(res2, [
    [
      {
        kind: "closed_inclusive",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: pathG,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 2,
        end: 4,
      },
    ],
  ]);
});

Deno.test("merge3dProducts", () => {
  // Okay we've tested mergeDisjointRanges...
  // and isEqualDisjointRange
  // this test is not as thorough as I'd like
  // TODO: Generate random products, make two dimensions match
  // Compare the merged non-matching dimension with addToDisjointRange result

  // Until then...
  // If any pairs match, return the merged version

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

  // timestamp x path match

  const product1a: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathA },
    ],
    [
      {
        kind: "open",
        start: 17,
      },
    ],
  ];

  const product1b: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathA },
    ],
    [
      {
        kind: "open",
        start: 16,
      },
      {
        kind: "closed_exclusive",
        start: 1,
        end: 3,
      },
    ],
  ];

  const product1c: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathA },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 12,
        end: 19,
      },
    ],
  ];

  const product1d: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathA },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 14,
        end: 17,
      },
    ],
  ];

  assertEquals(
    merge3dProducts(
      {
        orderSubspace: orderNumber,
        getSuccessorSubspace: (a) => a + 1,
        getPredecessorSubspace: (a) => a - 1,
        isInclusiveSmallerSubspace: () => false,
      },
      product1a,
      product1b,
      product1c,
      product1d,
    ),
    [
      [
        {
          kind: "open",
          start: timestampNew,
        },
      ],
      [{ kind: "open", start: pathA }],
      [{ kind: "closed_exclusive", start: 1, end: 3 }, {
        kind: "open",
        start: 12,
      }],
    ],
  );

  // timestamp x subspace

  const product2a: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathA },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 12,
        end: 19,
      },
    ],
  ];

  const product2b: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathG },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 12,
        end: 19,
      },
    ],
  ];

  const product2c: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "closed_exclusive", start: pathG, end: pathT },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 12,
        end: 19,
      },
    ],
  ];

  const product2d: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathT },
    ],
    [
      {
        kind: "closed_exclusive",
        start: 12,
        end: 19,
      },
    ],
  ];

  assertEquals(
    merge3dProducts(
      {
        orderSubspace: orderNumber,
        getSuccessorSubspace: (a) => a + 1,
        getPredecessorSubspace: (a) => a - 1,
        isInclusiveSmallerSubspace: () => false,
      },
      product2a,
      product2b,
      product2c,
      product2d,
    ),
    [
      [
        {
          kind: "open",
          start: timestampNew,
        },
      ],
      [{ kind: "open", start: pathA }],
      [{ kind: "closed_exclusive", start: 12, end: 19 }],
    ],
  );

  // path x subspace

  const product3a: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathG },
    ],
    [
      {
        kind: "open",
        start: 17,
      },
    ],
  ];

  const product3b: ThreeDimensionalProduct<number> = [
    [
      { kind: "closed_exclusive", start: timestampOld, end: timestampNewer },
    ],
    [
      { kind: "open", start: pathG },
    ],
    [
      {
        kind: "open",
        start: 17,
      },
    ],
  ];

  const product3c: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathG },
    ],
    [
      {
        kind: "open",
        start: 17,
      },
    ],
  ];

  const product3d: ThreeDimensionalProduct<number> = [
    [
      { kind: "closed_exclusive", start: timestampNew, end: timestampNewer },
    ],
    [
      { kind: "open", start: pathG },
    ],
    [
      {
        kind: "open",
        start: 17,
      },
    ],
  ];

  assertEquals(
    merge3dProducts(
      {
        orderSubspace: orderNumber,
        getSuccessorSubspace: (a) => a + 1,
        getPredecessorSubspace: (a) => a - 1,
        isInclusiveSmallerSubspace: () => false,
      },
      product3a,
      product3b,
      product3c,
      product3d,
    ),
    [
      [
        {
          kind: "open",
          start: timestampOld,
        },
      ],
      [{ kind: "open", start: pathG }],
      [{ kind: "open", start: 17 }],
    ],
  );

  // If no pairwise match, return null.

  const product4a: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathT },
    ],
    [
      {
        kind: "open",
        start: 17,
      },
    ],
  ];

  const product4b: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNew },
    ],
    [
      { kind: "open", start: pathT },
    ],
    [
      {
        kind: "open",
        start: 2,
      },
    ],
  ];

  const product4c: ThreeDimensionalProduct<number> = [
    [
      { kind: "open", start: timestampNewer },
    ],
    [
      { kind: "open", start: pathT },
    ],
    [
      {
        kind: "open",
        start: 17,
      },
    ],
  ];

  assert(
    !merge3dProducts(
      {
        orderSubspace: orderNumber,
        getSuccessorSubspace: (a) => a + 1,
        getPredecessorSubspace: (a) => a - 1,
        isInclusiveSmallerSubspace: () => false,
      },
      product4a,
      product4b,
      product4c,
    ),
  );
});
