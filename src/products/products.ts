import {
  intersectIntervals,
  intervalIncludesValue,
  isEqualInterval,
  isValidInterval,
  orderIntervalPair,
} from "../intervals/intervals.ts";
import { Interval, Sparse3dInterval } from "../intervals/types.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import { getSmallerFromExclusiveRange } from "../ranges/ranges.ts";
import { Range } from "../ranges/types.ts";

import {
  CanonicProduct,
  DimensionPairing,
  DisjointInterval,
  DisjointRange,
  ThreeDimensionalProduct,
} from "./types.ts";

/** Adds a interval to a disjoint interval in such a way that the result is always canonical. */
export function addToDisjointInterval<ValueType>(
  {
    order,
    shouldThrow,
  }: {
    order: TotalOrder<ValueType>;
    /** Whether the function should throw if it has to reconcile non-canonically represented intervals. */
    shouldThrow?: boolean;
  },
  interval: Interval<ValueType>,
  disjointInterval: DisjointInterval<ValueType> = [],
): DisjointInterval<ValueType> {
  // Check if range makes sense.

  if (isValidInterval(order, interval) === false) {
    throw new Error("Badly formed range");
  }

  const newDisjointInterval: Interval<ValueType>[] = [];

  let foldedInterval = { ...interval };

  const maybeThrow = (msg: string) => {
    if (shouldThrow) {
      throw new Error(msg);
    }
  };

  for (const existingInterval of disjointInterval) {
    const [x, y] = orderIntervalPair(existingInterval, foldedInterval);

    if (x.kind === "open" && y.kind === "open") {
      maybeThrow("More than one open range present");

      const openStartOrder = order(
        foldedInterval.start,
        existingInterval.start,
      );

      if (openStartOrder > 0) {
        foldedInterval.start = existingInterval.start;
      }
    } else if (
      x.kind === "open" &&
      y.kind === "closed_exclusive"
    ) {
      const closedEndOpenStartOrder = order(
        y.end,
        x.start,
      );
      const openStartClosedStartOrder = order(
        x.start,
        y.start,
      );

      if (openStartClosedStartOrder < 0) {
        maybeThrow("Closed range succeeded and open range's start");

        foldedInterval = {
          kind: "open",
          start: x.start,
        };
      } else if (closedEndOpenStartOrder >= 0) {
        maybeThrow("Closed range overlapped / adjacent to an open range");

        foldedInterval = {
          kind: "open",
          start: y.start,
        };
      } else {
        newDisjointInterval.push(existingInterval);
      }
    } else if (
      x.kind === "closed_exclusive" &&
      y.kind === "closed_exclusive"
    ) {
      const xEndYStartOrder = order(
        x.end,
        y.start,
      );

      if (xEndYStartOrder === -1) {
        newDisjointInterval.push(existingInterval);
        continue;
      }

      const yEndXStartOrder = order(
        y.end,
        x.start,
      );

      if (yEndXStartOrder === -1) {
        newDisjointInterval.push(existingInterval);
        continue;
      }

      // At this point we know they overlap.

      maybeThrow("Overlapping / adjacent ranges");

      const leastStart = order(x.start, y.start) <= 0 ? x.start : y.start;
      const greatestEnd = order(x.end, y.end) > 0 ? x : y;

      foldedInterval = {
        kind: greatestEnd.kind,
        start: leastStart,
        end: greatestEnd.end,
      };
    }
  }

  newDisjointInterval.push(foldedInterval);

  return newDisjointInterval;
}

/** Adds a range to a disjoint range in such a way that the result is always canonical. */
export function addRangeToDisjointInterval<ValueType>(
  {
    order,
    isInclusiveSmaller,
    predecessor,
    successor,
  }: {
    order: TotalOrder<ValueType>;
    /** A function which tells us if the inclusive range will have a shorter encoded length. */
    isInclusiveSmaller: (inclusive: ValueType, exclusive: ValueType) => boolean;
    predecessor: PredecessorFn<ValueType>;
    successor: SuccessorFn<ValueType>;
  },
  range: Range<ValueType>,
  disjointInterval: DisjointInterval<ValueType> = [],
): DisjointInterval<ValueType> {
  if (range.kind === "open") {
    return addToDisjointInterval(
      { order, shouldThrow: true },
      range,
      disjointInterval,
    );
  } else if (range.kind === "closed_exclusive") {
    if (isInclusiveSmaller(predecessor(range.end), range.end)) {
      throw new Error("Non-canonical closed range");
    }

    return addToDisjointInterval(
      { order, shouldThrow: true },
      range,
      disjointInterval,
    );
  } else {
    const exclusiveEnd = successor(range.end);

    if (!isInclusiveSmaller(range.end, exclusiveEnd)) {
      throw new Error("Non-canonical closed range");
    }

    return addToDisjointInterval({ order, shouldThrow: true }, {
      kind: "closed_exclusive",
      start: range.start,
      end: exclusiveEnd,
    }, disjointInterval);
  }
}

/** Intersect two disjoint intervals, presumed to be canonical. */
export function intersectDisjointIntervals<ValueType>(
  { order }: { order: TotalOrder<ValueType> },
  a: DisjointInterval<ValueType>,
  b: DisjointInterval<ValueType>,
) {
  const newRange: DisjointInterval<ValueType> = [];

  for (const intervalA of a) {
    for (const rangeB of b) {
      const intersection = intersectIntervals(
        { order },
        intervalA,
        rangeB,
      );

      if (intersection) {
        newRange.push(intersection);
      }
    }
  }

  return newRange;
}

export function isEqualDisjointInterval<ValueType>(
  { order }: { order: TotalOrder<ValueType> },
  a: DisjointInterval<ValueType>,
  b: DisjointInterval<ValueType>,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    const rangeA = a[i];
    const rangeB = b[i];

    if (isEqualInterval({ order }, rangeA, rangeB) === false) {
      return false;
    }
  }

  return true;
}

export function mergeDisjointIntervals<ValueType>(
  { order }: { order: TotalOrder<ValueType> },
  ...DisjointIntervals: DisjointInterval<ValueType>[]
): DisjointInterval<ValueType> {
  if (DisjointIntervals.length === 0) {
    return [];
  }

  const [first, ...rest] = DisjointIntervals;

  let mergedDisjointRange = [...first];

  for (const disjointRange of rest) {
    for (const range of disjointRange) {
      mergedDisjointRange = addToDisjointInterval(
        {
          order,
        },
        range,
        mergedDisjointRange,
      );
    }
  }

  return mergedDisjointRange;
}

export function hasOpenRange<ValueType>(
  disjointRanges: DisjointRange<ValueType>,
) {
  for (const range of disjointRanges) {
    if (range.kind === "open") {
      return true;
    }
  }

  return false;
}

export function disjointIntervalIncludesValue<ValueType>(
  { order }: { order: TotalOrder<ValueType> },
  disjointInterval: DisjointInterval<ValueType>,
  value: ValueType,
) {
  for (const interval of disjointInterval) {
    if (intervalIncludesValue({ order }, interval, value)) {
      return true;
    }
  }

  return false;
}

// Three dimensional products

export function addTo3dProduct<SubspaceIdType>(
  {
    orderSubspace,
    shouldThrow,
  }: {
    orderSubspace: TotalOrder<SubspaceIdType>;
    /** Whether the function should throw if it has to reconcile non-canonically represented intervals. */
    shouldThrow?: boolean;
  },
  interval3d: Sparse3dInterval<SubspaceIdType>,
  product: ThreeDimensionalProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  const [subspaceInterval, pathInterval, timestampInterval] = interval3d;
  const [subspaceDisjoint, pathDisjoint, timestampDisjoint] = product;

  const nextSubspaceDisjoint = subspaceInterval
    ? addToDisjointInterval(
      {
        order: orderSubspace,
        shouldThrow,
      },
      subspaceInterval,
      subspaceDisjoint,
    )
    : subspaceDisjoint;

  const nextPathDisjoint = pathInterval
    ? addToDisjointInterval(
      {
        order: orderPaths,
        shouldThrow,
      },
      pathInterval,
      pathDisjoint,
    )
    : pathDisjoint;

  const nextTimestampDisjoint = timestampInterval
    ? addToDisjointInterval(
      {
        order: orderTimestamps,
        shouldThrow,
      },
      timestampInterval,
      timestampDisjoint,
    )
    : timestampDisjoint;

  return [
    nextSubspaceDisjoint,
    nextPathDisjoint,
    nextTimestampDisjoint,
  ];
}

/* Intersect two 3d products, presumed to be canonical */
export function intersect3dProducts<SubspaceIdType>(
  { orderSubspace }: { orderSubspace: TotalOrder<SubspaceIdType> },
  a: ThreeDimensionalProduct<SubspaceIdType>,
  b: ThreeDimensionalProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  const [subspaceDjA, pathDjA, timestampDjA] = a;
  const [subspaceDjB, pathDjB, timestampDjB] = b;

  // If the intersection of _any_ dimension is empty, then all dimensions must be empty.

  const intersectionSubspace = intersectDisjointIntervals(
    { order: orderSubspace },
    subspaceDjA,
    subspaceDjB,
  );

  if (intersectionSubspace.length === 0) {
    return [[], [], []];
  }

  const intersectionPath = intersectDisjointIntervals(
    { order: orderPaths },
    pathDjA,
    pathDjB,
  );

  if (intersectionPath.length === 0) {
    return [[], [], []];
  }

  const intersectionTimestamp = intersectDisjointIntervals(
    { order: orderTimestamps },
    timestampDjA,
    timestampDjB,
  );

  if (intersectionTimestamp.length === 0) {
    return [[], [], []];
  }

  return [
    intersectionSubspace,
    intersectionPath,
    intersectionTimestamp,
  ];
}

/** Merge many 3D products. Returns an empty product if the set is not pairwise mergeable.
 *
 * A set of 3d products is pairwise mergeable if any two 3d products in the set are mergeable. This is the case if and only if there is at most one dimension in which the values included by the ranges for that dimension differ between the 3d products.
 */
export function merge3dProducts<SubspaceIdType>(
  { orderSubspace }: { orderSubspace: TotalOrder<SubspaceIdType> },
  ...products: ThreeDimensionalProduct<SubspaceIdType>[]
): ThreeDimensionalProduct<SubspaceIdType> {
  // Check only the first two products for pairwise mergeability.
  // If they aren't pairwise mergeable, we can bail early.
  // Otherwise, we'll compare all other products too.

  const [fst, snd] = products;
  const [_fst, ...remainingProducts] = products;

  const [subspaceDjA, pathDjA, timestampDjA] = fst;
  const [subspaceDjB, pathDjB, timestampDjB] = snd;

  const subspaceIsEqual = isEqualDisjointInterval(
    { order: orderSubspace },
    subspaceDjA,
    subspaceDjB,
  );
  const timestampIsEqual = isEqualDisjointInterval(
    { order: orderTimestamps },
    timestampDjA,
    timestampDjB,
  );

  const pathIsEqual = isEqualDisjointInterval(
    { order: orderPaths },
    pathDjA,
    pathDjB,
  );

  if (!subspaceIsEqual && !timestampIsEqual && !pathIsEqual) {
    return [[], [], []];
  }

  if (timestampIsEqual && subspaceIsEqual) {
    // Check all remaining pairs have same subspace + timestamp.
    const allOtherPairsMatch = allRangesNonEmptyAndMatchOnDimensions(
      { orderSubspace, dimensions: "timestamp_subspace" },
      ...remainingProducts,
    );

    if (allOtherPairsMatch) {
      return [
        subspaceDjA,
        mergeDisjointIntervals(
          { order: orderPaths },
          ...products.map((product) => product[1]),
        ),
        timestampDjA,
      ];
    }
  }

  if (
    (pathIsEqual && timestampIsEqual)
  ) {
    const allOtherPairsMatch = allRangesNonEmptyAndMatchOnDimensions(
      { orderSubspace, dimensions: "timestamp_path" },
      ...remainingProducts,
    );

    if (allOtherPairsMatch) {
      return [
        mergeDisjointIntervals(
          { order: orderSubspace },
          ...products.map((product) => product[0]),
        ),
        pathDjA,
        timestampDjA,
      ];
    }
  }

  if ((pathIsEqual && subspaceIsEqual)) {
    const allOtherPairsMatch = allRangesNonEmptyAndMatchOnDimensions(
      { orderSubspace, dimensions: "path_subspace" },
      ...remainingProducts,
    );

    if (allOtherPairsMatch) {
      return [
        subspaceDjA,
        pathDjA,
        mergeDisjointIntervals(
          { order: orderTimestamps },
          ...products.map((product) => product[2]),
        ),
      ];
    }
  }

  return [[], [], []];
}

function allRangesNonEmptyAndMatchOnDimensions<SubspaceIdType>(
  {
    orderSubspace,
    dimensions,
  }: {
    orderSubspace: TotalOrder<SubspaceIdType>;
    dimensions: DimensionPairing;
  },
  ...remainingProducts: ThreeDimensionalProduct<SubspaceIdType>[]
): boolean {
  for (let i = 0; i < remainingProducts.length - 1; i++) {
    const productA = remainingProducts[i];
    const productB = remainingProducts[i + 1];

    if (dimensions === "timestamp_path") {
      if (productA[2].length === 0 || productB[2].length === 0) {
        return false;
      }

      const timestampDjEqual = isEqualDisjointInterval(
        { order: orderTimestamps },
        productA[2],
        productB[2],
      );

      if (!timestampDjEqual) {
        return false;
      }

      if (productA[1].length === 0 || productB[1].length === 0) {
        return false;
      }

      const pathDjEqual = isEqualDisjointInterval(
        { order: orderPaths },
        productA[1],
        productB[1],
      );

      if (!pathDjEqual) {
        return false;
      }
    } else if (dimensions === "timestamp_subspace") {
      if (productA[2].length === 0 || productB[2].length === 0) {
        return false;
      }

      const timestampDjEqual = isEqualDisjointInterval(
        { order: orderTimestamps },
        productA[2],
        productB[2],
      );

      if (!timestampDjEqual) {
        return false;
      }

      if (productA[0].length === 0 || productB[0].length === 0) {
        return false;
      }

      const subspaceDjEqual = isEqualDisjointInterval(
        { order: orderSubspace },
        productA[0],
        productB[0],
      );

      if (!subspaceDjEqual) {
        return false;
      }
    } else if (dimensions === "path_subspace") {
      if (productA[1].length === 0 || productB[1].length === 0) {
        return false;
      }

      const pathDjEqual = isEqualDisjointInterval(
        { order: orderPaths },
        productA[1],
        productB[1],
      );

      if (!pathDjEqual) {
        return false;
      }

      if (productA[0].length === 0 || productB[0].length === 0) {
        return false;
      }

      const subspaceDjEqual = isEqualDisjointInterval(
        { order: orderSubspace },
        productA[0],
        productB[0],
      );

      if (!subspaceDjEqual) {
        return false;
      }
    }
  }

  return true;
}

/** Derive a canonic 3D product made of ranges from a (nearly canonic) 3D product made of intervals. */
export function canonicProduct<SubspaceIdType>(
  {
    predecessorSubspace,
    isInclusiveSmallerSubspace,
  }: {
    predecessorSubspace: PredecessorFn<SubspaceIdType>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspaceIdType,
      exclusive: SubspaceIdType,
    ) => boolean;
  },
  prod: ThreeDimensionalProduct<SubspaceIdType>,
): CanonicProduct<SubspaceIdType> {
  const [subspaceDisjointInterval, pathDisjointInterval, timeDisjointInterval] =
    prod;

  // Subspace encoding smaller
  const subspaceDisjointRange: DisjointRange<SubspaceIdType> = [];

  for (const interval of subspaceDisjointInterval) {
    if (interval.kind === "open") {
      subspaceDisjointRange.push(interval);
      continue;
    }

    subspaceDisjointRange.push(getSmallerFromExclusiveRange({
      predecessor: predecessorSubspace,
      isInclusiveSmaller: isInclusiveSmallerSubspace,
    }, interval));
  }

  // Path encoding smaller
  const pathDisjointRange: DisjointRange<Uint8Array> = [];

  for (const interval of pathDisjointInterval) {
    if (interval.kind === "open") {
      pathDisjointRange.push(interval);
      continue;
    }

    pathDisjointRange.push(getSmallerFromExclusiveRange({
      predecessor: predecessorPath,
      isInclusiveSmaller: (inclusive, exclusive) =>
        inclusive.byteLength < exclusive.byteLength,
    }, interval));
  }

  // Time must be exclusive.
  const timeDisjointRange: DisjointRange<bigint> = [];

  for (const interval of timeDisjointInterval) {
    if (interval.kind === "open") {
      timeDisjointRange.push(interval);
      continue;
    }

    timeDisjointRange.push(getSmallerFromExclusiveRange({
      predecessor: predecessorTimestamp,
      isInclusiveSmaller: () => false,
    }, interval));
  }

  return [
    subspaceDisjointRange,
    pathDisjointRange,
    timeDisjointRange,
  ];
}

/** Turn a canonic 3D product of ranges into a nearly canonic 3D product of intervals. */
export function decanoniciseProduct<SubspaceIdType>(
  { maxPathLength, successorSubspace }: {
    maxPathLength: number;
    successorSubspace: SuccessorFn<SubspaceIdType>;
  },
  prod: CanonicProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  const [subspaceDisjointRange, pathDisjointRange, timeDisjointRange] = prod;

  // Subspace encoding smaller
  const subspaceDisjointInterval: DisjointInterval<SubspaceIdType> = [];

  for (const range of subspaceDisjointRange) {
    if (range.kind !== "closed_inclusive") {
      subspaceDisjointInterval.push(range);
      continue;
    }

    subspaceDisjointInterval.push({
      kind: "closed_exclusive",
      start: range.start,
      end: successorSubspace(range.end),
    });
  }

  // Path encoding smaller
  const pathDisjointInterval: DisjointInterval<Uint8Array> = [];

  for (const range of pathDisjointRange) {
    if (range.kind !== "closed_inclusive") {
      pathDisjointInterval.push(range);
      continue;
    }

    pathDisjointInterval.push({
      kind: "closed_exclusive",
      start: range.start,
      end: makeSuccessorPath(maxPathLength)(range.end),
    });
  }

  // Time must be exclusive.
  const timeDisjointInterval: DisjointInterval<bigint> = [];

  for (const range of timeDisjointRange) {
    if (range.kind !== "closed_inclusive") {
      timeDisjointInterval.push(range);
      continue;
    }

    timeDisjointInterval.push({
      kind: "closed_exclusive",
      start: range.start,
      end: successorTimestamp(range.end),
    });
  }

  return [
    subspaceDisjointInterval,
    pathDisjointInterval,
    timeDisjointInterval,
  ];
}
