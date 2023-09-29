import {
  AccessMode,
  Capability,
  DelegationCap,
  MergeCap,
  RestrictionCap,
  SourceCap,
} from "../capabilities/types.ts";

import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import { ThreeDimensionalProduct } from "../products/types.ts";

export type MeadowcapParams<
  NamespaceSeed,
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  SubspaceSeed,
  SubspacePublicKey,
  SubspaceSecretKey,
  SubspaceSignature,
  PayloadDigest,
> = {
  namespaceKeypairScheme: KeypairScheme<
    NamespaceSeed,
    NamespacePublicKey,
    NamespaceSecretKey,
    NamespaceSignature
  >;
  subspaceKeypairScheme: KeypairScheme<
    SubspaceSeed,
    SubspacePublicKey,
    SubspaceSecretKey,
    SubspaceSignature
  >;

  isCommunalFn: IsCommunalFn<NamespacePublicKey>;

  minimalSubspacePublicKey: SubspacePublicKey;
  orderSubspace: TotalOrder<SubspacePublicKey>;
  predecessorSubspace: PredecessorFn<SubspacePublicKey>;
  successorSubspace: SuccessorFn<SubspacePublicKey>;
  isInclusiveSmallerSubspace: (
    incl: SubspacePublicKey,
    excl: SubspacePublicKey,
  ) => boolean;

  encodePathLength: (length: number) => Uint8Array;
  decodePathLength: (encoded: Uint8Array) => number;
  maxPathLength: number;
  pathBitIntLength: number;

  hashCapability: (bytestring: Uint8Array) => Promise<Uint8Array>;
  encodePayloadHash: (hash: PayloadDigest) => Uint8Array;
};

export interface IMeadowcap<
  NamespaceSeed,
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  SubspaceSeed,
  SubspacePublicKey,
  SubspaceSecretKey,
  SubspaceSignature,
  PayloadDigest,
> {
  // KEYPAIRS

  generateNamespaceKeyPair(seed: NamespaceSeed, communal: boolean): {
    publicKey: NamespacePublicKey;
    secretKey: NamespaceSecretKey;
  };

  generateSubspaceKeyPair(seed: SubspaceSeed): {
    publicKey: SubspacePublicKey;
    secretKey: SubspaceSecretKey;
  };

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
    >
  >;

  // SEMANTICS

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
    token: [
      Capability<
        NamespacePublicKey,
        NamespaceSignature,
        SubspacePublicKey,
        SubspaceSignature
      >,
      NamespaceSignature | SubspaceSignature,
    ],
  ): boolean;
}

export type IsCommunalFn<NamespacePublicKey> = (
  pubkey: NamespacePublicKey,
) => boolean;

export type EncodingScheme<ValueType> = {
  encode(value: ValueType): Uint8Array;
  decode(encoded: Uint8Array): ValueType;
  encodedLength(value: ValueType): number;
};

export type KeypairEncodingScheme<PublicKey, Signature> = {
  publicKey: EncodingScheme<PublicKey>;
  signature: EncodingScheme<Signature>;
};

export type SignatureScheme<Seed, PublicKey, SecretKey, Signature> = {
  generateSeed: () => Seed;
  generateKeys: (seed: Seed) => { publicKey: PublicKey; secretKey: SecretKey };
  sign: (secretKey: SecretKey, bytestring: Uint8Array) => Signature;
  verify: (
    publicKey: PublicKey,
    signature: Signature,
    bytestring: Uint8Array,
  ) => boolean;
};

export type KeypairScheme<Seed, PublicKey, SecretKey, Signature> = {
  signatureScheme: SignatureScheme<Seed, PublicKey, SecretKey, Signature>;
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
