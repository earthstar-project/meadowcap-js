import {
  intersectIntervals,
  isEqualInterval,
  isValid3dInterval,
  isValidInterval,
  orderIntervalPair,
} from "../intervals/intervals.ts";
import { Interval, ThreeDimensionalInterval } from "../intervals/types.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";
import { PredecessorFn, TotalOrder } from "../order/types.ts";
import { getSmallerFromExclusiveRange } from "../ranges/ranges.ts";

import {
  CanonicProduct,
  DimensionPairing,
  DisjointInterval,
  DisjointRange,
  ThreeDimensionalProduct,
} from "./types.ts";

/** Adds a range to a disjoint range in such a way that the result is always canonical. */
export function addToDisjointIntervalCanonically<ValueType>(
  {
    order,
    shouldThrow,
  }: {
    order: TotalOrder<ValueType>;
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
      mergedDisjointRange = addToDisjointIntervalCanonically(
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
  disjointRanges: DisjointInterval<ValueType>,
) {
  for (const range of disjointRanges) {
    if (range.kind === "open") {
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
    shouldThrow?: boolean;
  },
  interval3d: ThreeDimensionalInterval<SubspaceIdType>,
  product: ThreeDimensionalProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  if (isValid3dInterval(orderSubspace, interval3d) === false) {
    throw new Error("Badly formed 3D interval");
  }

  const [subspaceRange, pathRange, timestampRange] = interval3d;
  const [subspaceDisjoint, pathDisjoint, timestampDisjoint] = product;

  const nextSubspaceDisjoint = addToDisjointIntervalCanonically(
    {
      order: orderSubspace,
      shouldThrow,
    },
    subspaceRange,
    subspaceDisjoint,
  );

  const nextPathDisjoint = addToDisjointIntervalCanonically(
    {
      order: orderPaths,
      shouldThrow,
    },
    pathRange,
    pathDisjoint,
  );

  const nextTimestampDisjoint = addToDisjointIntervalCanonically(
    {
      order: orderTimestamps,
      shouldThrow,
    },
    timestampRange,
    timestampDisjoint,
  );

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

export function merge3dProducts<SubspaceIdType>(
  { orderSubspace }: { orderSubspace: TotalOrder<SubspaceIdType> },
  ...products: ThreeDimensionalProduct<SubspaceIdType>[]
): ThreeDimensionalProduct<SubspaceIdType> {
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

  // TODO: If any one of these is empty...

  if (subspaceIsEqual && timestampIsEqual) {
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

  const pathIsEqual = isEqualDisjointInterval(
    { order: orderPaths },
    pathDjA,
    pathDjB,
  );

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
  } else if ((pathIsEqual && subspaceIsEqual)) {
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

// TODO: ThreeDimensionalProduct to Canonical3dProduct fn

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
