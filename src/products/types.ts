import { Range } from "../ranges/types.ts";

/** One of the dimensions of a product, containing many ranges. */
export type DisjointInterval<ValueType> = Array<Range<ValueType>>;

/** A product made of three disjoint ranges, representing timestamps, paths, and subspace IDs respectively. */
export type ThreeDimensionalProduct<SubspaceIdType> = [
  /** Timestamp disjoint range */
  DisjointInterval<Uint8Array>,
  /** Path disjoint range */
  DisjointInterval<Uint8Array>,
  /** Subspace ID disjoint range */
  DisjointInterval<SubspaceIdType>,
];

export type DimensionPairing =
  | "timestamp_path"
  | "timestamp_subspace"
  | "path_subspace";
