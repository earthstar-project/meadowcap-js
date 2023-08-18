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
