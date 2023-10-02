import { ThreeDimensionalProduct } from "../products/types.ts";

/** The type of access a capability grants. */
export type AccessMode = "read" | "write";

/** An unforgeable token bestowing read or write access to some data to a particular person, issued by the owner of that data. */
export type Capability<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
> =
  | SourceCap<
    NamespacePublicKey,
    SubspacePublicKey
  >
  | DelegationCap<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature,
    NamespacePublicKey,
    NamespaceSignature
  >
  | DelegationCap<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >
  | RestrictionCap<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >
  | MergeCap<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >;

/** A capability from which the authority of a namespace (or subspace, if the namespace is communal) is derived. */
export type SourceCap<NamespacePublicKey, SubspacePublicKey> = {
  kind: "source";
  namespaceId: NamespacePublicKey;
  subspaceId: SubspacePublicKey;
  accessMode: AccessMode;
};

/** A capability proving that an existing capability has been delegated to a specific author keypair. */
export type DelegationCap<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
  AuthorPublicKey,
  AuthorSignature,
> = {
  kind: "delegation";
  parent: Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >;
  delegee: AuthorPublicKey;
  authorisation: AuthorSignature;
  delegationLimit: number;
};

/** A capability which restricts the granted product of an existing capability. */
export type RestrictionCap<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
> = {
  kind: "restriction";
  parent: Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >;
  product: ThreeDimensionalProduct<SubspacePublicKey>;
};

/** A capability which merges the granted products of many similar capabilities. */
export type MergeCap<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
> = {
  kind: "merge";
  components: Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >[];
};
