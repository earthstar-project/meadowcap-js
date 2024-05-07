import {
  CommunalCapability,
  Delegation,
  McCapability,
  McSubspaceCapability,
  OwnedCapability,
} from "./types.ts";
import { getGrantedAreaCommunal, getGrantedAreaOwned } from "./semantics.ts";
import {
  ANY_SUBSPACE,
  Area,
  concat,
  decodeAreaInArea,
  decodeCompactWidth,
  decodeStreamAreaInArea,
  encodeAreaInArea,
  encodeAreaInAreaLength,
  encodeCompactWidth,
  EncodingScheme,
  fullArea,
  GrowingBytes,
  KeypairScheme,
  OPEN_END,
  PathScheme,
  subspaceArea,
  TotalOrder,
} from "../../deps.ts";
import { UserScheme } from "../meadowcap/types.ts";

/** Returns the handover message to be signed when issuing a delegation for a communal capability. */
export function handoverCommunal<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  UserPublicKey,
  UserSecretKey,
  UserSignature,
>(
  opts: {
    pathScheme: PathScheme;
    namespaceScheme: KeypairScheme<
      NamespacePublicKey,
      NamespaceSecretKey,
      NamespaceSignature
    >;
    userScheme: UserScheme<UserPublicKey, UserSecretKey, UserSignature>;
  },
  prevCap: CommunalCapability<NamespacePublicKey, UserPublicKey, UserSignature>,
  newArea: Area<UserPublicKey>,
  newUser: UserPublicKey,
): Uint8Array {
  if (prevCap.delegations.length === 0) {
    const accessMode = prevCap.accessMode === "read" ? 0x0 : 0x1;
    const accessModeByte = new Uint8Array([accessMode]);

    const namespace = opts.namespaceScheme.encodings.publicKey.encode(
      prevCap.namespaceKey,
    );

    const areaInArea = encodeAreaInArea(
      {
        pathScheme: opts.pathScheme,
        encodeSubspace: opts.userScheme.encodings.publicKey.encode,
        orderSubspace: opts.userScheme.order,
      },
      newArea,
      getGrantedAreaCommunal(prevCap),
    );

    const newPubKey = opts.userScheme.encodings.publicKey.encode(newUser);

    return concat(
      accessModeByte,
      namespace,
      areaInArea,
      newPubKey,
    );
  }

  const [, , prevSig] = prevCap.delegations[prevCap.delegations.length - 1];

  const prevArea = getGrantedAreaCommunal(prevCap);

  const areaInArea = encodeAreaInArea(
    {
      pathScheme: opts.pathScheme,
      encodeSubspace: opts.userScheme.encodings.publicKey.encode,
      orderSubspace: opts.userScheme.order,
    },
    newArea,
    prevArea,
  );

  const userSignature = opts.userScheme.encodings.signature.encode(
    prevSig,
  );

  const newPubKey = opts.userScheme.encodings.publicKey.encode(newUser);

  return concat(
    areaInArea,
    userSignature,
    newPubKey,
  );
}

/** Returns the handover message to be signed when issuing a delegation for an owned capability. */
export function handoverOwned<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  UserPublicKey,
  UserSecretKey,
  UserSignature,
>(
  opts: {
    pathScheme: PathScheme;
    namespaceScheme: KeypairScheme<
      NamespacePublicKey,
      NamespaceSecretKey,
      NamespaceSignature
    >;
    userScheme: UserScheme<UserPublicKey, UserSecretKey, UserSignature>;
  },
  prevCap: OwnedCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
  newArea: Area<UserPublicKey>,
  newUser: UserPublicKey,
): Uint8Array {
  const prevArea = getGrantedAreaOwned(prevCap);

  if (prevCap.delegations.length === 0) {
    const areaInArea = encodeAreaInArea(
      {
        pathScheme: opts.pathScheme,
        encodeSubspace: opts.userScheme.encodings.publicKey.encode,
        orderSubspace: opts.userScheme.order,
      },
      newArea,
      prevArea,
    );

    const userSignature = opts.namespaceScheme.encodings.signature.encode(
      prevCap.initialAuthorisation,
    );

    const userPublicKey = opts.userScheme.encodings.publicKey.encode(
      newUser,
    );

    return concat(
      areaInArea,
      userSignature,
      userPublicKey,
    );
  }

  const [, , prevSig] = prevCap.delegations[prevCap.delegations.length - 1];

  const areaInArea = encodeAreaInArea(
    {
      pathScheme: opts.pathScheme,
      encodeSubspace: opts.userScheme.encodings.publicKey.encode,
      orderSubspace: opts.userScheme.order,
    },
    newArea,
    prevArea,
  );

  const userSignature = opts.userScheme.encodings.signature.encode(
    prevSig,
  );

  const userPublicKey = opts.userScheme.encodings.publicKey.encode(
    newUser,
  );

  return concat(
    areaInArea,
    userSignature,
    userPublicKey,
  );
}

/** Returns the handover message to be signed when issuing a delegation for an subspace capability. */
export function handoverSubspace<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  UserPublicKey,
  UserSecretKey,
  UserSignature,
>(
  opts: {
    pathScheme: PathScheme;
    namespaceScheme: KeypairScheme<
      NamespacePublicKey,
      NamespaceSecretKey,
      NamespaceSignature
    >;
    userScheme: UserScheme<UserPublicKey, UserSecretKey, UserSignature>;
  },
  prevCap: McSubspaceCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
  newUser: UserPublicKey,
): Uint8Array {
  if (prevCap.delegations.length === 0) {
    const userSignature = opts.namespaceScheme.encodings.signature.encode(
      prevCap.initialAuthorisation,
    );

    const userPublicKey = opts.userScheme.encodings.publicKey.encode(
      newUser,
    );

    return concat(
      userSignature,
      userPublicKey,
    );
  }

  const [, prevSig] = prevCap.delegations[prevCap.delegations.length - 1];

  const userSignature = opts.userScheme.encodings.signature.encode(
    prevSig,
  );

  return concat(
    userSignature,
    opts.userScheme.encodings.publicKey.encode(
      newUser,
    ),
  );
}

function getDelegationLengthMask(length: number): number {
  if (length >= 4294967296) {
    return 0x3f;
  } else if (length >= 65536) {
    return 0x3e;
  } else if (length >= 256) {
    return 0x3d;
  } else if (length >= 60) {
    return 0x3c;
  }

  return length;
}

export function encodeMcCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  opts: {
    orderSubspace: TotalOrder<UserPublicKey>;
    pathScheme: PathScheme;
    encodingNamespace: EncodingScheme<NamespacePublicKey>;
    encodingUser: EncodingScheme<UserPublicKey>;
    encodingNamespaceSig: EncodingScheme<NamespaceSignature>;
    encodingUserSig: EncodingScheme<UserSignature>;
  },
  cap: McCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): Uint8Array {
  if ("initialAuthorisation" in cap === false) {
    const accessModeMask = cap.accessMode === "read" ? 0x0 : 0x40;
    const delLenMask = getDelegationLengthMask(cap.delegations.length);
    const header = accessModeMask | delLenMask;

    const encodedNamespace = opts.encodingNamespace.encode(cap.namespaceKey);
    const encodedUser = opts.encodingUser.encode(cap.userKey);

    const compactWidthDelegationsLen = cap.delegations.length <= 59
      ? new Uint8Array(0)
      : encodeCompactWidth(
        cap.delegations.length,
      );

    const encodedDelegationsAcc = [];

    let prevArea: Area<UserPublicKey> = {
      includedSubspaceId: cap.userKey,
      pathPrefix: [],
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    };

    for (const delegation of cap.delegations) {
      const [area, pk, sig] = delegation;

      const areaInAreaEncoded = encodeAreaInArea(
        {
          orderSubspace: opts.orderSubspace,
          pathScheme: opts.pathScheme,
          encodeSubspace: opts.encodingUser.encode,
        },
        area,
        prevArea,
      );

      const userPkEnc = opts.encodingUser.encode(pk);
      const sigEnc = opts.encodingUserSig.encode(sig);

      encodedDelegationsAcc.push(concat(areaInAreaEncoded, userPkEnc, sigEnc));

      prevArea = area;
    }

    return concat(
      new Uint8Array([header]),
      encodedNamespace,
      encodedUser,
      compactWidthDelegationsLen,
      ...encodedDelegationsAcc,
    );
  }

  const accessModeMask = cap.accessMode === "read" ? 0x80 : 0xc0;
  const delLenMask = getDelegationLengthMask(cap.delegations.length);
  const header = accessModeMask | delLenMask;

  const encodedNamespace = opts.encodingNamespace.encode(cap.namespaceKey);
  const encodedUser = opts.encodingUser.encode(cap.userKey);
  const encodedNamespaceSig = opts.encodingNamespaceSig.encode(
    cap.initialAuthorisation,
  );

  const compactWidthDelegationsLen = cap.delegations.length <= 58
    ? new Uint8Array(0)
    : encodeCompactWidth(
      cap.delegations.length,
    );

  let prevArea: Area<UserPublicKey> = {
    includedSubspaceId: ANY_SUBSPACE,
    pathPrefix: [],
    timeRange: {
      start: BigInt(0),
      end: OPEN_END,
    },
  };

  const encodedDelegationsAcc = [];

  for (const delegation of cap.delegations) {
    const [area, pk, sig] = delegation;

    const areaInAreaEncoded = encodeAreaInArea(
      {
        orderSubspace: opts.orderSubspace,
        pathScheme: opts.pathScheme,
        encodeSubspace: opts.encodingUser.encode,
      },
      area,
      prevArea,
    );

    const userPkEnc = opts.encodingUser.encode(pk);
    const sigEnc = opts.encodingUserSig.encode(sig);

    encodedDelegationsAcc.push(concat(areaInAreaEncoded, userPkEnc, sigEnc));

    prevArea = area;
  }

  return concat(
    new Uint8Array([header]),
    encodedNamespace,
    encodedUser,
    encodedNamespaceSig,
    compactWidthDelegationsLen,
    ...encodedDelegationsAcc,
  );
}

export function decodeMcCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  opts: {
    orderSubspace: TotalOrder<UserPublicKey>;
    pathScheme: PathScheme;
    encodingNamespace: EncodingScheme<NamespacePublicKey>;
    encodingUser: EncodingScheme<UserPublicKey>;
    encodingNamespaceSig: EncodingScheme<NamespaceSignature>;
    encodingUserSig: EncodingScheme<UserSignature>;
  },
  encoded: Uint8Array,
): McCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature
> {
  const [firstByte] = encoded;

  const accessModeBits = firstByte >> 6;

  const delLengthBits = firstByte & 0x3f;

  const delLengthCompactWidth = delLengthBits === 0x3f
    ? 8
    : delLengthBits === 0x3e
    ? 4
    : delLengthBits === 0x3d
    ? 2
    : delLengthBits === 0x3c
    ? 1
    : 0;

  if (accessModeBits < 0x2) {
    // Communal cap.
    const accessMode = accessModeBits === 0x0 ? "read" : "write";

    const namespace = opts.encodingNamespace.decode(encoded.subarray(1));

    const namespaceLength = opts.encodingNamespace.encodedLength(namespace);

    const user = opts.encodingUser.decode(
      encoded.subarray(1 + namespaceLength),
    );

    const userLength = opts.encodingUser.encodedLength(user);

    const delegationsLength = delLengthCompactWidth > 0
      ? decodeCompactWidth(
        encoded.subarray(
          1 + namespaceLength + userLength,
          1 + namespaceLength + userLength + delLengthCompactWidth,
        ),
      )
      : delLengthBits;

    let delPos = 1 + namespaceLength + userLength + delLengthCompactWidth;
    let remainingDelegations = Number(delegationsLength);

    let prevArea = subspaceArea(user);

    const delegations: Delegation<UserPublicKey, UserSignature>[] = [];

    while (remainingDelegations > 0) {
      const area = decodeAreaInArea(
        {
          decodeSubspaceId: opts.encodingUser.decode,
          pathScheme: opts.pathScheme,
        },
        encoded.subarray(delPos),
        prevArea,
      );

      const areaLength = encodeAreaInAreaLength(
        {
          encodeSubspaceIdLength: opts.encodingUser.encodedLength,
          orderSubspace: opts.orderSubspace,
          pathScheme: opts.pathScheme,
        },
        area,
        prevArea,
      );

      prevArea = area;

      const delegee = opts.encodingUser.decode(
        encoded.subarray(delPos + areaLength),
      );

      const delegeeLen = opts.encodingUser.encodedLength(delegee);

      const sig = opts.encodingUserSig.decode(
        encoded.subarray(delPos + areaLength + delegeeLen),
      );

      const sigLength = opts.encodingUserSig.encodedLength(sig);

      delegations.push([
        area,
        delegee,
        sig,
      ]);

      remainingDelegations -= 1;
      delPos += areaLength + delegeeLen + sigLength;
    }

    return {
      accessMode,
      namespaceKey: namespace,
      userKey: user,
      delegations,
    };
  }

  // Owned cap.
  const accessMode = accessModeBits === 0x2 ? "read" : "write";

  const namespace = opts.encodingNamespace.decode(encoded.subarray(1));

  const namespaceLength = opts.encodingNamespace.encodedLength(namespace);

  const user = opts.encodingUser.decode(
    encoded.subarray(1 + namespaceLength),
  );

  const userLength = opts.encodingUser.encodedLength(user);

  const initialAuthorisation = opts.encodingNamespaceSig.decode(
    encoded.subarray(1 + namespaceLength + userLength),
  );

  const initialAuthorisationLength = opts.encodingNamespaceSig.encodedLength(
    initialAuthorisation,
  );

  const delegationsLength = delLengthCompactWidth > 0
    ? decodeCompactWidth(
      encoded.subarray(
        1 + namespaceLength + userLength + initialAuthorisationLength,
        1 + namespaceLength + userLength + initialAuthorisationLength +
          delLengthCompactWidth,
      ),
    )
    : delLengthBits;

  let delPos = 1 + namespaceLength + userLength + initialAuthorisationLength +
    delLengthCompactWidth;
  let remainingDelegations = Number(delegationsLength);

  let prevArea: Area<UserPublicKey> = fullArea();

  const delegations: Delegation<UserPublicKey, UserSignature>[] = [];

  while (remainingDelegations > 0) {
    const area = decodeAreaInArea(
      {
        decodeSubspaceId: opts.encodingUser.decode,
        pathScheme: opts.pathScheme,
      },
      encoded.subarray(delPos),
      prevArea,
    );

    const areaLength = encodeAreaInAreaLength(
      {
        encodeSubspaceIdLength: opts.encodingUser.encodedLength,
        orderSubspace: opts.orderSubspace,
        pathScheme: opts.pathScheme,
      },
      area,
      prevArea,
    );

    prevArea = area;

    const delegee = opts.encodingUser.decode(
      encoded.subarray(delPos + areaLength),
    );

    const delegeeLen = opts.encodingUser.encodedLength(delegee);

    const sig = opts.encodingUserSig.decode(
      encoded.subarray(delPos + areaLength + delegeeLen),
    );

    const sigLength = opts.encodingUserSig.encodedLength(sig);

    delegations.push([
      area,
      delegee,
      sig,
    ]);

    remainingDelegations -= 1;
    delPos = delPos + areaLength + delegeeLen + sigLength;
  }

  return {
    accessMode,
    namespaceKey: namespace,
    initialAuthorisation,
    userKey: user,
    delegations,
  };
}

export async function decodeStreamMcCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(opts: {
  orderSubspace: TotalOrder<UserPublicKey>;
  pathScheme: PathScheme;
  encodingNamespace: EncodingScheme<NamespacePublicKey>;
  encodingUser: EncodingScheme<UserPublicKey>;
  encodingNamespaceSig: EncodingScheme<NamespaceSignature>;
  encodingUserSig: EncodingScheme<UserSignature>;
}, bytes: GrowingBytes): Promise<
  McCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >
> {
  await bytes.nextAbsolute(1);

  const [firstByte] = bytes.array;

  const accessModeBits = firstByte >> 6;

  const delLengthBits = firstByte & 0x3f;

  const delLengthCompactWidth = delLengthBits === 0x3f
    ? 8
    : delLengthBits === 0x3e
    ? 4
    : delLengthBits === 0x3d
    ? 2
    : delLengthBits === 0x3c
    ? 1
    : 0;

  if (accessModeBits < 0x2) {
    // Communal cap.
    const accessMode = accessModeBits === 0x0 ? "read" : "write";

    bytes.prune(1);

    const namespace = await opts.encodingNamespace.decodeStream(bytes);

    const user = await opts.encodingUser.decodeStream(bytes);

    let delegationsLength;

    if (delLengthCompactWidth > 0) {
      await bytes.nextAbsolute(delLengthCompactWidth);

      delegationsLength = decodeCompactWidth(
        bytes.array.subarray(0, delLengthCompactWidth),
      );

      bytes.prune(4);
    } else {
      delegationsLength = delLengthBits;
    }

    let remainingDelegations = Number(delegationsLength);

    let prevArea: Area<UserPublicKey> = subspaceArea(user);

    const delegations: Delegation<UserPublicKey, UserSignature>[] = [];

    while (remainingDelegations > 0) {
      const area = await decodeStreamAreaInArea(
        {
          decodeStreamSubspace: opts.encodingUser.decodeStream,
          pathScheme: opts.pathScheme,
        },
        bytes,
        prevArea,
      );

      prevArea = area;

      const delegee = await opts.encodingUser.decodeStream(bytes);

      const sig = await opts.encodingUserSig.decodeStream(bytes);

      delegations.push([
        area,
        delegee,
        sig,
      ]);

      remainingDelegations -= 1;
    }

    return {
      accessMode,
      namespaceKey: namespace,
      userKey: user,
      delegations,
    };
  }

  // Owned cap.
  const accessMode = accessModeBits === 0x2 ? "read" : "write";

  bytes.prune(1);

  const namespace = await opts.encodingNamespace.decodeStream(bytes);

  const user = await opts.encodingUser.decodeStream(bytes);

  const initialAuthorisation = await opts.encodingNamespaceSig.decodeStream(
    bytes,
  );

  let delegationsLength;

  if (delLengthCompactWidth > 0) {
    await bytes.nextAbsolute(delLengthCompactWidth);

    delegationsLength = decodeCompactWidth(
      bytes.array.subarray(0, delLengthCompactWidth),
    );

    bytes.prune(delLengthCompactWidth);
  } else {
    delegationsLength = delLengthBits;
  }

  let remainingDelegations = Number(delegationsLength);

  let prevArea: Area<UserPublicKey> = fullArea();

  const delegations: Delegation<UserPublicKey, UserSignature>[] = [];

  while (remainingDelegations > 0) {
    const area = await decodeStreamAreaInArea(
      {
        decodeStreamSubspace: opts.encodingUser.decodeStream,
        pathScheme: opts.pathScheme,
      },
      bytes,
      prevArea,
    );

    prevArea = area;

    const delegee = await opts.encodingUser.decodeStream(bytes);

    const sig = await opts.encodingUserSig.decodeStream(bytes);

    delegations.push([
      area,
      delegee,
      sig,
    ]);

    remainingDelegations -= 1;
  }

  return {
    accessMode,
    initialAuthorisation,
    namespaceKey: namespace,
    userKey: user,
    delegations,
  };
}

export function encodeSubspaceCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  opts: {
    omitNamespace?: boolean;
    orderSubspace: TotalOrder<UserPublicKey>;
    pathScheme: PathScheme;
    encodingNamespace: EncodingScheme<NamespacePublicKey>;
    encodingUser: EncodingScheme<UserPublicKey>;
    encodingNamespaceSig: EncodingScheme<NamespaceSignature>;
    encodingUserSig: EncodingScheme<UserSignature>;
  },
  cap: McSubspaceCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): Uint8Array {
  const header = getDelegationLengthMask(cap.delegations.length) | 0xc0;

  const delLength = cap.delegations.length <= 59
    ? new Uint8Array(0)
    : encodeCompactWidth(cap.delegations.length);

  const namespaceEncoded = opts.omitNamespace
    ? new Uint8Array()
    : opts.encodingNamespace.encode(cap.namespaceKey);

  const userEncoded = opts.encodingUser.encode(cap.userKey);

  const sigEncoded = opts.encodingNamespaceSig.encode(cap.initialAuthorisation);

  const encodedDelegationsAcc = [];

  for (const delegation of cap.delegations) {
    const [pk, sig] = delegation;

    const userPkEnc = opts.encodingUser.encode(pk);
    const sigEnc = opts.encodingUserSig.encode(sig);

    encodedDelegationsAcc.push(concat(userPkEnc, sigEnc));
  }

  return concat(
    new Uint8Array([header]),
    namespaceEncoded,
    userEncoded,
    sigEncoded,
    delLength,
    ...encodedDelegationsAcc,
  );
}

export function decodeSubspaceCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  opts: {
    knownNamespace?: NamespacePublicKey;
    orderSubspace: TotalOrder<UserPublicKey>;
    pathScheme: PathScheme;
    encodingNamespace: EncodingScheme<NamespacePublicKey>;
    encodingUser: EncodingScheme<UserPublicKey>;
    encodingNamespaceSig: EncodingScheme<NamespaceSignature>;
    encodingUserSig: EncodingScheme<UserSignature>;
  },
  encoded: Uint8Array,
): McSubspaceCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature
> {
  const [firstByte] = encoded;

  const delLengthBits = firstByte & 0x3f;

  const delLengthCompactWidth = delLengthBits === 0x3f
    ? 8
    : delLengthBits === 0x3e
    ? 4
    : delLengthBits === 0x3d
    ? 2
    : delLengthBits === 0x3c
    ? 1
    : 0;

  const namespace = opts.knownNamespace ||
    opts.encodingNamespace.decode(encoded.subarray(1));

  const namespaceLength = opts.knownNamespace
    ? 0
    : opts.encodingNamespace.encodedLength(namespace);

  const user = opts.encodingUser.decode(
    encoded.subarray(1 + namespaceLength),
  );

  const userLength = opts.encodingUser.encodedLength(user);

  const sig = opts.encodingNamespaceSig.decode(
    encoded.subarray(1 + namespaceLength + userLength),
  );

  const sigLength = opts.encodingNamespaceSig.encodedLength(sig);

  const delegationsLength = delLengthCompactWidth > 0
    ? decodeCompactWidth(
      encoded.subarray(
        1 + namespaceLength + userLength + sigLength,
        1 + namespaceLength + userLength + sigLength + delLengthCompactWidth,
      ),
    )
    : delLengthBits;

  let delPos = 1 + namespaceLength + userLength + sigLength +
    delLengthCompactWidth;
  let remainingDelegations = Number(delegationsLength);

  const delegations: [UserPublicKey, UserSignature][] = [];

  while (remainingDelegations > 0) {
    const delegee = opts.encodingUser.decode(
      encoded.subarray(delPos),
    );

    const delegeeLen = opts.encodingUser.encodedLength(delegee);

    const sig = opts.encodingUserSig.decode(
      encoded.subarray(delPos + delegeeLen),
    );

    const sigLength = opts.encodingUserSig.encodedLength(sig);

    delegations.push([
      delegee,
      sig,
    ]);

    remainingDelegations -= 1;
    delPos += delegeeLen + sigLength;
  }

  return {
    namespaceKey: namespace,
    userKey: user,
    initialAuthorisation: sig,
    delegations,
  };
}

export async function decodeStreamSubspaceCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  opts: {
    knownNamespace?: NamespacePublicKey;
    orderSubspace: TotalOrder<UserPublicKey>;
    pathScheme: PathScheme;
    encodingNamespace: EncodingScheme<NamespacePublicKey>;
    encodingUser: EncodingScheme<UserPublicKey>;
    encodingNamespaceSig: EncodingScheme<NamespaceSignature>;
    encodingUserSig: EncodingScheme<UserSignature>;
  },
  bytes: GrowingBytes,
): Promise<
  McSubspaceCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >
> {
  await bytes.nextAbsolute(1);

  const [firstByte] = bytes.array;

  const delLengthBits = firstByte & 0x3f;

  const delLengthCompactWidth = delLengthBits === 0x3f
    ? 8
    : delLengthBits === 0x3e
    ? 4
    : delLengthBits === 0x3d
    ? 2
    : delLengthBits === 0x3c
    ? 1
    : 0;

  bytes.prune(1);

  const namespace = opts.knownNamespace ||
    await opts.encodingNamespace.decodeStream(bytes);

  const user = await opts.encodingUser.decodeStream(bytes);

  const initialAuthorisation = await opts.encodingNamespaceSig.decodeStream(
    bytes,
  );

  let delegationsLength;

  if (delLengthCompactWidth > 0) {
    await bytes.nextAbsolute(delLengthCompactWidth);

    delegationsLength = decodeCompactWidth(
      bytes.array.subarray(0, delLengthCompactWidth),
    );

    bytes.prune(delLengthCompactWidth);
  } else {
    delegationsLength = delLengthBits;
  }

  let remainingDelegations = Number(delegationsLength);

  const delegations: [UserPublicKey, UserSignature][] = [];

  while (remainingDelegations > 0) {
    const delegee = await opts.encodingUser.decodeStream(bytes);

    const sig = await opts.encodingUserSig.decodeStream(bytes);

    delegations.push([
      delegee,
      sig,
    ]);

    remainingDelegations -= 1;
  }

  return {
    initialAuthorisation,
    namespaceKey: namespace,
    userKey: user,
    delegations,
  };
}
