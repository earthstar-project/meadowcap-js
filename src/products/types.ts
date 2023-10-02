import { Interval } from "../intervals/types.ts";
import { Range } from "../ranges/types.ts";

/** One of the dimensions of a product, containing many intervals. */
export type DisjointInterval<ValueType> = Array<Interval<ValueType>>;

/** One of the canonically represented dimensions of a product, containing many ranges. */
export type DisjointRange<ValueType> = Array<Range<ValueType>>;

/** A product made of three disjoint intervals, representing subspaces, paths, and timestamps respectively.
 *
 * The intervals of this type are canonically represented as much as they can be, that is none of the intervals in each dimension are adjacent or overlap.
 */
export type ThreeDimensionalProduct<SubspaceIdType> = [
  /** Subspace ID disjoint interval */
  DisjointInterval<SubspaceIdType>,
  /** Path disjoint interval */
  DisjointInterval<Uint8Array>,
  /** Timestamp disjoint interval */
  DisjointInterval<bigint>,
];

/** A canonically represented product made of three disjoint ranges, representing subspaces, paths, and timestamps respectively.
 *
 * In addition to the canonic guarantees of a `ThreeDimensionalProduct`, this type also guarantees that closed ranges are of the canonic type, depending on encoding size and dimension.
 */
export type CanonicProduct<SubspaceIdType> = [
  /** Subspace ID disjoint interval */
  DisjointRange<SubspaceIdType>,
  /** Path disjoint interval */
  DisjointRange<Uint8Array>,
  /** Timestamp disjoint interval */
  DisjointRange<bigint>,
];

// This is used as an option for a function where we want to say which two dimensions match in a given product.
export type DimensionPairing =
  | "timestamp_path"
  | "timestamp_subspace"
  | "path_subspace";
