/** Defines a total order over a given set. */
export type TotalOrder<ValueType> = (a: ValueType, b: ValueType) => -1 | 0 | 1;
/** A function which returns the succeeding value for a given value of a set. */
export type SuccessorFn<ValueType> = (val: ValueType) => ValueType;
/** A function which returns the preceding. value for a given value of a set. */
export type PredecessorFn<ValueType> = (val: ValueType) => ValueType;
