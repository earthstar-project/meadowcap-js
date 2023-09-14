import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { successorPath, successorTimestamp } from "../order/successors.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";
import {
  ClosedRange,
  Range,
  RangeOrder,
  ThreeDimensionalRange,
} from "./types.ts";

export function isValidRange<ValueType>(
  order: TotalOrder<ValueType>,
  range: Range<ValueType>,
) {
  if (range.kind === "closed_exclusive") {
    const startEndOrder = order(range.start, range.end);

    if (startEndOrder !== -1) {
      return false;
    }
  } else if (range.kind === "closed_inclusive") {
    const startEndOrder = order(range.start, range.end);

    if (startEndOrder === 1) {
      return false;
    }
  }

  return true;
}

export function isValid3dRange<SubspaceIdType>(
  orderSubspace: TotalOrder<SubspaceIdType>,
  range: ThreeDimensionalRange<SubspaceIdType>,
) {
  const [timestampRange, pathRange, subspaceRange] = range;

  if (isValidRange(orderTimestamps, timestampRange) === false) {
    return false;
  }

  if (isValidRange(orderPaths, pathRange) === false) {
    return false;
  }

  if (isValidRange(orderSubspace, subspaceRange) === false) {
    return false;
  }

  return true;
}

/** Order a given pair of ranges by their type. Useful for functions using boolean logic based on the different combinations of range types. */
export function orderRangePair<ValueType>(
  a: Range<ValueType>,
  b: Range<ValueType>,
) {
  if (a.kind === b.kind) {
    return [a, b];
  }

  const aRank = RangeOrder[a.kind];
  const bRank = RangeOrder[b.kind];

  if (bRank < aRank) {
    return [b, a];
  }

  return [a, b];
}

export function getSmallerFromInclusiveRange<ValueType>(
  { getSuccessor, isInclusiveSmaller }: {
    getSuccessor: SuccessorFn<ValueType>;
    isInclusiveSmaller: (inclusive: ValueType, exclusive: ValueType) => boolean;
  },
  inclusiveRange: {
    kind: "closed_inclusive";
    start: ValueType;
    end: ValueType;
  },
): ClosedRange<ValueType> {
  const exclusiveEnd = getSuccessor(inclusiveRange.end);

  if (isInclusiveSmaller(inclusiveRange.end, exclusiveEnd)) {
    return inclusiveRange;
  }

  return {
    kind: "closed_exclusive",
    start: inclusiveRange.start,
    end: exclusiveEnd,
  };
}

export function getSmallerFromExclusiveRange<ValueType>(
  { getPredecessor, isInclusiveSmaller }: {
    getPredecessor: PredecessorFn<ValueType>;
    isInclusiveSmaller: (inclusive: ValueType, exclusive: ValueType) => boolean;
  },
  exclusiveRange: {
    kind: "closed_exclusive";
    start: ValueType;
    end: ValueType;
  },
): ClosedRange<ValueType> {
  const inclusiveEnd = getPredecessor(exclusiveRange.end);

  if (isInclusiveSmaller(inclusiveEnd, exclusiveRange.end)) {
    return {
      kind: "closed_inclusive",
      start: exclusiveRange.start,
      end: inclusiveEnd,
    };
  }

  return exclusiveRange;
}

export function intersectRanges<ValueType>(
  { order, getPredecessor, getSuccessor, isInclusiveSmaller }: {
    order: TotalOrder<ValueType>;
    getPredecessor: PredecessorFn<ValueType>;
    getSuccessor: SuccessorFn<ValueType>;
    isInclusiveSmaller: (inclusive: ValueType, exclusive: ValueType) => boolean;
  },
  a: Range<ValueType>,
  b: Range<ValueType>,
): Range<ValueType> | null {
  if (!isValidRange(order, a) || !isValidRange(order, b)) {
    throw new Error("Invalid ranges given");
  }

  const [x, y] = orderRangePair(a, b);

  if (x.kind === "open" && y.kind === "open") {
    return {
      kind: "open",
      start: order(x.start, y.start) <= 0 ? y.start : x.start,
    };
  } else if (
    x.kind === "open" &&
    y.kind === "closed_exclusive"
  ) {
    const aStartBStartOrder = order(x.start, y.start);
    const aStartBEndOrder = order(x.start, y.end);

    if (aStartBStartOrder <= 0) {
      return getSmallerFromExclusiveRange({
        getPredecessor,
        isInclusiveSmaller,
      }, y);
    } else if (
      aStartBStartOrder > 0 && aStartBEndOrder < 0
    ) {
      return getSmallerFromExclusiveRange({
        getPredecessor,
        isInclusiveSmaller,
      }, {
        kind: "closed_exclusive",
        start: x.start,
        end: y.end,
      });
    }

    return null;
  } else if (x.kind === "open" && y.kind === "closed_inclusive") {
    const aStartBStartOrder = order(x.start, y.start);
    const aStartBEndOrder = order(x.start, y.end);

    if (aStartBStartOrder <= 0) {
      return y;
    } else if (aStartBStartOrder > 0 && aStartBEndOrder <= 0) {
      return getSmallerFromInclusiveRange(
        { getSuccessor, isInclusiveSmaller },
        {
          kind: "closed_inclusive",
          start: x.start,
          end: y.end,
        },
      );
    }

    return null;
  } else if (
    x.kind === "closed_exclusive" && y.kind === "closed_exclusive"
  ) {
    const min = order(x.start, y.start) < 0 ? x : y;
    const max = min === x ? y : x;

    // reject if min's end is lte max's start
    if (order(min.end, max.start) <= 0) {
      return null;
    }

    // reject if max's start is gte min's end
    if (order(max.start, min.end) >= 0) {
      return null;
    }

    return getSmallerFromExclusiveRange({
      getPredecessor,
      isInclusiveSmaller,
    }, {
      kind: "closed_exclusive",
      start: max.start,
      end: order(min.end, max.end) < 0 ? min.end : max.end,
    });
  } else if (x.kind === "closed_exclusive" && y.kind === "closed_inclusive") {
    const min = order(x.start, y.start) < 0 ? x : y;
    const max = min === x ? y : x;

    if (min.kind === "closed_exclusive") {
      // reject if min's end come's is lte max's start
      if (order(min.end, max.start) <= 0) {
        return null;
      }
    } else {
      // reject if min's end come's is lt max's start
      if (order(min.end, max.start) < 0) {
        return null;
      }
    }

    if (min.kind === "closed_inclusive" && order(min.end, max.start) === 0) {
      return getSmallerFromInclusiveRange(
        { getSuccessor, isInclusiveSmaller },
        {
          kind: "closed_inclusive",
          start: min.end,
          end: min.end,
        },
      );
    }

    if (max.kind === "closed_exclusive") {
      // reject if max's start comes is gte min's end
      if (order(max.start, min.end) >= 0) {
        return null;
      }
    } else {
      if (order(max.start, min.end) > 0) {
        return null;
      }
    }

    const endOrder = min.kind === "closed_exclusive"
      ? order(min.end, getSuccessor(max.end))
      : order(getSuccessor(min.end), max.end);

    if (min.kind === "closed_exclusive") {
      if (endOrder < 0) {
        return getSmallerFromExclusiveRange({
          getPredecessor,
          isInclusiveSmaller,
        }, {
          kind: "closed_exclusive",
          start: max.start,
          end: min.end,
        });
      } else {
        return getSmallerFromInclusiveRange({
          getSuccessor,
          isInclusiveSmaller,
        }, {
          kind: "closed_inclusive",
          start: max.start,
          end: max.end,
        });
      }
    }

    if (endOrder < 0) {
      return getSmallerFromInclusiveRange(
        { getSuccessor, isInclusiveSmaller },
        {
          kind: "closed_inclusive",
          start: max.start,
          end: min.end,
        },
      );
    }

    return getSmallerFromExclusiveRange({
      getPredecessor,
      isInclusiveSmaller,
    }, {
      kind: "closed_exclusive",
      start: max.start,
      end: max.end,
    });
  } else if (x.kind === "closed_inclusive" && y.kind === "closed_inclusive") {
    const min = order(x.start, y.start) < 0 ? x : y;
    const max = min === x ? y : x;

    if (order(min.end, max.start) < 0) {
      return null;
    }

    if (order(min.end, max.start) === 0) {
      return getSmallerFromInclusiveRange(
        { getSuccessor, isInclusiveSmaller },
        {
          kind: "closed_inclusive",
          start: min.end,
          end: min.end,
        },
      );
    }

    const endOrder = order(min.end, max.end);

    const end = endOrder === -1 ? min.end : max.end;

    if (order(max.start, end) > -1) {
      return null;
    }

    return getSmallerFromInclusiveRange({ getSuccessor, isInclusiveSmaller }, {
      kind: "closed_inclusive",
      start: max.start,
      end: min.end < max.end ? min.end : max.end,
    });
  }

  return null;
}

export function intersect3dRanges<SubspaceIdType>(
  {
    orderSubspace,
    getPredecessorSubspace,
    getSuccessorSubspace,
    isInclusiveSmaller,
  }: {
    orderSubspace: TotalOrder<SubspaceIdType>;
    getPredecessorSubspace: PredecessorFn<SubspaceIdType>;
    getSuccessorSubspace: SuccessorFn<SubspaceIdType>;
    isInclusiveSmaller: (
      inclusiveSubspaceId: SubspaceIdType,
      exclusiveSubspaceId: SubspaceIdType,
    ) => boolean;
  },
  a: ThreeDimensionalRange<SubspaceIdType>,
  b: ThreeDimensionalRange<SubspaceIdType>,
): ThreeDimensionalRange<SubspaceIdType> | null {
  const [timestampRangeA, pathRangeA, subspaceRangeA] = a;
  const [timestampRangeB, pathRangeB, subspaceRangeB] = b;

  const timestampIntersection = intersectRanges(
    {
      order: orderTimestamps,
      getSuccessor: successorTimestamp,
      getPredecessor: predecessorTimestamp,
      isInclusiveSmaller: () => false,
    },
    timestampRangeA,
    timestampRangeB,
  );

  if (timestampIntersection === null) {
    return null;
  }

  const pathIntersection = intersectRanges(
    {
      order: orderPaths,
      getPredecessor: predecessorPath,
      getSuccessor: successorPath,
      isInclusiveSmaller: (inclusive, exclusive) => {
        return inclusive.byteLength < exclusive.byteLength;
      },
    },
    pathRangeA,
    pathRangeB,
  );

  if (pathIntersection === null) {
    return null;
  }

  const subspaceIntersection = intersectRanges(
    {
      order: orderSubspace,
      getPredecessor: getPredecessorSubspace,
      getSuccessor: getSuccessorSubspace,
      isInclusiveSmaller,
    },
    subspaceRangeA,
    subspaceRangeB,
  );

  if (subspaceIntersection === null) {
    return null;
  }

  return [
    timestampIntersection,
    pathIntersection,
    subspaceIntersection,
  ];
}

export function isEqualRange<ValueType>(
  { order, getSuccessor }: {
    order: TotalOrder<ValueType>;
    getSuccessor: SuccessorFn<ValueType>;
  },
  a: Range<ValueType>,
  b: Range<ValueType>,
) {
  const [x, y] = orderRangePair(a, b);

  if (x.kind === "open" && y.kind === "open") {
    const startOrder = order(a.start, b.start);

    return startOrder === 0;
  } else if (x.kind === "closed_exclusive" && y.kind === "closed_exclusive") {
    const startOrder = order(x.start, y.start);

    if (startOrder !== 0) {
      return false;
    }

    const endOrder = order(x.end, y.end);

    return endOrder === 0;
  } else if (x.kind === "closed_exclusive" && y.kind === "closed_inclusive") {
    const startOrder = order(x.start, y.start);

    if (startOrder !== 0) {
      return false;
    }

    // get successor of inclusive.end, check equality with exclusive.end
    const yEndSuccessor = getSuccessor(y.end);

    const endOrder = order(x.end, yEndSuccessor);

    return endOrder === 0;
  } else if (x.kind === "closed_inclusive" && y.kind === "closed_inclusive") {
    const startOrder = order(x.start, y.start);

    if (startOrder !== 0) {
      return false;
    }

    const endOrder = order(x.end, y.end);

    return endOrder === 0;
  }

  return false;
}
