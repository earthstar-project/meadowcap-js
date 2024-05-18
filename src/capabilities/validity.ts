import {
  areaIsIncluded,
  KeypairScheme,
  PathScheme,
} from "@earthstar/willow-utils";
import { UserScheme } from "../meadowcap/types.ts";
import {
  handoverCommunal,
  handoverOwned,
  handoverSubspace,
} from "./encoding.ts";
import {
  getGrantedAreaCommunal,
  getGrantedAreaOwned,
  getPrevCap,
  getPrevCapSubspace,
  getReceiver,
  getReceiverSubspaceCap,
} from "./semantics.ts";
import {
  CommunalCapability,
  McSubspaceCapability,
  OwnedCapability,
} from "./types.ts";
import { concat } from "@std/bytes";

/** Returns whether a communal capability is valid. */
export async function isValidCapCommunal<
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
  cap: CommunalCapability<NamespacePublicKey, UserPublicKey, UserSignature>,
): Promise<boolean> {
  if (cap.delegations.length === 0) {
    return Promise.resolve(true);
  }

  const [newArea, newUser, newSignature] =
    cap.delegations[cap.delegations.length - 1];
  const prevCap = getPrevCap(cap);

  if (await isValidCapCommunal(opts, prevCap) === false) {
    return false;
  }

  const prevGrantedArea = getGrantedAreaCommunal(prevCap);

  if (
    areaIsIncluded(opts.userScheme.order, newArea, prevGrantedArea) === false
  ) {
    return false;
  }

  const prevReceiver = getReceiver(prevCap);

  const handover = handoverCommunal(opts, prevCap, newArea, newUser);

  return opts.userScheme.signatures.verify(
    prevReceiver,
    newSignature,
    handover,
  );
}

/** Returns whether an owned capability is valid. */
export async function isValidCapOwned<
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
  cap: OwnedCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): Promise<boolean> {
  if (cap.delegations.length === 0) {
    const accessModeByte = new Uint8Array([
      cap.accessMode === "read" ? 0x2 : 0x3,
    ]);

    const message = concat(
      [accessModeByte, opts.userScheme.encodings.publicKey.encode(cap.userKey)],
    );

    return opts.namespaceScheme.signatures.verify(
      cap.namespaceKey,
      cap.initialAuthorisation,
      message,
    );
  }

  const prevCap = getPrevCap(cap);

  if (await isValidCapOwned(opts, prevCap) === false) {
    return false;
  }

  const [newArea, newUser, newSignature] =
    cap.delegations[cap.delegations.length - 1];

  const prevGrantedArea = getGrantedAreaOwned(prevCap);

  if (
    areaIsIncluded(opts.userScheme.order, newArea, prevGrantedArea) === false
  ) {
    return false;
  }

  const prevReceiver = getReceiver(prevCap);

  const handover = handoverOwned(opts, prevCap, newArea, newUser);

  return opts.userScheme.signatures.verify(
    prevReceiver,
    newSignature,
    handover,
  );
}

export async function isValidCapSubspace<
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
  cap: McSubspaceCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): Promise<boolean> {
  if (cap.delegations.length === 0) {
    const message = concat(
      [
        new Uint8Array([0x2]),
        opts.userScheme.encodings.publicKey.encode(cap.userKey),
      ],
    );

    return opts.namespaceScheme.signatures.verify(
      cap.namespaceKey,
      cap.initialAuthorisation,
      message,
    );
  }

  const prevCap = getPrevCapSubspace(cap);

  if (await isValidCapSubspace(opts, prevCap) === false) {
    return Promise.resolve(false);
  }

  const [newUser, newSignature] = cap.delegations[cap.delegations.length - 1];

  const prevReceiver = getReceiverSubspaceCap(prevCap);

  const handover = handoverSubspace(opts, prevCap, newUser);

  return opts.userScheme.signatures.verify(
    prevReceiver,
    newSignature,
    handover,
  );
}
