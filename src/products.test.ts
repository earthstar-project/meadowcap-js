import { assert, assertEquals, assertThrows } from "$std/assert/mod.ts";
import {
  addTo3dProduct,
  addToDisjointRange,
  DisjointRange,
  intersect3dProducts,
  intersectDisjointRanges,
  isSensible3dProduct,
  isSensibleDisjointRange,
  ThreeDimensionalProduct,
} from "./products.ts";
import { Range, ThreeDimensionalRange } from "./ranges.ts";

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
  disjointRange: DisjointRange<number>,
  max: number,
) {
  const numbers = new Set<number>();

  for (const range of disjointRange) {
    if (range.kind === "open") {
      const numbersOfRange = getNumbers(max - range.start, range.start);

      for (const num of numbersOfRange) {
        numbers.add(num);
      }
    } else {
      const numbersOfRange = getNumbers(range.end - range.start, range.start);

      for (const num of numbersOfRange) {
        numbers.add(num);
      }
    }
  }

  return numbers;
}

Deno.test("getNumbersOfDisjointRange", () => {
  const dr1: DisjointRange<number> = [
    { kind: "closed", start: 8, end: 12 },
    { kind: "closed", start: 1, end: 3 },
  ];

  const res1 = getNumbersOfDisjointRange(dr1, 11);

  assertEquals(Array.from(res1).toSorted(orderNumber), [1, 2, 8, 9, 10, 11]);

  const dr2: DisjointRange<number> = [
    { kind: "open", start: 8 },
    { kind: "closed", start: 3, end: 5 },
  ];

  const res2 = getNumbersOfDisjointRange(dr2, 9);

  assertEquals(Array.from(res2).toSorted(orderNumber), [3, 4, 8]);
});

Deno.test("isSensibleDisjointRange", () => {
  const dr1: DisjointRange<number> = [
    { kind: "closed", start: 8, end: 12 },
    { kind: "closed", start: 1, end: 3 },
    { kind: "open", start: 15 },
  ];

  assert(isSensibleDisjointRange(orderNumber, dr1));

  const dr2: DisjointRange<number> = [
    { kind: "closed", start: 1, end: 1 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr2));

  const dr3: DisjointRange<number> = [
    { kind: "closed", start: 5, end: 0 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr3));

  const dr4: DisjointRange<number> = [
    { kind: "open", start: 1 },
    { kind: "open", start: 15 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr4));

  const dr5: DisjointRange<number> = [
    { kind: "open", start: 4 },
    { kind: "closed", start: 4, end: 12 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr5));

  const dr6: DisjointRange<number> = [
    { kind: "closed", start: 1, end: 10 },
    { kind: "open", start: 4 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr6));

  const dr7: DisjointRange<number> = [
    { kind: "closed", start: 1, end: 10 },
    { kind: "closed", start: 10, end: 14 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr7));

  const dr8: DisjointRange<number> = [
    { kind: "closed", start: 3, end: 8 },
    { kind: "closed", start: 7, end: 10 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr8));

  const dr9: DisjointRange<number> = [
    { kind: "closed", start: 1, end: 10 },
    { kind: "closed", start: 3, end: 8 },
  ];

  assert(!isSensibleDisjointRange(orderNumber, dr9));
});

Deno.test("addToDisjointRange", () => {
  // TODO: Test throws on insensible range / insensible product.

  for (let i = 0; i < 100; i++) {
    let disjointRange: DisjointRange<number> = [];

    for (let j = 0; j < 10; j++) {
      const expectedNumbers = getNumbersOfDisjointRange(disjointRange, 100);

      const isOpen = Math.random() >= 0.5;

      const newStart = Math.floor(Math.random() * 50);

      const newRange: Range<number> = isOpen
        ? {
          kind: "open",
          start: newStart,
        }
        : {
          kind: "closed",
          start: newStart,
          end: newStart + Math.floor(Math.random() * (50 - 1) + 1),
        };

      const newNumbers = getNumbersOfDisjointRange([newRange], 100);

      for (const num of newNumbers) {
        expectedNumbers.add(num);
      }

      const newDisjointRange = addToDisjointRange(
        orderNumber,
        newRange,
        disjointRange,
      );

      assert(isSensibleDisjointRange(orderNumber, newDisjointRange));

      const newDisjointRangeNumbers = getNumbersOfDisjointRange(
        newDisjointRange,
        100,
      );

      assertEquals(
        Array.from(expectedNumbers).toSorted(orderNumber),
        Array.from(newDisjointRangeNumbers).toSorted(orderNumber),
      );

      disjointRange = newDisjointRange;
    }
  }
});

function makeDisjointRange(maxSize: number) {
  const dj: DisjointRange<number> = [];
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
      kind: "closed",
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
    const dj1 = makeDisjointRange(200);
    const dj2 = makeDisjointRange(200);

    const intersection = intersectDisjointRanges(orderNumber, dj1, dj2);

    const numbers1 = getNumbersOfDisjointRange(dj1, 200);
    const numbers2 = getNumbersOfDisjointRange(dj2, 200);

    if (intersection) {
      const intersectionNumbers = getNumbersOfDisjointRange(intersection, 200);

      assert(
        isSensibleDisjointRange(orderNumber, intersection),
        `Non-sensible intersection detected`,
      );

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

Deno.test("isSensible3dProduct", () => {
  const sensibleProductEmpty: ThreeDimensionalProduct<number> = [
    [],
    [],
    [],
  ];

  assert(isSensible3dProduct(orderNumber, sensibleProductEmpty));

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

  const sensibleProductNonEmpty: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
      {
        kind: "open",
        start: timestampNewer,
      },
    ],
    [
      {
        kind: "closed",
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
        kind: "closed",
        start: 1,
        end: 3,
      },
      {
        kind: "open",
        start: 7,
      },
    ],
  ];

  assert(isSensible3dProduct(orderNumber, sensibleProductNonEmpty));

  const nonsenseProduct1: ThreeDimensionalProduct<number> = [
    [],
    [
      {
        kind: "closed",
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
        kind: "closed",
        start: 1,
        end: 3,
      },
      {
        kind: "open",
        start: 7,
      },
    ],
  ];

  assert(!isSensible3dProduct(orderNumber, nonsenseProduct1));

  const nonsenseProduct2: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
      {
        kind: "open",
        start: timestampNewer,
      },
    ],
    [
      {
        kind: "closed",
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
        kind: "closed",
        start: 1,
        end: 9,
      },
      {
        kind: "open",
        start: 7,
      },
    ],
  ];

  assert(!isSensible3dProduct(orderNumber, nonsenseProduct2));

  const nonsenseProduct3: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
      {
        kind: "open",
        start: timestampNewer,
      },
    ],
    [
      {
        kind: "closed",
        start: pathG,
        end: pathA,
      },
      {
        kind: "open",
        start: pathT,
      },
    ],
    [
      {
        kind: "closed",
        start: 1,
        end: 2,
      },
      {
        kind: "open",
        start: 7,
      },
    ],
  ];

  assert(!isSensible3dProduct(orderNumber, nonsenseProduct3));

  const nonsenseProduct4: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
      {
        kind: "open",
        start: timestampNewer,
      },
    ],
    [
      {
        kind: "closed",
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
        kind: "closed",
        start: 1,
        end: 2,
      },
      {
        kind: "closed",
        start: 2,
        end: 4,
      },
    ],
  ];

  assert(!isSensible3dProduct(orderNumber, nonsenseProduct4));
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

  const sensibleProduct1: ThreeDimensionalProduct<number> = [[], [], []];

  assertThrows(() => {
    addTo3dProduct(orderNumber, nonsenseRange1, sensibleProduct1);
  });

  // Throws on adding to insensible product

  const sensibleRange1: ThreeDimensionalRange<number> = [
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
      start: 1,
    },
  ];

  const nonsenseProduct1: ThreeDimensionalProduct<number> = [
    [],
    [
      {
        kind: "closed",
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
        kind: "closed",
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
    addTo3dProduct(orderNumber, sensibleRange1, nonsenseProduct1);
  });

  const sensibleRange2: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampNew,
      end: timestampNewer,
    },
    {
      kind: "closed",
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
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    [
      {
        kind: "closed",
        start: pathA,
        end: pathG,
      },
    ],
    [
      {
        kind: "closed",
        start: 2,
        end: 10,
      },
    ],
  ];

  const result = addTo3dProduct(orderNumber, sensibleRange2, sensibleProduct2);

  assert(isSensible3dProduct(orderNumber, result));

  assertEquals(result, [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNewer,
      },
    ],
    [
      {
        kind: "closed",
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

  // throws if passed nonsense product

  const emptyProduct: ThreeDimensionalProduct<number> = [
    [],
    [],
    [],
  ];

  const nonsenseProduct1: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    [],
    [],
  ];

  assertThrows(() => {
    intersect3dProducts(orderNumber, emptyProduct, nonsenseProduct1);
  });

  // If any dimension is empty, it should be empty.

  const product1: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    [
      {
        kind: "closed",
        start: pathA,
        end: pathG,
      },
    ],
    [
      {
        kind: "closed",
        start: 2,
        end: 7,
      },
    ],
  ];

  const product2: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    // The dimension with no intersection
    [
      {
        kind: "closed",
        start: pathG,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed",
        start: 2,
        end: 7,
      },
    ],
  ];

  const res1 = intersect3dProducts(orderNumber, product1, product2);

  assertEquals(res1, emptyProduct);

  // Otherwise all disjoint ranges have at least one range in them

  const product3: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNewer,
      },
    ],
    [
      {
        kind: "closed",
        start: pathA,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed",
        start: 2,
        end: 7,
      },
    ],
  ];

  const product4: ThreeDimensionalProduct<number> = [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    // The dimension with no intersection
    [
      {
        kind: "closed",
        start: pathG,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed",
        start: 1,
        end: 4,
      },
    ],
  ];

  const res2 = intersect3dProducts(orderNumber, product3, product4);

  assertEquals(res2, [
    [
      {
        kind: "closed",
        start: timestampOld,
        end: timestampNew,
      },
    ],
    [
      {
        kind: "closed",
        start: pathG,
        end: pathT,
      },
    ],
    [
      {
        kind: "closed",
        start: 2,
        end: 4,
      },
    ],
  ]);

  // we trust they are correct as they rely on intersectDisjointRange
});
