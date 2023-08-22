import { orderBytes, orderTimestamps } from "./orders.ts";

/**
A range is either closed, consisting of a start value and an end value, or it is open, consisting only of a start value.

A closed range includes all values greater than or equal to the start value and strictly less than the end value. An open range includes all values greater than or equal to the start value.
*/
export type Range<ValueType> = {
  kind: "open";
  start: ValueType;
} | {
  kind: "closed";
  start: ValueType;
  end: ValueType;
};

/**
A 3d product consists of a set of time ranges, a set of path ranges and a set of subspace ranges.

It includes all entries of a namespace whose timestamp lies in at least one of the time ranges, whose path lies in at least one of the path ranges, and whose subspace ID lies in at least one of the subspace ranges.
*/
export type ThreeDimensionalRange<SubspaceIdType> = [
  /** Timestamp range */
  Range<Uint8Array>,
  /** Path range */
  Range<Uint8Array>,
  /** Subspace range */
  Range<SubspaceIdType>,
];

export function isSensibleRange<ValueType>(
  order: (a: ValueType, b: ValueType) => -1 | 0 | 1,
  range: Range<ValueType>,
) {
  if (range.kind === "closed") {
    const startEndOrder = order(range.start, range.end);

    if (startEndOrder !== -1) {
      return false;
    }
  }

  return true;
}

export function isSensible3dRange<SubspaceIdType>(
  orderSubspace: (a: SubspaceIdType, b: SubspaceIdType) => -1 | 0 | 1,
  range: ThreeDimensionalRange<SubspaceIdType>,
) {
  const [timestampRange, pathRange, subspaceRange] = range;

  if (isSensibleRange(orderTimestamps, timestampRange) === false) {
    return false;
  }

  if (isSensibleRange(orderBytes, pathRange) === false) {
    return false;
  }

  if (isSensibleRange(orderSubspace, subspaceRange) === false) {
    return false;
  }

  return true;
}

export function intersectRanges<ValueType>(
  order: (a: ValueType, b: ValueType) => -1 | 0 | 1,
  a: Range<ValueType>,
  b: Range<ValueType>,
): Range<ValueType> | null {
  if (!isSensibleRange(order, a) || !isSensibleRange(order, b)) {
    throw new Error("Non-sensible ranges given");
  }

  if (a.kind === "open" && b.kind === "open") {
    return {
      kind: "open",
      start: order(a.start, b.start) <= 0 ? b.start : a.start,
    };
  }

  if (a.kind === "open" && b.kind === "closed") {
    const aStartBStartOrder = order(a.start, b.start);
    const aStartBEndOrder = order(a.start, b.end);

    if (aStartBStartOrder <= 0) {
      return b;
    } else if (aStartBStartOrder > 0 && aStartBEndOrder < 0) {
      return {
        kind: "closed",
        start: a.start,
        end: b.end,
      };
    }

    return null;
  }

  if (b.kind === "open" && a.kind === "closed") {
    const bStartAStartOrder = order(b.start, a.start);
    const bStartAEndOrder = order(b.start, a.end);

    if (bStartAStartOrder <= 0) {
      return a;
    } else if (bStartAStartOrder > 0 && bStartAEndOrder < 0) {
      return {
        kind: "closed",
        start: b.start,
        end: a.end,
      };
    }

    return null;
  }

  if (a.kind === "closed" && b.kind === "closed") {
    // Find distinct ranges

    const min = order(a.start, b.start) < 0 ? a : b;
    const max = min === a ? b : a;

    if (order(min.end, max.start) < 0) {
      return null;
    }

    const end = min.end < max.end ? min.end : max.end;

    if (order(max.start, end) > -1) {
      return null;
    }

    return {
      kind: "closed",
      start: max.start,
      end: min.end < max.end ? min.end : max.end,
    };
  }

  return null;
}

export function intersect3dRanges<SubspaceIdType>(
  order: (
    a: SubspaceIdType,
    b: SubspaceIdType,
  ) => -1 | 0 | 1,
  a: ThreeDimensionalRange<SubspaceIdType>,
  b: ThreeDimensionalRange<SubspaceIdType>,
): ThreeDimensionalRange<SubspaceIdType> | null {
  const [timestampRangeA, pathRangeA, subspaceRangeA] = a;
  const [timestampRangeB, pathRangeB, subspaceRangeB] = b;

  const timestampIntersection = intersectRanges(
    orderTimestamps,
    timestampRangeA,
    timestampRangeB,
  );

  if (timestampIntersection === null) {
    return null;
  }

  const pathIntersection = intersectRanges(
    orderBytes,
    pathRangeA,
    pathRangeB,
  );

  if (pathIntersection === null) {
    return null;
  }

  const subspaceIntersection = intersectRanges(
    order,
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
  order: (a: ValueType, b: ValueType) => -1 | 0 | 1,
  a: Range<ValueType>,
  b: Range<ValueType>,
) {
  if (a.kind === "closed" && b.kind === "closed") {
    const startOrder = order(a.start, b.start);

    if (startOrder !== 0) {
      return false;
    }

    const endOrder = order(a.end, b.end);

    return endOrder === 0;
  } else if (a.kind === "open" && b.kind === "open") {
    const startOrder = order(a.start, b.start);

    return startOrder === 0;
  }

  return false;
}
