import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import {
  addRangeToDisjointInterval,
  canonicProduct,
  hasOpenRange,
} from "../products/products.ts";
import { CanonicProduct, DisjointInterval } from "../products/types.ts";
import { chunk } from "$std/collections/chunk.ts";
import { concat } from "$std/bytes/concat.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { Capability, IsCommunalFn } from "./types.ts";
import { getAccessMode, getNamespace } from "./util.ts";
import { Range } from "../ranges/types.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";

export function encodeCapability<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
>(
  {
    encodeNamespace,
    encodeSubspace,
    isCommunalFn,
    orderSubspace,
    encodePath,
    encodePathLength,
    encodeAuthorPublicKey,
    encodeAuthorSignature,
  }: {
    encodeNamespace: (namespace: NamespacePublicKey) => Uint8Array;
    encodeSubspace: (subspace: SubspacePublicKey) => Uint8Array;
    isCommunalFn: IsCommunalFn<NamespacePublicKey>;
    orderSubspace: TotalOrder<SubspacePublicKey>;
    encodePathLength: (num: number) => Uint8Array;
    encodePath: (path: Uint8Array) => Uint8Array;
    encodeAuthorPublicKey: (key: AuthorPublicKey) => Uint8Array;
    encodeAuthorSignature: (key: AuthorSignature) => Uint8Array;
  },
  cap: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >,
): Uint8Array {
  // read / write type byte
  let readWriteTypeBits = 0;

  const accessMode = getAccessMode(cap, isCommunalFn);

  if (accessMode === "write") {
    readWriteTypeBits |= 1 << 7;
  }

  switch (cap.kind) {
    case "source":
      readWriteTypeBits |= 0x7f;
      break;
    case "delegation":
      readWriteTypeBits |= 0x7d;
      break;
    case "restriction":
      readWriteTypeBits |= 0x7e;
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

  const encodedNamespace = encodeNamespace(namespace);

  // switch on cap type...

  let encodedCapability = new Uint8Array();

  switch (cap.kind) {
    case "source": {
      if (isCommunalFn(namespace)) {
        encodedCapability = encodeSubspace(cap.subspaceId);
      }
      break;
    }
    case "delegation": {
      encodedCapability = concat(
        encodeCapability({
          encodeNamespace,
          encodeSubspace,
          isCommunalFn,
          orderSubspace,
          encodePathLength,
          encodePath,
          encodeAuthorPublicKey,
          encodeAuthorSignature,
        }, cap.parent),
        new Uint8Array([cap.delegationLimit]),
        encodeAuthorPublicKey(cap.delegee),
        encodeAuthorSignature(cap.authorisation),
      );
      break;
    }
    case "restriction": {
      encodedCapability = concat(
        encodeCapability({
          encodeNamespace,
          encodeSubspace,
          isCommunalFn,
          orderSubspace,
          encodePath,
          encodePathLength,
          encodeAuthorPublicKey,
          encodeAuthorSignature,
        }, cap.parent),
        encodeProduct({
          encodeSubspace,
          orderSubspace,

          encodePathLength,
        }, cap.product),
      );
      break;
    }
    case "merge": {
      const encodedComponents: Uint8Array[] = [];

      for (const component of cap.components) {
        encodedComponents.push(
          encodeCapability({
            encodeNamespace,
            encodeSubspace,
            isCommunalFn,
            orderSubspace,
            encodePath,
            encodePathLength,
            encodeAuthorSignature,
            encodeAuthorPublicKey,
          }, component),
        );
      }

      encodedCapability = concat(...encodedComponents);
    }
  }

  return concat(
    new Uint8Array([readWriteTypeBits]),
    encodedNamespace,
    encodedCapability,
  );
}

export function encodeProduct<SubspaceId>(
  { orderSubspace, encodeSubspace, encodePathLength }: {
    orderSubspace: TotalOrder<SubspaceId>;
    encodeSubspace: (subspace: SubspaceId) => Uint8Array;
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

  // the actual lengths

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

  const subspaceDisjointByStart = subspaceDimension.toSorted((a, b) =>
    orderSubspace(a.start, b.start)
  );

  const subspaceChunks = chunk(subspaceDisjointByStart, 8);

  const encodedSubspaceChunks: Uint8Array[] = [];

  for (const chunk of subspaceChunks) {
    let exclusiveInclusiveBits = 0x0;

    const encodedRanges: Uint8Array[] = [];

    for (let i = 0; i < 8; i++) {
      const range = chunk[i];

      if (!range) {
        break;
      }

      if (range.kind === "open") {
        encodedRanges.push(encodeSubspace(range.start));
      } else {
        if (range.kind === "closed_inclusive") {
          exclusiveInclusiveBits |= 1 << i;
        }

        encodedRanges.push(encodeSubspace(range.start));
        encodedRanges.push(encodeSubspace(range.end));
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

  const pathChunks = chunk(pathDisjointByStart, 8);

  const encodedPathChunks: Uint8Array[] = [];

  let prevPath: Uint8Array | null = null;

  for (const chunk of pathChunks) {
    let exclusiveInclusiveBits = 0x0;

    const encodedRanges: Uint8Array[] = [];

    for (let i = 0; i < 8; i++) {
      const range = chunk[i];

      if (!range) {
        break;
      }

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

// Decoding - unfinished but leaving here JUST IN CASE

export function decodeProduct<
  SubspaceIdType,
>(
  {
    encodedSubspaceLength,
    decodeSubspace,
    orderSubspace,
    getPredecessorSubspace,
    getSuccessorSubspace,
    isInclusiveSmallerSubspace,
    pathBitIntLength,
    maxPathLength,
    decodePathLength,
  }: {
    encodedSubspaceLength: number;
    decodeSubspace: (encodedSubspace: Uint8Array) => SubspaceIdType;
    orderSubspace: TotalOrder<SubspaceIdType>;
    getPredecessorSubspace: PredecessorFn<SubspaceIdType>;
    getSuccessorSubspace: SuccessorFn<SubspaceIdType>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspaceIdType,
      exclusive: SubspaceIdType,
    ) => boolean;
    pathBitIntLength: number;
    maxPathLength: number;
    decodePathLength: (encoding: Uint8Array) => number;
  },
  encodedProduct: Uint8Array,
): CanonicProduct<SubspaceIdType> {
  // Decode empty product.
  if (encodedProduct.byteLength === 1 && encodedProduct[0] === 255) {
    return [[], [], []];
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

  const subspaceRangesPos = timeLengthPos + (lte256TimeRanges ? 1 : 8);

  // Decode subspace chunks

  const subspaceChunkCount = Math.ceil(
    typeof subspaceLength === "bigint"
      ? Number(subspaceLength / BigInt(8))
      : subspaceLength / 8,
  );

  const subspaceChunkByteLength = 1 + (16 * encodedSubspaceLength);

  let subspaceDisjoint: DisjointInterval<SubspaceIdType> = [];

  let pathChunksPos = subspaceRangesPos;

  for (let chunkIdx = 0; chunkIdx < subspaceChunkCount; chunkIdx++) {
    const chunkStartPos = subspaceRangesPos +
      (chunkIdx * subspaceChunkByteLength);

    const rangeKindFlagByte = encodedProduct[chunkStartPos];

    pathChunksPos += 1;

    for (let rangeIdx = 0; rangeIdx < 8; rangeIdx++) {
      const absoluteRangeIdx = rangeIdx + (chunkIdx * 8);

      if (
        (hasOpenSubspaceRange &&
          absoluteRangeIdx < subspaceLength - 1) ||
        (!hasOpenSubspaceRange &&
          absoluteRangeIdx <= subspaceLength - 1)
      ) {
        // This is a closed range.
        const startPos = chunkStartPos + 1 +
          (rangeIdx * encodedSubspaceLength * 2);
        const endPos = startPos + encodedSubspaceLength;

        const isInclusive = (rangeKindFlagByte & 1 << rangeIdx) !== 0;

        // Read subspace from start pos.
        const subspaceStart = decodeSubspace(
          encodedProduct.slice(startPos, startPos + encodedSubspaceLength),
        );

        // Read subspace from end pos.
        const subspaceEnd = decodeSubspace(
          encodedProduct.slice(endPos, endPos + encodedSubspaceLength),
        );

        const range: Range<SubspaceIdType> = {
          kind: isInclusive ? "closed_inclusive" : "closed_exclusive",
          start: subspaceStart,
          end: subspaceEnd,
        };

        subspaceDisjoint = addRangeToDisjointInterval(
          {
            order: orderSubspace,
            successor: getSuccessorSubspace,
            predecessor: getPredecessorSubspace,
            isInclusiveSmaller: isInclusiveSmallerSubspace,
          },
          range,
          subspaceDisjoint,
        );

        pathChunksPos += encodedSubspaceLength * 2;
      } else if (
        hasOpenSubspaceRange &&
        absoluteRangeIdx === subspaceLength - 1
      ) {
        // This is the open range!
        const startPos = chunkStartPos + 1 +
          (rangeIdx * encodedSubspaceLength * 2);

        // Read subspace from start pos.
        const subspaceStart = decodeSubspace(
          encodedProduct.slice(startPos, startPos + encodedSubspaceLength),
        );

        subspaceDisjoint = addRangeToDisjointInterval(
          {
            order: orderSubspace,
            successor: getSuccessorSubspace,
            predecessor: getPredecessorSubspace,
            isInclusiveSmaller: isInclusiveSmallerSubspace,
          },
          {
            kind: "open",
            start: subspaceStart,
          },
          subspaceDisjoint,
        );

        pathChunksPos += encodedSubspaceLength;
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

  let currentPathChunkPos = pathChunksPos;

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
          : decodePathLength(encodedProduct.slice(currentPathChunkPos));

        if (absoluteRangeIdx !== 0) {
          currentPathChunkPos++;
        }

        const startSuffixLength = decodePathLength(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathBitIntLength;

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

        const endCommonPrefixLength = decodePathLength(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathBitIntLength;

        const endSuffixLength = decodePathLength(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathBitIntLength;

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
            successor: makeSuccessorPath(maxPathLength),
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
          : decodePathLength(encodedProduct.slice(currentPathChunkPos));

        if (absoluteRangeIdx !== 0) {
          currentPathChunkPos++;
        }

        const startSuffixLength = decodePathLength(
          encodedProduct.slice(currentPathChunkPos),
        );

        currentPathChunkPos += pathBitIntLength;

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
            successor: makeSuccessorPath(maxPathLength),
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
        (i * encodedSubspaceLength * 2);

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

      pathChunksPos += encodedSubspaceLength;
    }
  }

  return canonicProduct({
    isInclusiveSmallerSubspace,
    predecessorSubspace: getPredecessorSubspace,
  }, [subspaceDisjoint, pathDisjoint, timeDisjoint]);
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
