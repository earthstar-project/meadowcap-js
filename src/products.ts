import { orderBytes, orderTimestamps } from "./orders.ts";
import {
  intersectRanges,
  isSensible3dRange,
  isSensibleRange,
  Range,
  ThreeDimensionalRange,
} from "./ranges.ts";

/** One of the dimensions of a product, containing many ranges. */
export type DisjointRange<ValueType> = Array<Range<ValueType>>;

/** Checks if a disjoint range is sensible, that is whether none of its ranges are adjacent or overlap. */
export function isSensibleDisjointRange<ValueType>(
  order: (a: ValueType, b: ValueType) => -1 | 0 | 1,
  range: DisjointRange<ValueType>,
): boolean {
  for (let i = 0; i < range.length - (range.length === 1 ? 0 : 1); i++) {
    const currentRange = range[i];

    // Detect garbage ranges (e.g. [1, 1), [3, 2))
    if (isSensibleRange(order, currentRange) === false) {
      return false;
    }

    for (let j = i + 1; j < range.length; j++) {
      const otherRange = range[j];

      // Detect multiple open ranges.
      if (currentRange.kind === "open" && otherRange.kind === "open") {
        return false;
      }

      if (currentRange.kind === "open" && otherRange.kind === "closed") {
        const startOrder = order(currentRange.start, otherRange.start);

        // Detect subsumed ranges (e.g. [3, 5], [1, ...])
        if (startOrder <= 0) {
          return false;
        }

        const endOrder = order(currentRange.start, otherRange.end);

        // Detect overlapping ranges (e.g. [7, 10], [8, ...])
        if (endOrder !== 1) {
          return false;
        }
      } else if (currentRange.kind === "closed" && otherRange.kind === "open") {
        const startOrder = order(otherRange.start, currentRange.start);

        // Detect subsumed ranges (e.g. [3, 5], [1, ...])
        if (startOrder <= 0) {
          return false;
        }

        const endOrder = order(otherRange.start, currentRange.end);

        // Detect overlapping ranges (e.g. [7, 10], [8, ...])
        if (endOrder !== 1) {
          return false;
        }
      } else if (
        currentRange.kind === "closed" && otherRange.kind === "closed"
      ) {
        const endStartOrder = order(currentRange.end, otherRange.start);

        // Detect adjacent ranges
        if (endStartOrder === 0) {
          return false;
        }

        const startEndOrder = order(currentRange.start, otherRange.end);

        // Detect adjacent ranges
        if (startEndOrder === 0) {
          return false;
        }

        const startStartOrder = order(currentRange.start, otherRange.start);

        // Detect overlapping ranges
        if (startStartOrder >= 0 && startEndOrder < 0) {
          return false;
        }

        const endEndOrder = order(currentRange.end, otherRange.end);

        // Detect overlapping ranges
        if (endEndOrder <= 0 && endStartOrder > 0) {
          return false;
        }

        // Detect completely subsumed ranges
        if (startStartOrder <= 0 && endEndOrder >= 0) {
          return false;
        }
      }
    }
  }

  return true;
}

/** Adds a range to a disjoint range in such a way that the result is always sensible (in the sense that a disjoint range can be). */
export function addToDisjointRange<ValueType>(
  order: (a: ValueType, b: ValueType) => -1 | 0 | 1,
  range: Range<ValueType>,
  disjointRange: DisjointRange<ValueType> = [],
): DisjointRange<ValueType> {
  // Check if range makes sense.

  if (isSensibleRange(order, range) === false) {
    throw new Error("Badly formed range");
  }

  if (isSensibleDisjointRange(order, disjointRange) === false) {
    throw new Error("Disjoint range is not sensible");
  }

  const newProduct = [];

  let newSensibleRange = { ...range };
  //let pushedNewSensibleRange = false;

  for (const existingRange of disjointRange) {
    if (existingRange.kind === "open" && newSensibleRange.kind === "open") {
      // Then make new range's start the lower of either two.
      newSensibleRange.start =
        order(newSensibleRange.start, existingRange.start) <= 0
          ? newSensibleRange.start
          : existingRange.start;
    } else if (
      existingRange.kind === "open" && newSensibleRange.kind === "closed"
    ) {
      const newEndStartOrder = order(newSensibleRange.end, existingRange.start);
      const existingStartOrder = order(
        existingRange.start,
        newSensibleRange.start,
      );

      if (existingStartOrder < 0) {
        newSensibleRange = {
          kind: "open",
          start: existingRange.start,
        };
      } else if (newEndStartOrder >= 0) {
        newSensibleRange = {
          kind: "open",
          start: newSensibleRange.start,
        };
      } else {
        newProduct.push(existingRange);
      }
    } else if (
      existingRange.kind === "closed" && newSensibleRange.kind === "open"
    ) {
      const existingEndStartOrder = order(
        existingRange.end,
        newSensibleRange.start,
      );
      const newStartOrder = order(
        newSensibleRange.start,
        existingRange.start,
      );

      if (newStartOrder < 0) {
        // do nothing?
      } else if (existingEndStartOrder >= 0) {
        newSensibleRange = {
          kind: "open",
          start: existingRange.start,
        };
      } else {
        newProduct.push(existingRange);
      }
    } else if (
      existingRange.kind === "closed" && newSensibleRange.kind === "closed"
    ) {
      const newEndStartOrder = order(newSensibleRange.end, existingRange.start);

      // new range comes before existing range.
      if (newEndStartOrder === -1) {
        newProduct.push(existingRange);
        continue;
      }

      const existingEndStartOrder = order(
        existingRange.end,
        newSensibleRange.start,
      );

      // existing range comes before new range
      if (existingEndStartOrder === -1) {
        newProduct.push(existingRange);
        continue;
      }

      // We know they overlap.

      const leastValue = order(existingRange.start, newSensibleRange.start) <= 0
        ? existingRange.start
        : newSensibleRange.start;

      const greatestValue = order(existingRange.end, newSensibleRange.end) >= 0
        ? existingRange.end
        : newSensibleRange.end;

      newSensibleRange.start = leastValue;
      newSensibleRange.end = greatestValue;
    }
  }

  newProduct.push(newSensibleRange);

  return newProduct;
}

export function intersectDisjointRanges<ValueType>(
  order: (a: ValueType, b: ValueType) => -1 | 0 | 1,
  a: DisjointRange<ValueType>,
  b: DisjointRange<ValueType>,
) {
  if (
    !isSensibleDisjointRange(order, a) || !isSensibleDisjointRange(order, b)
  ) {
    throw new Error("Passed nonsense disjoint range");
  }

  const newRange: DisjointRange<ValueType> = [];

  for (const rangeA of a) {
    for (const rangeB of b) {
      const intersection = intersectRanges(order, rangeA, rangeB);

      if (intersection) {
        newRange.push(intersection);
      }
    }
  }

  return newRange;
}

// Three dimensional products

/** A product made of three disjoint ranges, representing timestamps, paths, and subspace IDs respectively. */
export type ThreeDimensionalProduct<SubspaceIdType> = [
  /** Timestamp disjoint range */
  DisjointRange<Uint8Array>,
  /** Path disjoint range */
  DisjointRange<Uint8Array>,
  /** Subspace ID disjoint range */
  DisjointRange<SubspaceIdType>,
];

/** Check if a 3d product is sensible, that is either all dimensions are empty, or all dimensions are non-empty and each disjoint range is sensible.
 */
export function isSensible3dProduct<SubspaceIdType>(
  subspaceOrder: (a: SubspaceIdType, b: SubspaceIdType) => -1 | 0 | 1,
  product: ThreeDimensionalProduct<SubspaceIdType>,
): boolean {
  // Are all of them empty?
  const [timestampDisjointRange, pathDisjointRange, subspaceDisjointRange] =
    product;

  if (
    product[0].length === 0 &&
    product[1].length === 0 &&
    product[2].length === 0
  ) {
    return true;
  }

  const checkDisjointRange = <ValueType>(
    order: (a: ValueType, b: ValueType) => -1 | 0 | 1,
    disjointRange: DisjointRange<ValueType>,
  ) => {
    // Each range set contains one entry.
    if (disjointRange.length === 0) {
      return false;
    }

    if (isSensibleDisjointRange(order, disjointRange) === false) {
      return false;
    }
  };

  if (checkDisjointRange(orderTimestamps, timestampDisjointRange) === false) {
    return false;
  }

  if (checkDisjointRange(orderBytes, pathDisjointRange) === false) {
    return false;
  }

  if (checkDisjointRange(subspaceOrder, subspaceDisjointRange) === false) {
    return false;
  }

  return true;
}

export function addTo3dProduct<SubspaceIdType>(
  orderSubspace: (a: SubspaceIdType, b: SubspaceIdType) => -1 | 0 | 1,
  range: ThreeDimensionalRange<SubspaceIdType>,
  product: ThreeDimensionalProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  if (isSensible3dRange(orderSubspace, range) === false) {
    throw new Error("Badly formed 3D range");
  }

  if (isSensible3dProduct(orderSubspace, product) === false) {
    throw new Error("3D product is not sensible");
  }

  const [timestampRange, pathRange, subspaceRange] = range;
  const [timestampDisjoint, pathDisjoint, subspaceDisjoint] = product;

  const nextTimestampDisjoint = addToDisjointRange(
    orderTimestamps,
    timestampRange,
    timestampDisjoint,
  );

  const nextPathDisjoint = addToDisjointRange(
    orderBytes,
    pathRange,
    pathDisjoint,
  );

  const nextSubspaceDisjoint = addToDisjointRange(
    orderSubspace,
    subspaceRange,
    subspaceDisjoint,
  );

  return [
    nextTimestampDisjoint,
    nextPathDisjoint,
    nextSubspaceDisjoint,
  ];
}

export function intersect3dProducts<SubspaceIdType>(
  orderSubspace: (a: SubspaceIdType, b: SubspaceIdType) => -1 | 0 | 1,
  a: ThreeDimensionalProduct<SubspaceIdType>,
  b: ThreeDimensionalProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  if (
    !isSensible3dProduct(orderSubspace, a) ||
    !isSensible3dProduct(orderSubspace, b)
  ) {
    throw new Error("Passed non-sensible 3d product(s) to intersect");
  }

  const [timestampDjA, pathDjA, subspaceDjA] = a;
  const [timestampDjB, pathDjB, subspaceDjB] = b;

  const intersectionTimestamp = intersectDisjointRanges(
    orderTimestamps,
    timestampDjA,
    timestampDjB,
  );

  if (intersectionTimestamp.length === 0) {
    return [[], [], []];
  }

  const intersectionPath = intersectDisjointRanges(
    orderBytes,
    pathDjA,
    pathDjB,
  );

  if (intersectionPath.length === 0) {
    return [[], [], []];
  }

  const intersectionSubspace = intersectDisjointRanges(
    orderSubspace,
    subspaceDjA,
    subspaceDjB,
  );

  if (intersectionSubspace.length === 0) {
    return [[], [], []];
  }

  return [
    intersectionTimestamp,
    intersectionPath,
    intersectionSubspace,
  ];
}
