import {
  PredecessorFn,
  SuccessorFn,
  ThreeDimensionalProduct,
  TotalOrder,
} from "../../deps.ts";
import {
  AccessMode,
  Capability,
  DelegationCap,
  MergeCap,
  RestrictionCap,
  SourceCap,
} from "../capabilities/types.ts";

import { InvalidCapError } from "./errors.ts";

// Yes. It's a lot.
export type MeadowcapParams<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSecretKey,
  SubspaceSignature,
  PayloadDigest,
> = {
  /** The keypair signature and encoding scheme for namespace key pairs. Used when a namespace is owned.
   *
   * Must be the same namespace scheme used by Willow.
   */
  namespaceKeypairScheme: KeypairScheme<
    NamespacePublicKey,
    NamespaceSecretKey,
    NamespaceSignature
  >;
  /** The keypair signature and encoding scheme for namespace key pairs. Used when a namespace is communal.
   *
   * Must be the same subspace scheme used by Willow.
   * This will usually be the same as the namespace key pair scheme, but if you use a trivial scheme here then you can effectively remove the notion of subspaces from Willow and Meadowcap.
   */
  subspaceKeypairScheme: KeypairScheme<
    SubspacePublicKey,
    SubspaceSecretKey,
    SubspaceSignature
  >;

  pathLengthScheme: EncodingScheme<number> & {
    maxLength: number;
  };

  /** A function which determines whether a namespace is communal or not given its public key.*/
  isCommunalFn: IsCommunalFn<NamespacePublicKey>;

  /** The least possible subspace public key. */
  minimalSubspacePublicKey: SubspacePublicKey;
  /** A total order over the set of subspace public keys. */
  orderSubspace: TotalOrder<SubspacePublicKey>;
  /** A function returning the preceding value of any given subspace. */
  predecessorSubspace: PredecessorFn<SubspacePublicKey>;
  /** A function returning the succeeding value of any given subspace. */
  successorSubspace: SuccessorFn<SubspacePublicKey>;
  /** A function which determines whether a value used in an inclusive range will have a shorter encoding than a value used in an exclusive range. */
  isInclusiveSmallerSubspace: (
    incl: SubspacePublicKey,
    excl: SubspacePublicKey,
  ) => boolean;

  /** A hash function to use with encoded capabilities. */
  hashCapability: (bytestring: Uint8Array) => Promise<Uint8Array>;
  /** The same function used by Willow to encode payload digests. */
  encodePayloadHash: (hash: PayloadDigest) => Uint8Array;
};

export interface IMeadowcap<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSecretKey,
  SubspaceSignature,
  PayloadDigest,
> {
  // CAPABILITIES

  // Source capability

  createSourceCap(
    accessMode: AccessMode,
    namespace: NamespacePublicKey,
    subspace: SubspacePublicKey,
  ): SourceCap<
    NamespacePublicKey,
    SubspacePublicKey
  >;

  // Delegation capability
  createDelegateCapCommunal(
    parentCap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
    delegee: SubspacePublicKey,
    secretKey: SubspaceSecretKey,
  ): Promise<
    DelegationCap<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >
  >;

  createDelegateCapOwned(
    parentCap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
    delegee: NamespacePublicKey,
    secretKey: NamespaceSecretKey,
  ): Promise<
    DelegationCap<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature,
      NamespacePublicKey,
      NamespaceSignature
    >
  >;

  // Restriction capability

  createRestrictionCap(
    parentCap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
    restrictionProduct: ThreeDimensionalProduct<SubspacePublicKey>,
  ): RestrictionCap<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >;

  // Merge capabality

  createMergeCap(
    ...caps: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >[]
  ): Promise<
    MergeCap<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    > | InvalidCapError
  >;

  // SEMANTICS

  isCommunal(namespace: NamespacePublicKey): boolean;

  getCapabilityReceiver(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): NamespacePublicKey | SubspacePublicKey;

  getCapabilityAccessMode(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): AccessMode;

  getCapabilityNamespace(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): NamespacePublicKey;

  getCapabilityGrantedProduct(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): ThreeDimensionalProduct<SubspacePublicKey>;

  getCapabilityDelegationLimit(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): number;

  // VALIDITY

  isCapabilityValid(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): Promise<boolean>;

  // ENCODING

  encodeCapability(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): Uint8Array;

  decodeCapability(
    encoded: Uint8Array,
  ): Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >;

  // PRODUCTS

  mergeProducts(
    ...products: ThreeDimensionalProduct<SubspacePublicKey>[]
  ): ThreeDimensionalProduct<SubspacePublicKey>;

  intersectProducts(
    ...products: ThreeDimensionalProduct<SubspacePublicKey>[]
  ): ThreeDimensionalProduct<SubspacePublicKey>;

  addOpenRangeToProduct(
    openStarts: {
      subspace?: SubspacePublicKey;
      path?: Uint8Array;
      time?: bigint;
    },
    product?: ThreeDimensionalProduct<SubspacePublicKey>,
  ): ThreeDimensionalProduct<SubspacePublicKey>;

  addClosedRangeToProduct(
    ranges: {
      subspace?: [SubspacePublicKey, SubspacePublicKey];
      path?: [Uint8Array, Uint8Array];
      time?: [bigint, bigint];
    },
    product?: ThreeDimensionalProduct<SubspacePublicKey>,
  ): ThreeDimensionalProduct<SubspacePublicKey>;

  addSingleValueToProduct(
    values: {
      subspace?: SubspacePublicKey;
      path?: Uint8Array;
      time?: bigint;
    },
    product?: ThreeDimensionalProduct<SubspacePublicKey>,
  ): ThreeDimensionalProduct<SubspacePublicKey>;

  // Authorised write

  isAuthorisedWrite(
    entry: Entry<NamespacePublicKey, SubspacePublicKey, PayloadDigest>,
    token: AuthorisationToken<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): Promise<boolean>;
}

/** A function which determines whether a namespace is communal or not using its public key. */
export type IsCommunalFn<NamespacePublicKey> = (
  pubkey: NamespacePublicKey,
) => boolean;

export type EncodingScheme<ValueType> = {
  /** A function to encode a given `ValueType`. */
  encode(value: ValueType): Uint8Array;
  /** A function to decode a given `ValueType` */
  decode(encoded: Uint8Array): ValueType;
  /** A function which returns the bytelength for a given `ValueType` when encoded. */
  encodedLength(value: ValueType): number;
};

export type KeypairEncodingScheme<PublicKey, Signature> = {
  /** The encoding scheme for a key pair's public key type. */
  publicKey: EncodingScheme<PublicKey>;
  /** The encoding scheme for a key pair's signature type. */
  signature: EncodingScheme<Signature>;
};

/** A scheme for signing and verifying data using key pairs. */
export type SignatureScheme<PublicKey, SecretKey, Signature> = {
  sign: (secretKey: SecretKey, bytestring: Uint8Array) => Promise<Signature>;
  verify: (
    publicKey: PublicKey,
    signature: Signature,
    bytestring: Uint8Array,
  ) => Promise<boolean>;
};

export type KeypairScheme<PublicKey, SecretKey, Signature> = {
  signatureScheme: SignatureScheme<PublicKey, SecretKey, Signature>;
  encodingScheme: KeypairEncodingScheme<PublicKey, Signature>;
};

// Willow

export type RecordIdentifier<NamespacePublicKey, SubspacePublicKey> = {
  /** The namespace's public key as a fixed-width integer */
  namespace: NamespacePublicKey;
  /** The author's public key as a fixed-width integer*/
  subspace: SubspacePublicKey;
  /** Bit string of length at most 2048 */
  path: Uint8Array;
};

export type Record<PayloadDigest> = {
  /** 64 bit integer (interpreted as microseconds since the Unix epoch). Big-endian. */
  timestamp: bigint;
  /** 64 bit integer */
  length: bigint;
  /** digest-length bit integer*/
  hash: PayloadDigest;
};

export type Entry<NamespacePublicKey, SubspacePublicKey, PayloadDigest> = {
  identifier: RecordIdentifier<NamespacePublicKey, SubspacePublicKey>;
  record: Record<PayloadDigest>;
};

/** A valid capability and an accompanying signature. */
export type AuthorisationToken<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
> = [
  Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >,
  NamespaceSignature | SubspaceSignature,
];
