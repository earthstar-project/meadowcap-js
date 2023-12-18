import { ANY_SUBSPACE, Area, OPEN_END } from "../../deps.ts";
import { IsCommunalFn } from "../meadowcap/types.ts";
import { Capability, CommunalCapability, OwnedCapability } from "./types.ts";
import { isCommunalCap } from "./util.ts";

export function getGrantedNamespace<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap: Capability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): NamespacePublicKey {
  return cap.namespaceKey;
}

export function getReceiver<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap: Capability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): UserPublicKey {
  if (cap.delegations.length === 0) {
    return cap.userKey;
  }

  const last = cap.delegations[cap.delegations.length - 1];

  return last[1];
}

export function getGrantedAreaCommunal<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
>(
  cap: CommunalCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >,
): Area<UserPublicKey> {
  if (cap.delegations.length === 0) {
    return {
      pathPrefix: [],
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
      includedSubspaceId: cap.userKey,
    };
  }

  const last = cap.delegations[cap.delegations.length - 1];

  return last[0];
}

export function getGrantedAreaOwned<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap: OwnedCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): Area<UserPublicKey> {
  if (cap.delegations.length === 0) {
    return {
      pathPrefix: [],
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
      includedSubspaceId: ANY_SUBSPACE,
    };
  }

  const last = cap.delegations[cap.delegations.length - 1];

  return last[0];
}

export function getPrevCap<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
  Cap extends Capability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
>(
  cap: Cap,
): Cap {
  if (cap.delegations.length === 0) {
    throw new Error("Tried to get previous cap for cap with no delegations.");
  }

  return {
    ...cap,
    delegations: cap.delegations.slice(0, cap.delegations.length - 1),
  };
}
