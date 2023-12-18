import {
  areaIsIncluded,
  concat,
  KeypairScheme,
  PathScheme,
} from "../../deps.ts";
import { UserScheme } from "../parameters/types.ts";
import { handoverCommunal, handoverOwned } from "./encoding.ts";
import {
  getGrantedAreaCommunal,
  getGrantedAreaOwned,
  getPrevCap,
} from "./semantics.ts";
import { CommunalCapability, OwnedCapability } from "./types.ts";

export function isValidCapCommunal<
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
  } else if (cap.delegations.length === 1) {
    const prevArea = getGrantedAreaCommunal(cap);

    const [area, user, sig] = cap.delegations[0];

    if (!areaIsIncluded(opts.userScheme.order, area, prevArea)) {
      return Promise.resolve(false);
    }

    const handover = handoverCommunal(opts, getPrevCap(cap), area, user);

    return opts.userScheme.signatureScheme.verify(user, sig, handover);
  }

  const [prevArea] = cap.delegations[cap.delegations.length - 2];
  const [area, receiver, sig] = cap.delegations[cap.delegations.length - 1];

  if (!areaIsIncluded(opts.userScheme.order, area, prevArea)) {
    return Promise.resolve(false);
  }

  const handover = handoverCommunal(opts, getPrevCap(cap), area, receiver);

  return opts.userScheme.signatureScheme.verify(receiver, sig, handover);
}

export function isValidCapOwned<
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
      cap.accessMode === "read" ? 0x0 : 0x1,
    ]);

    const message = concat(
      accessModeByte,
      opts.userScheme.encodingScheme.publicKey.encode(cap.userKey),
    );

    return opts.namespaceScheme.signatureScheme.verify(
      cap.namespaceKey,
      cap.initialAuthorisation,
      message,
    );
  }

  const prevCap = getPrevCap(cap);

  if (prevCap.delegations.length === 0) {
    const [area, receiver, sig] = cap.delegations[0];

    const prevArea = getGrantedAreaOwned(prevCap);

    if (!areaIsIncluded(opts.userScheme.order, area, prevArea)) {
      return Promise.resolve(false);
    }

    const handover = handoverOwned(opts, prevCap, area, receiver);

    return opts.userScheme.signatureScheme.verify(receiver, sig, handover);
  }

  const [prevArea] = cap.delegations[cap.delegations.length - 2];
  const [area, receiver, sig] = cap.delegations[cap.delegations.length - 1];

  if (!areaIsIncluded(opts.userScheme.order, area, prevArea)) {
    return Promise.resolve(false);
  }

  const handover = handoverOwned(opts, prevCap, area, receiver);

  return opts.userScheme.signatureScheme.verify(receiver, sig, handover);
}
