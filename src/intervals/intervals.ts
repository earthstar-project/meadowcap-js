import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { TotalOrder } from "../order/types.ts";
import { Interval, IntervalOrder, ThreeDimensionalInterval } from "./types.ts";

export function isEqualInterval<ValueType>(
  { order }: { order: TotalOrder<ValueType> },
  a: Interval<ValueType>,
  b: Interval<ValueType>,
) {
  const [x, y] = orderIntervalPair(a, b);

  if (x.kind !== y.kind) {
    return false;
  } else if (x.kind === "open" && y.kind === "open") {
    return order(x.start, y.start) === 0;
  } else if (x.kind === "closed_exclusive" && y.kind === "closed_exclusive") {
    return order(x.start, y.start) === 0 && order(x.end, y.end) === 0;
  }
}

export function isValidInterval<ValueType>(
  order: TotalOrder<ValueType>,
  interval: Interval<ValueType>,
) {
  if (interval.kind === "closed_exclusive") {
    const startEndOrder = order(interval.start, interval.end);

    if (startEndOrder > -1) {
      return false;
    }
  }

  return true;
}

export function isValid3dInterval<SubspaceIdType>(
  orderSubspace: TotalOrder<SubspaceIdType>,
  range: ThreeDimensionalInterval<SubspaceIdType>,
) {
  const [subspaceRange, pathRange, timestampRange] = range;

  if (isValidInterval(orderSubspace, subspaceRange) === false) {
    return false;
  }

  if (isValidInterval(orderPaths, pathRange) === false) {
    return false;
  }

  if (isValidInterval(orderTimestamps, timestampRange) === false) {
    return false;
  }

  return true;
}

/** Order a given pair of ranges by their type. Useful for functions using boolean logic based on the different combinations of range types. */
export function orderIntervalPair<ValueType>(
  a: Interval<ValueType>,
  b: Interval<ValueType>,
) {
  if (a.kind === b.kind) {
    return [a, b];
  }

  const aRank = IntervalOrder[a.kind];
  const bRank = IntervalOrder[b.kind];

  if (bRank < aRank) {
    return [b, a];
  }

  return [a, b];
}

export function intersectIntervals<ValueType>(
  { order }: {
    order: TotalOrder<ValueType>;
  },
  a: Interval<ValueType>,
  b: Interval<ValueType>,
): Interval<ValueType> | null {
  if (!isValidInterval(order, a) || !isValidInterval(order, b)) {
    throw new Error("Invalid ranges given");
  }

  const [x, y] = orderIntervalPair(a, b);

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
      return y;
    } else if (
      aStartBStartOrder > 0 && aStartBEndOrder < 0
    ) {
      return {
        kind: "closed_exclusive",
        start: x.start,
        end: y.end,
      };
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

    return {
      kind: "closed_exclusive",
      start: max.start,
      end: order(min.end, max.end) < 0 ? min.end : max.end,
    };
  }

  return null;
}

export function intervalIncludesValue<ValueType>(
  { order }: { order: TotalOrder<ValueType> },
  interval: Interval<ValueType>,
  value: ValueType,
): boolean {
  if (interval.kind === "open") {
    return order(value, interval.start) >= 0;
  }

  return order(value, interval.start) >= 0 && order(value, interval.end) === -1;
}

export function intersect3dIntervals<SubspaceIdType>(
  { orderSubspace }: { orderSubspace: TotalOrder<SubspaceIdType> },
  a: ThreeDimensionalInterval<SubspaceIdType>,
  b: ThreeDimensionalInterval<SubspaceIdType>,
): ThreeDimensionalInterval<SubspaceIdType> | null {
  const [subspaceRangeA, pathRangeA, timestampRangeA] = a;
  const [subspaceRangeB, pathRangeB, timestampRangeB] = b;

  const subspaceIntersection = intersectIntervals(
    { order: orderSubspace },
    subspaceRangeA,
    subspaceRangeB,
  );

  const pathIntersection = intersectIntervals(
    { order: orderPaths },
    pathRangeA,
    pathRangeB,
  );

  if (pathIntersection === null) {
    return null;
  }

  const timestampIntersection = intersectIntervals(
    { order: orderTimestamps },
    timestampRangeA,
    timestampRangeB,
  );

  if (timestampIntersection === null) {
    return null;
  }

  if (subspaceIntersection === null) {
    return null;
  }

  return [
    subspaceIntersection,
    pathIntersection,
    timestampIntersection,
  ];
}
