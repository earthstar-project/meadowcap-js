import {
  CommunalCapability,
  McSubspaceCapability,
  OwnedCapability,
} from "./types.ts";
import { getGrantedAreaCommunal, getGrantedAreaOwned } from "./semantics.ts";
import {
  Area,
  concat,
  encodeAreaInArea,
  KeypairScheme,
  PathScheme,
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

    const namespace = opts.namespaceScheme.encodingScheme.publicKey.encode(
      prevCap.namespaceKey,
    );

    const areaInArea = encodeAreaInArea(
      {
        pathScheme: opts.pathScheme,
        subspaceIdEncodingScheme: opts.userScheme.encodingScheme.publicKey,
        orderSubspace: opts.userScheme.order,
      },
      newArea,
      getGrantedAreaCommunal(prevCap),
    );

    const newPubKey = opts.userScheme.encodingScheme.publicKey.encode(newUser);

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
      subspaceIdEncodingScheme: opts.userScheme.encodingScheme.publicKey,
      orderSubspace: opts.userScheme.order,
    },
    newArea,
    prevArea,
  );

  const userSignature = opts.userScheme.encodingScheme.signature.encode(
    prevSig,
  );

  const newPubKey = opts.userScheme.encodingScheme.publicKey.encode(newUser);

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
        subspaceIdEncodingScheme: opts.userScheme.encodingScheme.publicKey,
        orderSubspace: opts.userScheme.order,
      },
      newArea,
      prevArea,
    );

    const userSignature = opts.namespaceScheme.encodingScheme.signature.encode(
      prevCap.initialAuthorisation,
    );

    const userPublicKey = opts.userScheme.encodingScheme.publicKey.encode(
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
      subspaceIdEncodingScheme: opts.userScheme.encodingScheme.publicKey,
      orderSubspace: opts.userScheme.order,
    },
    newArea,
    prevArea,
  );

  const userSignature = opts.userScheme.encodingScheme.signature.encode(
    prevSig,
  );

  const userPublicKey = opts.userScheme.encodingScheme.publicKey.encode(
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
    const userSignature = opts.namespaceScheme.encodingScheme.signature.encode(
      prevCap.initialAuthorisation,
    );

    const userPublicKey = opts.userScheme.encodingScheme.publicKey.encode(
      newUser,
    );

    return concat(
      userSignature,
      userPublicKey,
    );
  }

  const [, prevSig] = prevCap.delegations[prevCap.delegations.length - 1];

  const userSignature = opts.userScheme.encodingScheme.signature.encode(
    prevSig,
  );

  return concat(
    userSignature,
    opts.userScheme.encodingScheme.publicKey.encode(
      newUser,
    ),
  );
}
