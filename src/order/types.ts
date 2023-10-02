export type TotalOrder<ValueType> = (a: ValueType, b: ValueType) => -1 | 0 | 1;
export type SuccessorFn<ValueType> = (val: ValueType) => ValueType;
export type PredecessorFn<ValueType> = (val: ValueType) => ValueType;
