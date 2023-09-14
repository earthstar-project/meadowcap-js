import { orderPaths, orderTimestamps } from "../order/orders.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";
import { successorPath, successorTimestamp } from "../order/successors.ts";
import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import {
  getSmallerFromExclusiveRange,
  getSmallerFromInclusiveRange,
  intersectRanges,
  isEqualRange,
  isValid3dRange,
  isValidRange,
  orderRangePair,
} from "../ranges/ranges.ts";
import { Range, ThreeDimensionalRange } from "../ranges/types.ts";
import {
  DimensionPairing,
  DisjointInterval,
  ThreeDimensionalProduct,
} from "./types.ts";

/** Adds a range to a disjoint range in such a way that the result is always canonical. */
export function addToDisjointIntervalCanonically<ValueType>(
  {
    order,
    getPredecessor,
    getSuccessor,
    isInclusiveSmaller,
    shouldThrow,
    forceInclusive,
  }: {
    order: TotalOrder<ValueType>;
    getPredecessor: PredecessorFn<ValueType>;
    getSuccessor: SuccessorFn<ValueType>;
    isInclusiveSmaller: (inclusive: ValueType, exclusive: ValueType) => boolean;
    shouldThrow?: boolean;
    forceInclusive?: boolean;
  },
  range: Range<ValueType>,
  disjointInterval: DisjointInterval<ValueType> = [],
): DisjointInterval<ValueType> {
  // Check if range makes sense.

  if (forceInclusive && shouldThrow && range.kind === "closed_exclusive") {
    throw new Error(
      "Tried to add exclusive range to inclusive only disjoint interval",
    );
  }

  if (isValidRange(order, range) === false) {
    throw new Error("Badly formed range");
  }

  const newDisjointInterval: Range<ValueType>[] = [];

  let foldedRange = { ...range };

  const maybeThrow = (msg: string) => {
    if (shouldThrow) {
      throw new Error(msg);
    }
  };

  for (const existingRange of disjointInterval) {
    const [x, y] = orderRangePair(existingRange, foldedRange);

    if (x.kind === "open" && y.kind === "open") {
      maybeThrow("More than one open range present");

      const openStartOrder = order(foldedRange.start, existingRange.start);

      if (openStartOrder > 0) {
        foldedRange.start = existingRange.start;
      }
    } else if (
      x.kind === "open" &&
      (y.kind === "closed_exclusive" || y.kind === "closed_inclusive")
    ) {
      const closedEndOpenStartOrder = order(
        y.kind === "closed_exclusive" ? y.end : getSuccessor(y.end),
        x.start,
      );
      const openStartClosedStartOrder = order(
        x.start,
        y.start,
      );

      if (openStartClosedStartOrder < 0) {
        maybeThrow("Closed range succeeded and open range's start");

        foldedRange = {
          kind: "open",
          start: x.start,
        };
      } else if (closedEndOpenStartOrder >= 0) {
        maybeThrow("Closed range overlapped / adjacent to an open range");

        foldedRange = {
          kind: "open",
          start: y.start,
        };
      } else {
        newDisjointInterval.push(existingRange);
      }
    } else if (
      (x.kind === "closed_exclusive" || x.kind === "closed_inclusive") &&
      (y.kind === "closed_exclusive" || y.kind === "closed_inclusive")
    ) {
      const xEndYStartOrder = order(
        x.kind === "closed_exclusive" ? x.end : getSuccessor(x.end),
        y.start,
      );

      if (xEndYStartOrder === -1) {
        newDisjointInterval.push(existingRange);
        continue;
      }

      const yEndXStartOrder = order(
        y.kind === "closed_exclusive" ? y.end : getSuccessor(y.end),
        x.start,
      );

      if (yEndXStartOrder === -1) {
        newDisjointInterval.push(existingRange);
        continue;
      }

      // At this point we know they overlap.

      maybeThrow("Overlapping / adjacent ranges");

      const leastStart = order(x.start, y.start) <= 0 ? x.start : y.start;
      const greatestEnd = order(
          x.kind === "closed_exclusive" ? x.end : getSuccessor(x.end),
          y.kind === "closed_exclusive" ? y.end : getSuccessor(y.end),
        ) > 0
        ? x
        : y;

      foldedRange = {
        kind: greatestEnd.kind,
        start: leastStart,
        end: greatestEnd.end,
      };
    }
  }

  if (foldedRange.kind === "open") {
    newDisjointInterval.push(foldedRange);
  } else if (foldedRange.kind === "closed_exclusive") {
    newDisjointInterval.push(getSmallerFromExclusiveRange({
      getPredecessor,
      isInclusiveSmaller: forceInclusive ? () => true : isInclusiveSmaller,
    }, foldedRange));
  } else {
    newDisjointInterval.push(getSmallerFromInclusiveRange({
      getSuccessor,
      isInclusiveSmaller: forceInclusive ? () => true : isInclusiveSmaller,
    }, foldedRange));
  }

  return newDisjointInterval;
}

/** Intersect two disjoint intervals, presumed to be canonical. */
export function intersectDisjointIntervals<ValueType>(
  {
    order,
    getPredecessor,
    getSuccessor,
    isInclusiveSmaller,
  }: {
    order: TotalOrder<ValueType>;
    getPredecessor: PredecessorFn<ValueType>;
    getSuccessor: SuccessorFn<ValueType>;
    isInclusiveSmaller: (inclusive: ValueType, exclusive: ValueType) => boolean;
  },
  a: DisjointInterval<ValueType>,
  b: DisjointInterval<ValueType>,
) {
  const newRange: DisjointInterval<ValueType> = [];

  for (const rangeA of a) {
    for (const rangeB of b) {
      const intersection = intersectRanges(
        {
          order,
          getPredecessor,
          isInclusiveSmaller,
          getSuccessor,
        },
        rangeA,
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
  { order, getSuccessor }: {
    order: TotalOrder<ValueType>;
    getSuccessor: SuccessorFn<ValueType>;
  },
  a: DisjointInterval<ValueType>,
  b: DisjointInterval<ValueType>,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    const rangeA = a[i];
    const rangeB = b[i];

    if (isEqualRange({ order, getSuccessor }, rangeA, rangeB) === false) {
      return false;
    }
  }

  return true;
}

export function mergeDisjointRanges<ValueType>(
  {
    order,
    getPredecessor,
    getSuccessor,
    isInclusiveSmaller,
  }: {
    order: TotalOrder<ValueType>;
    getPredecessor: PredecessorFn<ValueType>;
    getSuccessor: SuccessorFn<ValueType>;
    isInclusiveSmaller: (inclusive: ValueType, exclusive: ValueType) => boolean;
    shouldThrow?: boolean;
    forceInclusive?: boolean;
  },
  ...disjointRanges: DisjointInterval<ValueType>[]
): DisjointInterval<ValueType> {
  const [first, ...rest] = disjointRanges;

  let mergedDisjointRange = [...first];

  for (const disjointRange of rest) {
    for (const range of disjointRange) {
      mergedDisjointRange = addToDisjointIntervalCanonically(
        {
          order,
          getPredecessor,
          getSuccessor,
          isInclusiveSmaller,
        },
        range,
        mergedDisjointRange,
      );
    }
  }

  return mergedDisjointRange;
}

// Three dimensional products

export function addTo3dProduct<SubspaceIdType>(
  {
    orderSubspace,
    getPredecessorSubspace,
    getSuccessorSubspace,
    isInclusiveSmallerSubspace,
    shouldThrow,
  }: {
    orderSubspace: TotalOrder<SubspaceIdType>;
    getPredecessorSubspace: PredecessorFn<SubspaceIdType>;
    getSuccessorSubspace: SuccessorFn<SubspaceIdType>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspaceIdType,
      exclusive: SubspaceIdType,
    ) => boolean;
    shouldThrow?: boolean;
  },
  range: ThreeDimensionalRange<SubspaceIdType>,
  product: ThreeDimensionalProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  if (isValid3dRange(orderSubspace, range) === false) {
    throw new Error("Badly formed 3D range");
  }

  const [timestampRange, pathRange, subspaceRange] = range;
  const [timestampDisjoint, pathDisjoint, subspaceDisjoint] = product;

  const nextTimestampDisjoint = addToDisjointIntervalCanonically(
    {
      forceInclusive: true,
      isInclusiveSmaller: () => true,
      order: orderTimestamps,
      getPredecessor: predecessorTimestamp,
      getSuccessor: successorTimestamp,
      shouldThrow,
    },
    timestampRange,
    timestampDisjoint,
  );

  const nextPathDisjoint = addToDisjointIntervalCanonically(
    {
      order: orderPaths,
      getPredecessor: predecessorPath,
      getSuccessor: successorPath,
      isInclusiveSmaller: (a, b) => a.byteLength < b.byteLength,
      shouldThrow,
    },
    pathRange,
    pathDisjoint,
  );

  const nextSubspaceDisjoint = addToDisjointIntervalCanonically(
    {
      order: orderSubspace,
      getPredecessor: getPredecessorSubspace,
      getSuccessor: getSuccessorSubspace,
      isInclusiveSmaller: isInclusiveSmallerSubspace,
      shouldThrow,
    },
    subspaceRange,
    subspaceDisjoint,
  );

  // TODO: check if all are empty, or all have at least one item.

  return [
    nextTimestampDisjoint,
    nextPathDisjoint,
    nextSubspaceDisjoint,
  ];
}

/* Intersect two 3d products, presumed to be canonical */
export function intersect3dProducts<SubspaceIdType>(
  {
    orderSubspace,
    getPredecessorSubspace,
    getSuccessorSubspace,
    isInclusiveSmallerSubspace,
  }: {
    orderSubspace: TotalOrder<SubspaceIdType>;
    getPredecessorSubspace: PredecessorFn<SubspaceIdType>;
    getSuccessorSubspace: SuccessorFn<SubspaceIdType>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspaceIdType,
      exclusive: SubspaceIdType,
    ) => boolean;
  },
  a: ThreeDimensionalProduct<SubspaceIdType>,
  b: ThreeDimensionalProduct<SubspaceIdType>,
): ThreeDimensionalProduct<SubspaceIdType> {
  const [timestampDjA, pathDjA, subspaceDjA] = a;
  const [timestampDjB, pathDjB, subspaceDjB] = b;

  const intersectionTimestamp = intersectDisjointIntervals(
    {
      isInclusiveSmaller: () => true,
      order: orderTimestamps,
      getPredecessor: predecessorTimestamp,
      getSuccessor: successorTimestamp,
    },
    timestampDjA,
    timestampDjB,
  );

  if (intersectionTimestamp.length === 0) {
    return [[], [], []];
  }

  const intersectionPath = intersectDisjointIntervals(
    {
      order: orderPaths,
      getPredecessor: predecessorPath,
      getSuccessor: successorPath,
      isInclusiveSmaller: (a, b) => a.byteLength < b.byteLength,
    },
    pathDjA,
    pathDjB,
  );

  if (intersectionPath.length === 0) {
    return [[], [], []];
  }

  const intersectionSubspace = intersectDisjointIntervals(
    {
      order: orderSubspace,
      getPredecessor: getPredecessorSubspace,
      getSuccessor: getSuccessorSubspace,
      isInclusiveSmaller: isInclusiveSmallerSubspace,
    },
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

function allRangesMatchOnDimensions<SubspaceIdType>(
  {
    orderSubspace,

    getSuccessorSubspace,
    dimensions,
  }: {
    orderSubspace: TotalOrder<SubspaceIdType>;

    getSuccessorSubspace: SuccessorFn<SubspaceIdType>;
    dimensions: DimensionPairing;
  },
  ...remainingProducts: ThreeDimensionalProduct<SubspaceIdType>[]
): boolean {
  for (let i = 0; i < remainingProducts.length - 1; i++) {
    const productA = remainingProducts[i];
    const productB = remainingProducts[i + 1];

    if (dimensions === "timestamp_path") {
      const timestampDjEqual = isEqualDisjointInterval(
        {
          order: orderTimestamps,
          getSuccessor: successorTimestamp,
        },
        productA[0],
        productB[0],
      );

      if (!timestampDjEqual) {
        return false;
      }

      const pathDjEqual = isEqualDisjointInterval(
        {
          order: orderPaths,
          getSuccessor: successorPath,
        },
        productA[1],
        productB[1],
      );

      if (!pathDjEqual) {
        return false;
      }
    } else if (dimensions === "timestamp_subspace") {
      const timestampDjEqual = isEqualDisjointInterval(
        {
          order: orderTimestamps,
          getSuccessor: successorTimestamp,
        },
        productA[0],
        productB[0],
      );

      if (!timestampDjEqual) {
        return false;
      }

      const subspaceDjEqual = isEqualDisjointInterval(
        {
          order: orderSubspace,
          getSuccessor: getSuccessorSubspace,
        },
        productA[2],
        productB[2],
      );

      if (!subspaceDjEqual) {
        return false;
      }
    } else if (dimensions === "path_subspace") {
      const pathDjEqual = isEqualDisjointInterval(
        {
          order: orderPaths,
          getSuccessor: successorPath,
        },
        productA[1],
        productB[1],
      );

      if (!pathDjEqual) {
        return false;
      }

      const subspaceDjEqual = isEqualDisjointInterval(
        {
          order: orderSubspace,
          getSuccessor: getSuccessorSubspace,
        },
        productA[2],
        productB[2],
      );

      if (!subspaceDjEqual) {
        return false;
      }
    }
  }

  return true;
}

export function merge3dProducts<SubspaceIdType>(
  {
    orderSubspace,
    getPredecessorSubspace,
    getSuccessorSubspace,
    isInclusiveSmallerSubspace,
  }: {
    orderSubspace: TotalOrder<SubspaceIdType>;
    getPredecessorSubspace: PredecessorFn<SubspaceIdType>;
    getSuccessorSubspace: SuccessorFn<SubspaceIdType>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspaceIdType,
      exclusive: SubspaceIdType,
    ) => boolean;
  },
  ...products: ThreeDimensionalProduct<SubspaceIdType>[]
): ThreeDimensionalProduct<SubspaceIdType> | null {
  const [fst, snd] = products;
  const [_fst, ...remainingProducts] = products;

  const [timestampDjA, pathDjA, subspaceDjA] = fst;
  const [timestampDjB, pathDjB, subspaceDjB] = snd;

  const subspaceIsEqual = isEqualDisjointInterval(
    { order: orderSubspace, getSuccessor: getSuccessorSubspace },
    subspaceDjA,
    subspaceDjB,
  );
  const timestampIsEqual = isEqualDisjointInterval(
    { order: orderTimestamps, getSuccessor: successorTimestamp },
    timestampDjA,
    timestampDjB,
  );

  if (subspaceIsEqual && timestampIsEqual) {
    // Check all remaining pairs have same subspace + timestamp.
    const allOtherPairsMatch = allRangesMatchOnDimensions(
      { orderSubspace, getSuccessorSubspace, dimensions: "timestamp_subspace" },
      ...remainingProducts,
    );

    if (allOtherPairsMatch) {
      return [
        timestampDjA,
        mergeDisjointRanges(
          {
            order: orderPaths,
            getPredecessor: predecessorPath,
            getSuccessor: successorPath,
            isInclusiveSmaller: (a, b) => a.byteLength < b.byteLength,
          },
          ...products.map((product) => product[1]),
        ),
        subspaceDjA,
      ];
    }
  }

  const pathIsEqual = isEqualDisjointInterval(
    {
      order: orderPaths,
      getSuccessor: successorPath,
    },
    pathDjA,
    pathDjB,
  );

  if (
    (pathIsEqual && timestampIsEqual)
  ) {
    const allOtherPairsMatch = allRangesMatchOnDimensions(
      { orderSubspace, getSuccessorSubspace, dimensions: "timestamp_path" },
      ...remainingProducts,
    );

    if (allOtherPairsMatch) {
      return [
        timestampDjA,
        pathDjA,
        mergeDisjointRanges(
          {
            order: orderSubspace,
            getPredecessor: getPredecessorSubspace,
            getSuccessor: getSuccessorSubspace,
            isInclusiveSmaller: isInclusiveSmallerSubspace,
          },
          ...products.map((product) => product[2]),
        ),
      ];
    }
  } else if ((pathIsEqual && subspaceIsEqual)) {
    const allOtherPairsMatch = allRangesMatchOnDimensions(
      { orderSubspace, getSuccessorSubspace, dimensions: "path_subspace" },
      ...remainingProducts,
    );

    if (allOtherPairsMatch) {
      return [
        mergeDisjointRanges(
          {
            order: orderTimestamps,
            getSuccessor: successorTimestamp,
            getPredecessor: predecessorTimestamp,
            isInclusiveSmaller: () => false,
          },
          ...products.map((product) => product[0]),
        ),
        pathDjA,
        subspaceDjA,
      ];
    }
  }

  return null;
}
