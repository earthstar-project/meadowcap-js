import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import {
  addRangeToDisjointInterval,
  canonicProduct,
  decanoniciseProduct,
  hasOpenRange,
} from "../products/products.ts";
import { CanonicProduct, DisjointInterval } from "../products/types.ts";
import { chunk } from "$std/collections/chunk.ts";
import { concat } from "$std/bytes/concat.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { Capability } from "./types.ts";
import { getAccessMode, getNamespace } from "./semantics.ts";
import { Range } from "../ranges/types.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";
import {
  EncodingScheme,
  IsCommunalFn,
  KeypairEncodingScheme,
} from "../meadowcap/types.ts";
import { isCommunalDelegationCap } from "./util.ts";

/** Encode a capability.
 *
 * This encoding _can_ be used for transporting capabilities, but is really here for signing.
 *
 * This function doesn't check for the validity of a capability, but will throw if a restriction capability's product is not canonic.
 */
export function encodeCapability<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
>(
  config: {
    isCommunalFn: IsCommunalFn<NamespacePublicKey>;
    orderSubspace: TotalOrder<SubspacePublicKey>;
    encodePathLength: (num: number) => Uint8Array;
    namespaceEncodingScheme: KeypairEncodingScheme<
      NamespacePublicKey,
      NamespaceSignature
    >;
    subspaceEncodingScheme: KeypairEncodingScheme<
      SubspacePublicKey,
      SubspaceSignature
    >;
    isInclusiveSmallerSubspace: (
      incl: SubspacePublicKey,
      excl: SubspacePublicKey,
    ) => boolean;
    predecessorSubspace: PredecessorFn<SubspacePublicKey>;
  },
  cap: Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >,
): Uint8Array {
  // read / write type byte
  let readWriteTypeBits = 0;

  const accessMode = getAccessMode(cap);

  if (accessMode === "write") {
    readWriteTypeBits |= 1 << 7;
  }

  switch (cap.kind) {
    case "source":
      readWriteTypeBits |= 0x7f;
      break;
    case "delegation":
      readWriteTypeBits |= 0x7e;
      break;
    case "restriction":
      readWriteTypeBits |= 0x7d;
      break;
    case "merge": {
      if (cap.components.length < 123) {
        readWriteTypeBits |= cap.components.length - 2;
      } else if (cap.components.length < 256) {
        readWriteTypeBits |= 0x79;
      } else if (cap.components.length < 65536) {
        readWriteTypeBits |= 0x7a;
      } else if (cap.components.length < 4294967296) {
        readWriteTypeBits |= 0x7b;
      } else {
        readWriteTypeBits |= 0x7c;
      }
    }
  }

  // namespace id

  const namespace = getNamespace(cap);

  const encodedNamespace = config.namespaceEncodingScheme.publicKey.encode(
    namespace,
  );

  // switch on cap type...

  let encodedCapability = new Uint8Array();

  switch (cap.kind) {
    case "source": {
      if (config.isCommunalFn(namespace)) {
        encodedCapability = config.subspaceEncodingScheme.publicKey.encode(
          cap.subspaceId,
        );
      }
      break;
    }
    case "delegation": {
      const isCommunal = isCommunalDelegationCap(cap, config.isCommunalFn);

      const encDelegee = isCommunal
        ? config.subspaceEncodingScheme.publicKey.encode(cap.delegee)
        : config.namespaceEncodingScheme.publicKey.encode(cap.delegee);

      const encAuthorisation = isCommunal
        ? config.subspaceEncodingScheme.signature.encode(cap.authorisation)
        : config.namespaceEncodingScheme.signature.encode(cap.authorisation);

      // Cap being delegated
      // Delegation limit
      // Encoded delegee public key
      // Encoded signature of delegator
      encodedCapability = concat(
        encodeCapability(config, cap.parent),
        new Uint8Array([cap.delegationLimit]),
        encDelegee,
        encAuthorisation,
      );
      break;
    }
    case "restriction": {
      const restrictionProduct = canonicProduct({
        predecessorSubspace: config.predecessorSubspace,
        isInclusiveSmallerSubspace: config.isInclusiveSmallerSubspace,
      }, cap.product);

      // Cap being restricted
      // Restriction product
      encodedCapability = concat(
        encodeCapability(config, cap.parent),
        encodeProduct({
          ...config,
          encodeSubspacePublicKey:
            config.subspaceEncodingScheme.publicKey.encode,
        }, restrictionProduct),
      );
      break;
    }
    case "merge": {
      let componentLenEncoded = new Uint8Array();

      if (cap.components.length < 123) {
        // Don't include component length, it's already in the capability type header.
      } else if (cap.components.length < 256) {
        // Include component length as 8 bit unsigned integer.
        componentLenEncoded = new Uint8Array([cap.components.length]);
      } else if (cap.components.length < 65536) {
        // Include component length as 16 bit unsigned integer.
        componentLenEncoded = new Uint8Array(2);
        const view = new DataView(componentLenEncoded.buffer);
        view.setUint16(0, cap.components.length);
      } else if (cap.components.length < 4294967296) {
        // Include component length as 32 bit unsigned integer.
        componentLenEncoded = new Uint8Array(4);
        const view = new DataView(componentLenEncoded.buffer);
        view.setUint32(0, cap.components.length);
      } else {
        // Include component length as 64 bit unsigned integer.
        componentLenEncoded = new Uint8Array(8);
        const view = new DataView(componentLenEncoded.buffer);
        view.setBigUint64(0, BigInt(cap.components.length));
      }

      const encodedComponents: Uint8Array[] = [];

      for (const component of cap.components) {
        encodedComponents.push(
          encodeCapability(config, component),
        );
      }

      encodedCapability = concat(componentLenEncoded, ...encodedComponents);
    }
  }

  return concat(
    new Uint8Array([readWriteTypeBits]),
    encodedNamespace,
    encodedCapability,
  );
}

// You _can_ use this to pull out a capability from an encoding, but this function is mostly used for testing purposes.
export function decodeCapability<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
>(
  config: {
    isCommunalFn: IsCommunalFn<NamespacePublicKey>;

    minimalSubspaceKey: SubspacePublicKey;
    orderSubspace: TotalOrder<SubspacePublicKey>;
    predecessorSubspace: PredecessorFn<SubspacePublicKey>;
    successorSubspace: SuccessorFn<SubspacePublicKey>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspacePublicKey,
      exclusive: SubspacePublicKey,
    ) => boolean;
    namespaceEncodingScheme: KeypairEncodingScheme<
      NamespacePublicKey,
      NamespaceSignature
    >;
    subspaceEncodingScheme: KeypairEncodingScheme<
      SubspacePublicKey,
      SubspaceSignature
    >;
    pathLengthScheme: EncodingScheme<number> & {
      maxLength: number;
    };
  },
  encodedCapability: Uint8Array,
): {
  capability: Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >;
  length: number;
} {
  // get access mode

  const accessMode = (encodedCapability[0] & 0x80) === 0x80 ? "write" : "read";

  const namespaceId = config.namespaceEncodingScheme.publicKey.decode(
    encodedCapability.slice(1),
  );

  const encodedNamespaceIdLength = config.namespaceEncodingScheme.publicKey
    .encodedLength(namespaceId);

  const isSource = (encodedCapability[0] & 0x7f) === 0x7f;

  if (isSource) {
    const isCommunualNamespace = config.isCommunalFn(namespaceId);

    const subspaceId = isCommunualNamespace
      ? config.subspaceEncodingScheme.publicKey.decode(
        encodedCapability.slice(
          1 + encodedNamespaceIdLength,
        ),
      )
      : config.minimalSubspaceKey;

    return {
      capability: {
        kind: "source",
        accessMode,
        namespaceId,
        subspaceId,
      },
      length: 1 + encodedNamespaceIdLength +
        (isCommunualNamespace
          ? config.subspaceEncodingScheme.publicKey.encodedLength(subspaceId)
          : 0),
    };
  }

  const isDelegation = (encodedCapability[0] & 0x7e) === 0x7e;

  if (isDelegation) {
    const { capability: parentCap, length: parentLength } = decodeCapability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >(config, encodedCapability.slice(1 + encodedNamespaceIdLength));

    const delegationLimit =
      encodedCapability[1 + encodedNamespaceIdLength + parentLength];

    const isCommunalNamespace = config.isCommunalFn(namespaceId);

    const { delegee, delegeeLength, authorisation, authorisationLength } =
      decodeDelegeeAuthorisation(
        {
          isCommunal: isCommunalNamespace,
          namespaceEncodingScheme: config.namespaceEncodingScheme,
          subspaceEncodingScheme: config.subspaceEncodingScheme,
        },
        encodedCapability.slice(
          1 + encodedNamespaceIdLength + parentLength + 1,
        ),
      );

    return {
      capability: {
        kind: "delegation",
        parent: parentCap,
        delegationLimit: delegationLimit,
        delegee,
        authorisation,
      } as Capability<
        NamespacePublicKey,
        NamespaceSignature,
        SubspacePublicKey,
        SubspaceSignature
      >,
      length: 1 + encodedNamespaceIdLength + parentLength + 1 +
        delegeeLength +
        authorisationLength,
    };
  }

  const isRestriction = (encodedCapability[0] & 0x7d) === 0x7d;

  if (isRestriction) {
    const { capability: parentCap, length: parentLength } = decodeCapability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >(config, encodedCapability.slice(1 + encodedNamespaceIdLength));

    const { product: restrictionProduct, length: productLength } =
      decodeProduct(
        {
          ...config,
          subspacePublicKeyEncodingScheme:
            config.subspaceEncodingScheme.publicKey,
        },
        encodedCapability.slice(
          1 + encodedNamespaceIdLength + parentLength,
        ),
      );

    return {
      capability: {
        kind: "restriction",
        parent: parentCap,
        product: decanoniciseProduct({
          maxPathLength: config.pathLengthScheme.maxLength,
          successorSubspace: config.successorSubspace,
        }, restrictionProduct),
      },
      length: 1 + encodedNamespaceIdLength + parentLength + productLength,
    };
  }

  // it's a merge one.

  // Now determine what the merge length is
  let componentCount = 0;

  const componentCountIndicator =
    (encodedCapability[0] === 0x0 || encodedCapability[0] === 0x80)
      ? 0
      : accessMode === "read"
      ? encodedCapability[0]
      : encodedCapability[0] ^ 0x80;
  let componentCountIndicatorLen = 0;

  if (componentCountIndicator <= 120) {
    componentCount = componentCountIndicator + 2;
  } else if (componentCountIndicator === 121) {
    const view = new DataView(encodedCapability.buffer);

    componentCount = view.getUint8(1 + encodedNamespaceIdLength);
    componentCountIndicatorLen = 1;
  } else if (componentCountIndicator === 122) {
    const view = new DataView(encodedCapability.buffer);

    componentCount = view.getUint16(1 + encodedNamespaceIdLength);
    componentCountIndicatorLen = 2;
  } else if (componentCountIndicator === 123) {
    const view = new DataView(encodedCapability.buffer);

    componentCount = view.getUint32(1 + encodedNamespaceIdLength);
    componentCountIndicatorLen = 4;
  } else if (componentCountIndicator === 124) {
    const view = new DataView(encodedCapability.buffer);

    componentCount = Number(
      view.getBigUint64(1 + encodedNamespaceIdLength),
    );
    componentCountIndicatorLen = 8;
  }

  const mergedComponents = [];

  let decodedBytesSoFar = 0;

  while (
    mergedComponents.length < componentCount
  ) {
    const toDecode = encodedCapability.slice(
      1 + encodedNamespaceIdLength +
        componentCountIndicatorLen + decodedBytesSoFar,
    );

    const { capability, length } = decodeCapability<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >(config, toDecode);

    decodedBytesSoFar += length;

    mergedComponents.push(capability);
  }

  return {
    capability: {
      kind: "merge",
      components: mergedComponents,
    },
    length: 1 + encodedNamespaceIdLength +
      componentCountIndicatorLen + decodedBytesSoFar,
  };
}

export function decodeDelegeeAuthorisation<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
>(
  options: {
    isCommunal: boolean;
    namespaceEncodingScheme: KeypairEncodingScheme<
      NamespacePublicKey,
      NamespaceSignature
    >;
    subspaceEncodingScheme: KeypairEncodingScheme<
      SubspacePublicKey,
      SubspaceSignature
    >;
  },
  encoded: Uint8Array,
):
  | {
    delegee: NamespacePublicKey;
    delegeeLength: number;
    authorisation: NamespaceSignature;
    authorisationLength: number;
  }
  | {
    delegee: SubspacePublicKey;
    delegeeLength: number;
    authorisation: SubspaceSignature;
    authorisationLength: number;
  } {
  if (options.isCommunal) {
    const delegee = options.subspaceEncodingScheme.publicKey.decode(encoded);
    const delegeeLength = options.subspaceEncodingScheme.publicKey
      .encodedLength(delegee);

    const authorisation = options.subspaceEncodingScheme.signature.decode(
      encoded.slice(delegeeLength),
    );

    return {
      delegee,
      delegeeLength,
      authorisation,
      authorisationLength: options.subspaceEncodingScheme.signature
        .encodedLength(authorisation),
    };
  }

  const delegee = options.namespaceEncodingScheme.publicKey.decode(encoded);
  const delegeeLength = options.namespaceEncodingScheme.publicKey
    .encodedLength(delegee);

  const authorisation = options.namespaceEncodingScheme.signature.decode(
    encoded.slice(delegeeLength),
  );

  return {
    delegee,
    delegeeLength,
    authorisation,
    authorisationLength: options.namespaceEncodingScheme.signature
      .encodedLength(authorisation),
  };
}

/** Encode a _canonic_ three dimensional product. */
export function encodeProduct<SubspaceId>(
  { orderSubspace, encodeSubspacePublicKey, encodePathLength }: {
    orderSubspace: TotalOrder<SubspaceId>;
    encodeSubspacePublicKey: (subspace: SubspaceId) => Uint8Array;
    encodePathLength: (num: number) => Uint8Array;
  },
  product: CanonicProduct<SubspaceId>,
): Uint8Array {
  const [subspaceDimension, pathDimension, timestampDimension] = product;

  // empty product

  if (
    timestampDimension.length === 0 && pathDimension.length === 0 &&
    subspaceDimension.length === 0
  ) {
    return new Uint8Array([0xff]);
  }

  // length size flags

  let lengthSizeBits = 0x0;

  if (subspaceDimension.length <= 256) {
    lengthSizeBits |= 0x20;
  }

  if (hasOpenRange(subspaceDimension)) {
    lengthSizeBits |= 0x10;
  }

  if (pathDimension.length <= 256) {
    lengthSizeBits |= 0x8;
  }

  if (hasOpenRange(pathDimension)) {
    lengthSizeBits |= 0x4;
  }

  if (timestampDimension.length <= 256) {
    lengthSizeBits |= 0x2;
  }

  if (hasOpenRange(timestampDimension)) {
    lengthSizeBits |= 0x1;
  }

  const lengthSizeFlags = new Uint8Array([lengthSizeBits]);

  // the actual lengths of each dimension
  // 8bit uint if < 256
  // 64bit uint if greater than that.

  let subspaceLength = new Uint8Array();

  if (subspaceDimension.length - 1 < 256) {
    subspaceLength = new Uint8Array(1);
    const view = new DataView(subspaceLength.buffer);
    view.setUint8(0, subspaceDimension.length - 1);
  } else {
    subspaceLength = new Uint8Array(8);
    const view = new DataView(subspaceLength.buffer);
    view.setBigUint64(0, BigInt(subspaceDimension.length - 1));
  }

  let pathLength = new Uint8Array();

  if (pathDimension.length - 1 < 256) {
    pathLength = new Uint8Array(1);
    const view = new DataView(pathLength.buffer);
    view.setUint8(0, pathDimension.length - 1);
  } else {
    pathLength = new Uint8Array(8);
    const view = new DataView(pathLength.buffer);
    view.setBigUint64(0, BigInt(pathDimension.length - 1));
  }

  let timeLength = new Uint8Array();

  if (timestampDimension.length - 1 < 256) {
    timeLength = new Uint8Array(1);
    const view = new DataView(timeLength.buffer);
    view.setUint8(0, timestampDimension.length - 1);
  } else {
    timeLength = new Uint8Array(8);
    const view = new DataView(timeLength.buffer);
    view.setBigUint64(0, BigInt(timestampDimension.length - 1));
  }

  // encoded subspace ranges.

  // Ranges must be in order.
  const subspaceDisjointByStart = subspaceDimension.toSorted((a, b) =>
    orderSubspace(a.start, b.start)
  );

  // Ranges come in chunks of 8.
  const subspaceChunks = chunk(subspaceDisjointByStart, 8);

  const encodedSubspaceChunks: Uint8Array[] = [];

  for (const chunk of subspaceChunks) {
    // Each chunk begins with eight bits indicating whether each respective range is exclusive or inclusive.
    let exclusiveInclusiveBits = 0x0;

    const encodedRanges: Uint8Array[] = [];

    for (let i = 0; i < 8; i++) {
      const range = chunk[i];

      if (!range) {
        break;
      }

      if (range.kind === "open") {
        encodedRanges.push(encodeSubspacePublicKey(range.start));
      } else {
        if (range.kind === "closed_inclusive") {
          exclusiveInclusiveBits |= 1 << i;
        }

        encodedRanges.push(encodeSubspacePublicKey(range.start));
        encodedRanges.push(encodeSubspacePublicKey(range.end));
      }
    }

    encodedSubspaceChunks.push(
      concat(new Uint8Array([exclusiveInclusiveBits]), ...encodedRanges),
    );
  }

  const encodedSubspaceRanges = concat(...encodedSubspaceChunks);

  // encoded path ranges

  const pathDisjointByStart = pathDimension.toSorted((a, b) =>
    orderPaths(a.start, b.start)
  );

  // Paths are also encoded in chunks of 8.

  const pathChunks = chunk(pathDisjointByStart, 8);

  const encodedPathChunks: Uint8Array[] = [];

  let prevPath: Uint8Array | null = null;

  for (const chunk of pathChunks) {
    // Each chunk begins with eight bits indicating whether each respective range is exclusive or inclusive.

    let exclusiveInclusiveBits = 0x0;

    const encodedRanges: Uint8Array[] = [];

    for (let i = 0; i < 8; i++) {
      const range = chunk[i];

      if (!range) {
        break;
      }

      // Each path is encoded as:
      // - the length of the common prefix with the preceding path (except for the first path)
      // - the length of the differing suffix
      // - the encoded differing suffix

      if (prevPath) {
        const prefixLen = commonPrefixLength(prevPath, range.start);

        encodedRanges.push(
          encodePathLength(prefixLen),
        );

        const suffix = commonSuffix(prefixLen, range.start);

        encodedRanges.push(
          encodePathLength(suffix.byteLength),
        );
        encodedRanges.push(
          suffix,
        );
      } else {
        encodedRanges.push(
          encodePathLength(range.start.byteLength),
        );
        encodedRanges.push(
          range.start,
        );
      }

      if (range.kind !== "open") {
        if (range.kind === "closed_inclusive") {
          exclusiveInclusiveBits |= 1 << i;
        }

        const prefixLen = commonPrefixLength(range.start, range.end);

        encodedRanges.push(
          encodePathLength(prefixLen),
        );

        const suffix = commonSuffix(prefixLen, range.end);

        encodedRanges.push(
          encodePathLength(suffix.byteLength),
        );
        encodedRanges.push(
          suffix,
        );

        prevPath = range.end;
      } else {
        prevPath = range.start;
      }
    }

    encodedPathChunks.push(
      concat(new Uint8Array([exclusiveInclusiveBits]), ...encodedRanges),
    );
  }

  const encodedPathRanges = concat(...encodedPathChunks);

  // encoded time ranges

  const timeDisjointByStart = timestampDimension.toSorted((a, b) =>
    orderTimestamps(a.start, b.start)
  );

  const encodedTimeRangesArr: Uint8Array[] = [];

  for (const range of timeDisjointByStart) {
    // Finally something simple, no chunks or prefix stuff.
    // All time ranges are either closed + exclusive or open.

    const startBytes = new Uint8Array(8);
    const startView = new DataView(startBytes.buffer);
    startView.setBigUint64(0, range.start);

    encodedTimeRangesArr.push(startBytes);

    if (range.kind !== "open") {
      const endBytes = new Uint8Array(8);
      const endView = new DataView(endBytes.buffer);
      endView.setBigUint64(0, range.end);

      encodedTimeRangesArr.push(endBytes);
    }
  }

  const encodedTimeRanges = concat(...encodedTimeRangesArr);

  return concat(
    lengthSizeFlags,
    subspaceLength,
    pathLength,
    timeLength,
    encodedSubspaceRanges,
    encodedPathRanges,
    encodedTimeRanges,
  );
}

function commonPrefixLength(a: Uint8Array, b: Uint8Array): number {
  const shortestLength = Math.min(a.byteLength, b.byteLength);

  for (let i = 0; i < shortestLength; i++) {
    if (a[i] === b[i]) {
      continue;
    }

    return i;
  }

  return shortestLength;
}

// You can use this to get products from encodings, but this was really implemented for roundtrip testing.
export function decodeProduct<
  SubspaceIdType,
>(
  {
    subspacePublicKeyEncodingScheme,
    orderSubspace,
    predecessorSubspace,
    successorSubspace,
    isInclusiveSmallerSubspace,
    pathLengthScheme,
  }: {
    subspacePublicKeyEncodingScheme: EncodingScheme<SubspaceIdType>;
    orderSubspace: TotalOrder<SubspaceIdType>;
    predecessorSubspace: PredecessorFn<SubspaceIdType>;
    successorSubspace: SuccessorFn<SubspaceIdType>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspaceIdType,
      exclusive: SubspaceIdType,
    ) => boolean;
    pathLengthScheme: EncodingScheme<number> & {
      maxLength: number;
    };
  },
  encodedProduct: Uint8Array,
): { product: CanonicProduct<SubspaceIdType>; length: number } {
  // Decode empty product.
  if (encodedProduct.byteLength === 1 && encodedProduct[0] === 255) {
    return { product: [[], [], []], length: 1 };
  }

  const encodedProductView = new DataView(encodedProduct.buffer);

  // Decode lengthSize bit flags
  const lengthSizeByte = encodedProduct[0];

  const lte256SubspaceRanges = (lengthSizeByte & 0x20) === 0x20;
  const hasOpenSubspaceRange = (lengthSizeByte & 0x10) === 0x10;

  const lte256PathRanges = (lengthSizeByte & 0x8) === 0x8;
  const hasOpenPathRange = (lengthSizeByte & 0x4) === 0x4;

  const lte256TimeRanges = (lengthSizeByte & 0x2) === 0x2;
  const hasOpenTimeRange = (lengthSizeByte & 0x1) === 0x1;

  const pathLengthPos = lte256SubspaceRanges ? 2 : 8;
  const timeLengthPos = lte256PathRanges
    ? pathLengthPos + 1
    : pathLengthPos + 8;

  // Decode subspace length
  let subspaceLength: number;

  if (lte256SubspaceRanges) {
    subspaceLength = encodedProduct[1] + 1;
  } else {
    subspaceLength = Number(encodedProductView.getBigUint64(1));
  }

  // Decode path length
  let pathLength: number;

  if (lte256PathRanges) {
    pathLength = encodedProduct[pathLengthPos] + 1;
  } else {
    pathLength = Number(encodedProductView.getBigUint64(pathLengthPos));
  }

  // Decode time length
  let timeLength: number;

  if (lte256TimeRanges) {
    timeLength = encodedProduct[timeLengthPos] + 1;
  } else {
    timeLength = Number(encodedProductView.getBigUint64(timeLengthPos));
  }

  let subspaceRangesPos = timeLengthPos + (lte256TimeRanges ? 1 : 8);

  // Decode subspace chunks

  const subspaceChunkCount = Math.ceil(
    typeof subspaceLength === "bigint"
      ? Number(subspaceLength / BigInt(8))
      : subspaceLength / 8,
  );

  let subspaceDisjoint: DisjointInterval<SubspaceIdType> = [];

  for (let chunkIdx = 0; chunkIdx < subspaceChunkCount; chunkIdx++) {
    const rangeKindFlagByte = encodedProduct[subspaceRangesPos];

    subspaceRangesPos += 1;

    for (let rangeIdx = 0; rangeIdx < 8; rangeIdx++) {
      const absoluteRangeIdx = rangeIdx + (chunkIdx * 8);

      if (
        (hasOpenSubspaceRange &&
          absoluteRangeIdx < subspaceLength - 1) ||
        (!hasOpenSubspaceRange &&
          absoluteRangeIdx <= subspaceLength - 1)
      ) {
        // This is a closed range.

        const isInclusive = (rangeKindFlagByte & 1 << rangeIdx) !== 0;

        // Read subspace from start pos.
        const subspaceStart = subspacePublicKeyEncodingScheme.decode(
          encodedProduct.slice(subspaceRangesPos),
        );

        // Get the encoded length of the decoded subspace.
        const encodedStartLength = subspacePublicKeyEncodingScheme
          .encodedLength(subspaceStart);
        subspaceRangesPos += encodedStartLength;

        // Read subspace from end pos.
        const subspaceEnd = subspacePublicKeyEncodingScheme.decode(
          encodedProduct.slice(subspaceRangesPos),
        );

        const encodedEndLength = subspacePublicKeyEncodingScheme.encodedLength(
          subspaceEnd,
        );
        subspaceRangesPos += encodedEndLength;

        const range: Range<SubspaceIdType> = {
          kind: isInclusive ? "closed_inclusive" : "closed_exclusive",
          start: subspaceStart,
          end: subspaceEnd,
        };

        subspaceDisjoint = addRangeToDisjointInterval(
          {
            order: orderSubspace,
            successor: successorSubspace,
            predecessor: predecessorSubspace,
            isInclusiveSmaller: isInclusiveSmallerSubspace,
          },
          range,
          subspaceDisjoint,
        );
      } else if (
        hasOpenSubspaceRange &&
        absoluteRangeIdx === subspaceLength - 1
      ) {
        // This is the open range!

        // Read subspace from start pos.
        const subspaceStart = subspacePublicKeyEncodingScheme.decode(
          encodedProduct.slice(subspaceRangesPos),
        );

        // Get the encoded length of the decoded subspace.
        const encodedStartLength = subspacePublicKeyEncodingScheme
          .encodedLength(subspaceStart);
        subspaceRangesPos += encodedStartLength;

        subspaceDisjoint = addRangeToDisjointInterval(
          {
            order: orderSubspace,
            successor: successorSubspace,
            predecessor: predecessorSubspace,
            isInclusiveSmaller: isInclusiveSmallerSubspace,
          },
          {
            kind: "open",
            start: subspaceStart,
          },
          subspaceDisjoint,
        );
      } else {
        // This is a nothing range.
        break;
      }
    }
  }

  // Decode path chunks

  const pathChunkCount = Math.ceil(
    typeof pathLength === "bigint"
      ? Number(pathLength / BigInt(8))
      : pathLength / 8,
  );

  let currentPathChunkPos = subspaceRangesPos;

  let pathDisjoint: DisjointInterval<Uint8Array> = [];

  let prevPath = new Uint8Array();

  for (let chunkIdx = 0; chunkIdx < pathChunkCount; chunkIdx++) {
    const rangeKindFlagByte = encodedProduct[currentPathChunkPos];

    currentPathChunkPos++;

    for (let rangeIdx = 0; rangeIdx < 8; rangeIdx++) {
      const absoluteRangeIdx = rangeIdx + (chunkIdx * 8);
      const isInclusive = (rangeKindFlagByte & 1 << rangeIdx) !== 0;

      if (
        (hasOpenPathRange &&
          absoluteRangeIdx < pathLength - 1) ||
        (!hasOpenPathRange &&
          absoluteRangeIdx <= pathLength - 1)
      ) {
        const startCommonPrefixLength = absoluteRangeIdx === 0
          ? 0
          : pathLengthScheme.decode(encodedProduct.slice(currentPathChunkPos));

        if (absoluteRangeIdx !== 0) {
          currentPathChunkPos++;
        }

        const startSuffixLength = pathLengthScheme.decode(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathLengthScheme.encodedLength(
          startSuffixLength,
        );

        const startSuffix = encodedProduct.slice(
          currentPathChunkPos,
          currentPathChunkPos + startSuffixLength,
        );

        const pathStart = commonPrefix(
          startCommonPrefixLength,
          prevPath,
          startSuffix,
        );

        currentPathChunkPos += startSuffixLength;

        const endCommonPrefixLength = pathLengthScheme.decode(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathLengthScheme.encodedLength(
          endCommonPrefixLength,
        );

        const endSuffixLength = pathLengthScheme.decode(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathLengthScheme.encodedLength(endSuffixLength);

        const endSuffix = encodedProduct.slice(
          currentPathChunkPos,
          currentPathChunkPos + endSuffixLength,
        );

        const pathEnd = commonPrefix(
          endCommonPrefixLength,
          pathStart,
          endSuffix,
        );

        currentPathChunkPos += endSuffixLength;

        const range: Range<Uint8Array> = {
          kind: isInclusive ? "closed_inclusive" : "closed_exclusive",
          start: pathStart,
          end: pathEnd,
        };

        pathDisjoint = addRangeToDisjointInterval(
          {
            order: orderPaths,
            successor: makeSuccessorPath(pathLengthScheme.maxLength),
            predecessor: predecessorPath,
            isInclusiveSmaller: (incl, excl) =>
              incl.byteLength < excl.byteLength,
          },
          range,
          pathDisjoint,
        );

        prevPath = pathEnd;
      } else if (
        hasOpenPathRange &&
        absoluteRangeIdx === pathLength - 1
      ) {
        const startCommonPrefixLength = absoluteRangeIdx === 0
          ? 0
          : pathLengthScheme.decode(encodedProduct.slice(currentPathChunkPos));

        if (absoluteRangeIdx !== 0) {
          currentPathChunkPos++;
        }

        const startSuffixLength = pathLengthScheme.decode(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathLengthScheme.encodedLength(
          startSuffixLength,
        );

        const startSuffix = encodedProduct.slice(
          currentPathChunkPos,
          currentPathChunkPos + startSuffixLength,
        );

        const pathStart = commonPrefix(
          startCommonPrefixLength,
          prevPath,
          startSuffix,
        );

        currentPathChunkPos += startSuffixLength;

        const range: Range<Uint8Array> = {
          kind: "open",
          start: pathStart,
        };

        pathDisjoint = addRangeToDisjointInterval(
          {
            order: orderPaths,
            successor: makeSuccessorPath(pathLengthScheme.maxLength),
            predecessor: predecessorPath,
            isInclusiveSmaller: (incl, excl) =>
              incl.byteLength < excl.byteLength,
          },
          range,
          pathDisjoint,
        );
      } else {
        // This is a nothing range.
        break;
      }
    }
  }

  const timeChunksPos = currentPathChunkPos;

  // Decode timestamp ranges.

  const encodedView = new DataView(encodedProduct.buffer);

  let timeDisjoint: DisjointInterval<bigint> = [];

  for (let i = 0; i < timeLength; i++) {
    if (
      (hasOpenTimeRange &&
        i < timeLength - 1) ||
      (!hasOpenTimeRange &&
        i <= timeLength - 1)
    ) {
      // This is a closed range.
      const startPos = timeChunksPos +
        (i * 8 * 2);
      const endPos = startPos + 8;

      // Read time from start pos.
      const startTime = encodedView.getBigUint64(startPos);

      const endTime = encodedView.getBigUint64(endPos);

      const range: Range<bigint> = {
        kind: "closed_exclusive",
        start: startTime,
        end: endTime,
      };

      timeDisjoint = addRangeToDisjointInterval(
        {
          order: orderTimestamps,
          successor: successorTimestamp,
          predecessor: predecessorTimestamp,
          isInclusiveSmaller: () => false,
        },
        range,
        timeDisjoint,
      );
    } else if (
      hasOpenTimeRange &&
      i === timeLength - 1
    ) {
      // This is the open range!
      const startPos = timeChunksPos +
        (i * 8 * 2);

      // Read subspace from start pos.

      const startTime = encodedView.getBigUint64(startPos);

      const range: Range<bigint> = {
        kind: "open",
        start: startTime,
      };

      timeDisjoint = addRangeToDisjointInterval(
        {
          order: orderTimestamps,
          successor: successorTimestamp,
          predecessor: predecessorTimestamp,
          isInclusiveSmaller: () => false,
        },
        range,
        timeDisjoint,
      );
    }
  }

  const finalLength = timeChunksPos + (16 * timeLength) +
    (hasOpenTimeRange ? -8 : 0);

  return {
    product: canonicProduct({
      isInclusiveSmallerSubspace,
      predecessorSubspace: predecessorSubspace,
    }, [subspaceDisjoint, pathDisjoint, timeDisjoint]),
    length: finalLength,
  };
}

function commonSuffix(
  prefixLength: number,
  bytes: Uint8Array,
) {
  return bytes.slice(prefixLength);
}

function commonPrefix(
  prefixLength: number,
  common: Uint8Array,
  suffix: Uint8Array,
) {
  const bytes = new Uint8Array(prefixLength + suffix.byteLength);

  bytes.set(common.slice(0, prefixLength), 0);
  bytes.set(suffix, prefixLength);

  return bytes;
}
