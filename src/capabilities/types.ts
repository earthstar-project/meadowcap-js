import { ThreeDimensionalProduct } from "../products/types.ts";

export type AccessMode = "read" | "write";

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

export type SourceCap<NamespacePublicKey, SubspacePublicKey> = {
  kind: "source";
  namespaceId: NamespacePublicKey;
  subspaceId: SubspacePublicKey;
  accessMode: AccessMode;
};

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
