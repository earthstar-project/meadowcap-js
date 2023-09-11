/**
A range is either closed, consisting of a start value and an end value, or it is open, consisting only of a start value.

A closed range includes all values greater than or equal to the start value and strictly less than the end value. An open range includes all values greater than or equal to the start value.
*/
export type Range<ValueType> = {
  kind: "open";
  start: ValueType;
} | {
  kind: "closed_exclusive";
  start: ValueType;
  end: ValueType;
} | {
  kind: "closed_inclusive";
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

/** The order of the different types of range, ordered by desirability in canonic representation */
export enum RangeOrder {
  open,
  closed_exclusive,
  closed_inclusive,
}
