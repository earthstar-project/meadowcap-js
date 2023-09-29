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
import {
  Sparse3dInterval,
  ThreeDimensionalInterval,
} from "../intervals/types.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import {
  addTo3dProduct,
  disjointIntervalIncludesValue,
  intersect3dProducts,
  merge3dProducts,
} from "../products/products.ts";
import {
  DisjointInterval,
  ThreeDimensionalProduct,
} from "../products/types.ts";
import { Entry, IMeadowcap, MeadowcapParams } from "./types.ts";

export class Meadowcap<
  NamespaceSeed,
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  SubspaceSeed,
  SubspacePublicKey,
  SubspaceSecretKey,
  SubspaceSignature,
  PayloadHash,
> implements
  IMeadowcap<
    NamespaceSeed,
    NamespacePublicKey,
    NamespaceSecretKey,
    NamespaceSignature,
    SubspaceSeed,
    SubspacePublicKey,
    SubspaceSecretKey,
    SubspaceSignature,
    PayloadHash
  > {
  constructor(
    readonly params: MeadowcapParams<
      NamespaceSeed,
      NamespacePublicKey,
      NamespaceSecretKey,
      NamespaceSignature,
      SubspaceSeed,
      SubspacePublicKey,
      SubspaceSecretKey,
      SubspaceSignature,
      PayloadHash
    >,
  ) {}

  async generateNamespaceKeyPair(
    seed: NamespaceSeed,
    communal: boolean,
  ): Promise<{ publicKey: NamespacePublicKey; secretKey: NamespaceSecretKey }> {
    let keypair = await this.params.namespaceKeypairScheme.signatureScheme
      .generateKeys(seed);

    while (communal && !this.params.isCommunalFn(keypair.publicKey)) {
      keypair = await this.params.namespaceKeypairScheme.signatureScheme
        .generateKeys(
          seed,
        );
    }

    return keypair;
  }

  generateSubspaceKeyPair(
    seed: SubspaceSeed,
  ): Promise<{ publicKey: SubspacePublicKey; secretKey: SubspaceSecretKey }> {
    return this.params.subspaceKeypairScheme.signatureScheme.generateKeys(seed);
  }

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
    // TODO: Warn if the result granted product produces no intersection.

    return {
      kind: "restriction",
      parent: parentCap,
      product: restrictionProduct,
    };
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
    >
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
      // TODO: Return some custom errors
    }

    return cap;
  }

  // SEMANTICS

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

  encodeCapability(
    cap: Capability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  ): Uint8Array {
    // TODO: Catch errors, return error types.

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

  decodeCapability(
    encodedCapability: Uint8Array,
  ): Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  > {
    // TODO: Catch errors, return error types.

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

  mergeProducts(
    ...products: ThreeDimensionalProduct<SubspacePublicKey>[]
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    return merge3dProducts({
      orderSubspace: this.params.orderSubspace,
    }, ...products);
  }

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

  addOpenRangeToProduct(
    openStarts: {
      subspace?: SubspacePublicKey | undefined;
      path?: Uint8Array | undefined;
      time?: bigint | undefined;
    },
    product?: ThreeDimensionalProduct<SubspacePublicKey>,
  ): ThreeDimensionalProduct<SubspacePublicKey> {
    const sparse: Sparse3dInterval<SubspacePublicKey> = [null, null, null];

    if (openStarts.subspace) {
      sparse[0] = { kind: "open", start: openStarts.subspace };
    }

    if (openStarts.path) {
      sparse[1] = { kind: "open", start: openStarts.path };
    }

    if (openStarts.time) {
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

  isAuthorisedWrite(
    entry: Entry<NamespacePublicKey, SubspacePublicKey, PayloadHash>,
    token: [
      Capability<
        NamespacePublicKey,
        NamespaceSignature,
        SubspacePublicKey,
        SubspaceSignature
      >,
      NamespaceSignature | SubspaceSignature,
    ],
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
