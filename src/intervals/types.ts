export type Interval<ValueType> = {
  kind: "open";
  start: ValueType;
} | {
  kind: "closed_exclusive";
  start: ValueType;
  end: ValueType;
};

export type ThreeDimensionalInterval<SubspaceIdType> = [
  /** Subspace */
  Interval<SubspaceIdType>,
  /** Path */
  Interval<Uint8Array>,
  /** Time */
  Interval<bigint>,
];

export type Sparse3dInterval<SubspaceIdType> = [
  /** Subspace */
  Interval<SubspaceIdType> | null,
  /** Path */
  Interval<Uint8Array> | null,
  /** Time */
  Interval<bigint> | null,
];

/** The order of the different types of range, ordered by desirability in canonic representation */
export enum IntervalOrder {
  open,
  closed_exclusive,
}
