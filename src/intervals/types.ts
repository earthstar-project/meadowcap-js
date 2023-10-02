/** A set of values that can be respersented by a single `Range`. */
/*
Also a subset of the types `Range` offers. So why do we have this?
In this codebase, intervals are used during operations which modify the included values of any given disjoint interval,
such as intersection, merging, etc.

They are then converted to ranges when we want to create a canonic representation for encoding.
*/
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

// For end-user facing API, so someone can specify dimensions of an interval without needing to define them all.
export type Sparse3dInterval<SubspaceIdType> = [
  /** Subspace */
  Interval<SubspaceIdType> | null,
  /** Path */
  Interval<Uint8Array> | null,
  /** Time */
  Interval<bigint> | null,
];

/** The order of the different types of interval, ordered by desirability in canonic representation */
export enum IntervalOrder {
  open,
  closed_exclusive,
}
