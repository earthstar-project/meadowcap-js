import { CanonicProduct, ThreeDimensionalProduct } from "../products/types.ts";

export type AccessMode = "read" | "write";

export type Capability<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
> =
  | SourceCap<
    NamespacePublicKey,
    SubspacePublicKey
  >
  | DelegationCap<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >
  | RestrictionCap<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >
  | MergeCap<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >;

export type SourceCap<NamespacePublicKey, SubspacePublicKey> = {
  kind: "source";
  namespaceId: NamespacePublicKey;
  subspaceId: SubspacePublicKey;
  accessMode: AccessMode;
};

export type DelegationCap<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
> = {
  kind: "delegation";
  parent: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >;
  delegee: AuthorPublicKey;
  authorisation: AuthorSignature;
  delegationLimit: number;
};

export type RestrictionCap<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
> = {
  kind: "restriction";
  parent: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >;
  product: ThreeDimensionalProduct<SubspacePublicKey>;
};

export type MergeCap<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
> = {
  kind: "merge";
  components: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >[];
};

export type IsCommunalFn<NamespacePublicKey> = (
  pubkey: NamespacePublicKey,
) => boolean;
