import { concat } from "$std/bytes/concat.ts";
import {
  decodeCapability,
  encodeCapability,
} from "../capabilities/encoding.ts";
import {
  getAccessMode,
  getDelegationLimit,
  getGrantedProduct,
  getNamespace,
  getReceiver,
} from "../capabilities/semantics.ts";
import {
  AccessMode,
  Capability,
  DelegationCap,
  MergeCap,
  RestrictionCap,
  SourceCap,
} from "../capabilities/types.ts";
import { isSubspaceDelegee } from "../capabilities/util.ts";
import { isCapabilityValid } from "../capabilities/validity.ts";
import { Sparse3dInterval } from "../intervals/types.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import {
  addTo3dProduct,
  disjointIntervalIncludesValue,
  intersect3dProducts,
  merge3dProducts,
} from "../products/products.ts";
import { ThreeDimensionalProduct } from "../products/types.ts";
import { EncodingError, InvalidCapError } from "./errors.ts";
import {
  AuthorisationToken,
  Entry,
  IMeadowcap,
  MeadowcapParams,
} from "./types.ts";

/** A configured Meadowcap instance, capable of creating, signing, verifying, and encoding capabilities, and more! */
export class Meadowcap<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSecretKey,
  SubspaceSignature,
  PayloadHash,
> implements
  IMeadowcap<
    NamespacePublicKey,
    NamespaceSecretKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSecretKey,
    SubspaceSignature,
    PayloadHash
  > {
  constructor(
    readonly params: MeadowcapParams<
      NamespacePublicKey,
      NamespaceSecretKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSecretKey,
      SubspaceSignature,
      PayloadHash
    >,
  ) {}

  /** Create a source capability using a namespace key pair. */
  createSourceCap(
    accessMode: AccessMode,
    namespaceId: NamespacePublicKey,
    subspaceId: SubspacePublicKey,
  ): SourceCap<
    NamespacePublicKey,
    SubspacePublicKey
  > {
    return {
      kind: "source",
      accessMode,
      namespaceId,
      subspaceId: this.params.isCommunalFn(namespaceId)
        ? subspaceId
        : this.params.minimalSubspacePublicKey,
    };
  }

  /** Create a delegation capability from a capability for a communal namespace, delegated to a subspace public key, signed with a subspace secret key. */
  async createDelegateCapCommunal(
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
  > {
    const delegationLimit = getDelegationLimit(parentCap) - 1;

    const encodedParent = this.encodeCapability(parentCap);

    const hashedParent = await this.params.hashCapability(encodedParent);

    const isCommunal = this.params.isCommunalFn(getNamespace(parentCap));

    if (
      !isSubspaceDelegee<NamespacePublicKey, SubspacePublicKey>(
        delegee,
        isCommunal,
      )
    ) {
      throw new Error(
        "Cannot delegate a capability to a subspace pubkey for an owned namespace",
      );
    }

    const authorisation = await this.params.subspaceKeypairScheme
      .signatureScheme
      .sign(
        secretKey,
        hashedParent,
      );

    return {
      kind: "delegation",
      parent: parentCap,
      delegationLimit,
      delegee: delegee,
      authorisation,
    };
  }

  /** Create a delegation capability from a capability for an owned namespace, delegated to a namespace public key, signed with a namespace secret key. */
  async createDelegateCapOwned(
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
  > {
    const delegationLimit = getDelegationLimit(parentCap) - 1;

    const encodedParent = this.encodeCapability(parentCap);

    const hashedParent = await this.params.hashCapability(encodedParent);

    const isCommunal = this.params.isCommunalFn(getNamespace(parentCap));

    if (
      isSubspaceDelegee<NamespacePublicKey, SubspacePublicKey>(
        delegee,
        isCommunal,
      )
    ) {
      throw new Error(
        "Cannot delegate an capability to a namespace pubkey for a communal namespace",
      );
    }

    const authorisation = await this.params.namespaceKeypairScheme
      .signatureScheme
      .sign(
        secretKey,
        hashedParent,
      );

    return {
      kind: "delegation",
      parent: parentCap,
      delegationLimit,
      delegee: delegee,
      authorisation,
    };
  }

  /** Create a restriction capabality from a given capability and a product to restrict the parent's granted product with. */
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
  > {
    const cap: RestrictionCap<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    > = {
      kind: "restriction",
      parent: parentCap,
      product: restrictionProduct,
    };

    const grantedProduct = this.getCapabilityGrantedProduct(cap);

    if (
      grantedProduct[0].length === 0 || grantedProduct[1].length === 0 ||
      grantedProduct[2].length === 0
    ) {
      console.warn(
        "Restriction capability created granting an empty product.",
      );
    }

    return cap;
  }

  async createMergeCap(
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
  > {
    const cap = {
      kind: "merge",
      components: caps,
    } as MergeCap<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >;

    const isValid = await isCapabilityValid({
      namespaceScheme: this.params.namespaceKeypairScheme,
      subspaceScheme: this.params.subspaceKeypairScheme,
      successorSubspace: this.params.successorSubspace,
      encodePathLength: this.params.encodePathLength,
      hashCapability: this.params.hashCapability,
      isCommunalFn: this.params.isCommunalFn,
      isInclusiveSmallerSubspace: this.params.isInclusiveSmallerSubspace,
      minimalSubspaceKey: this.params.minimalSubspacePublicKey,
      orderSubspace: this.params.orderSubspace,
      predecessorSubspace: this.params.predecessorSubspace,
    }, cap);

    if (!isValid) {
      return new InvalidCapError(
        "Produced invalid merge capability. Ensure all components have the same access mode, receiver, and namespace, and that all granted products are pairwise mergeable.",
      );
    }

    return cap;
  }

  // SEMANTICS

  /** Whether a namespace is communal or not based on its public key. */
  isCommunal(namespace: NamespacePublicKey): boolean {
    return this.params.isCommunalFn(namespace);
  }

  /** Gets the receiver of a given capability. */
  getCapabilityReceiver(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): NamespacePublicKey | SubspacePublicKey {
    return getReceiver(cap, this.params.isCommunalFn);
  }

  getCapabilityAccessMode(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): AccessMode {
    return getAccessMode(cap);
  }

  getCapabilityNamespace(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): NamespacePublicKey {
    return getNamespace(cap);
  }

  getCapabilityGrantedProduct(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    return getGrantedProduct({
      isCommunalFn: this.params.isCommunalFn,
      minimalSubspaceKey: this.params.minimalSubspacePublicKey,
      orderSubspace: this.params.orderSubspace,
      successorSubspace: this.params.successorSubspace,
    }, cap);
  }

  getCapabilityDelegationLimit(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): number {
    return getDelegationLimit(cap);
  }

  // VALIDITY

  isCapabilityValid(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): Promise<boolean> {
    return isCapabilityValid({
      namespaceScheme: this.params.namespaceKeypairScheme,
      subspaceScheme: this.params.subspaceKeypairScheme,
      encodePathLength: this.params.encodePathLength,
      hashCapability: this.params.hashCapability,
      isCommunalFn: this.params.isCommunalFn,
      isInclusiveSmallerSubspace: this.params.isInclusiveSmallerSubspace,
      minimalSubspaceKey: this.params.minimalSubspacePublicKey,
      orderSubspace: this.params.orderSubspace,
      predecessorSubspace: this.params.predecessorSubspace,
      successorSubspace: this.params.successorSubspace,
    }, cap);
  }

  // ENCODING

  /** Encodes a capability.
   *
   * The encoding _can_ be used for transporting capabilities, but is usually used for signing.
   */
  encodeCapability(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): Uint8Array {
    return encodeCapability({
      isCommunalFn: this.params.isCommunalFn,
      isInclusiveSmallerSubspace: this.params.isInclusiveSmallerSubspace,
      orderSubspace: this.params.orderSubspace,
      predecessorSubspace: this.params.predecessorSubspace,
      encodePathLength: this.params.encodePathLength,
      namespaceEncodingScheme:
        this.params.namespaceKeypairScheme.encodingScheme,
      subspaceEncodingScheme: this.params.subspaceKeypairScheme.encodingScheme,
    }, cap);
  }

  /** Decodes a capability
   *
   * _Can_ be used to decode capabilities received from others, but this really exists here as a courtesy.
   */
  decodeCapability(
    encodedCapability: Uint8Array,
  ): Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  > {
    return decodeCapability({
      namespaceEncodingScheme:
        this.params.namespaceKeypairScheme.encodingScheme,
      subspaceEncodingScheme: this.params.subspaceKeypairScheme.encodingScheme,
      isCommunalFn: this.params.isCommunalFn,
      orderSubspace: this.params.orderSubspace,
      predecessorSubspace: this.params.predecessorSubspace,
      successorSubspace: this.params.successorSubspace,
      minimalSubspaceKey: this.params.minimalSubspacePublicKey,
      decodePathLength: this.params.decodePathLength,
      isInclusiveSmallerSubspace: this.params.isInclusiveSmallerSubspace,
      maxPathLength: this.params.maxPathLength,
      pathBitIntLength: this.params.pathBitIntLength,
    }, encodedCapability).capability;
  }

  // PRODUCTS

  /** Merge a set of three dimensional products. Returns an empty product if the set is not pairwise mergeable. */
  mergeProducts(
    ...products: ThreeDimensionalProduct<SubspacePublicKey>[]
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    return merge3dProducts({
      orderSubspace: this.params.orderSubspace,
    }, ...products);
  }

  /** Intersect a set of three dimensional products. Returns an empty product if the intersection of _any_ dimension is empty. */
  intersectProducts(
    ...products: ThreeDimensionalProduct<SubspacePublicKey>[]
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    let intersectedProducts = products[0];

    for (let i = 1; i < products.length; i++) {
      intersectedProducts = intersect3dProducts(
        {
          orderSubspace: this.params.orderSubspace,
        },
        intersectedProducts,
        products[i],
      );
    }

    return intersectedProducts;
  }

  /** Add open ranges for the subspace / path / time dimensions to a given product.
   *
   * If no existing product is provided, adds the open ranges to a new empty product.
   */
  addOpenRangeToProduct(
    openStarts: {
      subspace?: SubspacePublicKey | undefined;
      path?: Uint8Array | undefined;
      time?: bigint | undefined;
    },
    product?: ThreeDimensionalProduct<SubspacePublicKey>,
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    const sparse: Sparse3dInterval<SubspacePublicKey> = [null, null, null];

    if (openStarts.subspace !== undefined) {
      sparse[0] = { kind: "open", start: openStarts.subspace };
    }

    if (openStarts.path !== undefined) {
      sparse[1] = { kind: "open", start: openStarts.path };
    }

    if (openStarts.time !== undefined) {
      sparse[2] = { kind: "open", start: openStarts.time };
    }

    return addTo3dProduct(
      {
        orderSubspace: this.params.orderSubspace,
        shouldThrow: false,
      },
      sparse,
      product ? product : [[], [], []],
    );
  }

  /** Add closed ranges for the subspace / path / time dimensions to a given product.
   *
   * If no existing product is provided, adds the open ranges to a new empty product.
   */
  addClosedRangeToProduct(
    ranges: {
      subspace?: [SubspacePublicKey, SubspacePublicKey] | undefined;
      path?: [Uint8Array, Uint8Array] | undefined;
      time?: [bigint, bigint] | undefined;
    },
    product?: ThreeDimensionalProduct<SubspacePublicKey> | undefined,
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    const sparse: Sparse3dInterval<SubspacePublicKey> = [null, null, null];

    if (ranges.subspace) {
      sparse[0] = {
        kind: "closed_exclusive",
        start: ranges.subspace[0],
        end: ranges.subspace[1],
      };
    }

    if (ranges.path) {
      sparse[1] = {
        kind: "closed_exclusive",
        start: ranges.path[0],
        end: ranges.path[1],
      };
    }

    if (ranges.time) {
      sparse[2] = {
        kind: "closed_exclusive",
        start: ranges.time[0],
        end: ranges.time[1],
      };
    }

    return addTo3dProduct(
      {
        orderSubspace: this.params.orderSubspace,
        shouldThrow: false,
      },
      sparse,
      product ? product : [[], [], []],
    );
  }

  /** Add an interval including a single value for the subspace / path / time dimensions to a given product.
   *
   * If no existing product is provided, adds the open ranges to a new empty product.
   */
  addSingleValueToProduct(
    values: {
      subspace?: SubspacePublicKey | undefined;
      path?: Uint8Array | undefined;
      time?: bigint | undefined;
    },
    product?: ThreeDimensionalProduct<SubspacePublicKey> | undefined,
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    const sparse: Sparse3dInterval<SubspacePublicKey> = [null, null, null];

    if (values.subspace) {
      sparse[0] = {
        kind: "closed_exclusive",
        start: values.subspace,
        end: this.params.successorSubspace(values.subspace),
      };
    }

    if (values.path) {
      sparse[1] = {
        kind: "closed_exclusive",
        start: values.path,
        end: makeSuccessorPath(this.params.maxPathLength)(values.path),
      };
    }

    if (values.time) {
      sparse[2] = {
        kind: "closed_exclusive",
        start: values.time,
        end: successorTimestamp(values.time),
      };
    }

    return addTo3dProduct(
      {
        orderSubspace: this.params.orderSubspace,
        shouldThrow: false,
      },
      sparse,
      product ? product : [[], [], []],
    );
  }

  // Authorising writes

  /** Create a verifiable authorisation token for an entry and capability to which you have the corresponding secret key for. */
  async createAuthorisationToken(
    entry: Entry<NamespacePublicKey, SubspacePublicKey, PayloadHash>,
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
    secretKey: NamespaceSecretKey | SubspaceSecretKey,
  ): Promise<
    AuthorisationToken<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >
  > {
    const timestampBytes = new Uint8Array(8);
    const timestampView = new DataView(timestampBytes.buffer);
    timestampView.setBigUint64(0, entry.record.timestamp);

    const lengthBytes = new Uint8Array(8);
    const lengthView = new DataView(lengthBytes.buffer);
    lengthView.setBigUint64(0, entry.record.length);

    const encodedEntry = concat(
      this.params.namespaceKeypairScheme.encodingScheme.publicKey.encode(
        entry.identifier.namespace,
      ),
      this.params.subspaceKeypairScheme.encodingScheme.publicKey.encode(
        entry.identifier.subspace,
      ),
      this.params.encodePathLength(entry.identifier.path.byteLength),
      entry.identifier.path,
      timestampBytes,
      lengthBytes,
      this.params.encodePayloadHash(entry.record.hash),
    );

    const namespace = getNamespace(cap);

    if (this.params.isCommunalFn(namespace)) {
      const signature = await this.params.subspaceKeypairScheme.signatureScheme
        .sign(
          secretKey as SubspaceSecretKey,
          encodedEntry,
        );

      return [cap, signature];
    }

    const signature = await this.params.namespaceKeypairScheme.signatureScheme
      .sign(
        secretKey as NamespaceSecretKey,
        encodedEntry,
      );

    return [cap, signature];
  }

  /** Used by Willow to determine whether entries are valid, i.e., to implement write-access control. */
  isAuthorisedWrite(
    entry: Entry<NamespacePublicKey, SubspacePublicKey, PayloadHash>,
    token: AuthorisationToken<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): Promise<boolean> {
    const [cap, signature] = token;

    // The access mode must be 'write'.
    if (getAccessMode(cap) !== "write") {
      return Promise.resolve(false);
    }

    // The cap's granted product must include the entry's path and timestamp.
    const grantedProduct = getGrantedProduct({
      isCommunalFn: this.params.isCommunalFn,
      minimalSubspaceKey: this.params.minimalSubspacePublicKey,
      orderSubspace: this.params.orderSubspace,
      successorSubspace: this.params.successorSubspace,
    }, cap);

    if (
      disjointIntervalIncludesValue(
        { order: orderPaths },
        grantedProduct[1],
        entry.identifier.path,
      ) === false
    ) {
      return Promise.resolve(false);
    }

    if (
      disjointIntervalIncludesValue(
        { order: orderTimestamps },
        grantedProduct[2],
        entry.record.timestamp,
      ) === false
    ) {
      return Promise.resolve(false);
    }

    // The signature must be authentic.

    const receiver = getReceiver(cap, this.params.isCommunalFn);

    const timestampBytes = new Uint8Array(8);
    const timestampView = new DataView(timestampBytes.buffer);
    timestampView.setBigUint64(0, entry.record.timestamp);

    const lengthBytes = new Uint8Array(8);
    const lengthView = new DataView(lengthBytes.buffer);
    lengthView.setBigUint64(0, entry.record.length);

    const encodedEntry = concat(
      this.params.namespaceKeypairScheme.encodingScheme.publicKey.encode(
        entry.identifier.namespace,
      ),
      this.params.subspaceKeypairScheme.encodingScheme.publicKey.encode(
        entry.identifier.subspace,
      ),
      this.params.encodePathLength(entry.identifier.path.byteLength),
      entry.identifier.path,
      timestampBytes,
      lengthBytes,
      this.params.encodePayloadHash(entry.record.hash),
    );

    if (this.params.isCommunalFn(entry.identifier.namespace)) {
      return this.params.subspaceKeypairScheme.signatureScheme.verify(
        receiver as SubspacePublicKey,
        signature as SubspaceSignature,
        encodedEntry,
      );
    }

    return this.params.namespaceKeypairScheme.signatureScheme.verify(
      receiver as NamespacePublicKey,
      signature as NamespaceSignature,
      encodedEntry,
    );
  }
}
