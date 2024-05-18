import { ANY_SUBSPACE, Area, OPEN_END } from "@earthstar/willow-utils";
import {
  CommunalCapability,
  McCapability,
  McSubspaceCapability,
  OwnedCapability,
} from "./types.ts";

/** Get the granted namespace of a capability. */
export function getGrantedNamespace<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap: McCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): NamespacePublicKey {
  return cap.namespaceKey;
}

/** Get the receiver of a capability. */
export function getReceiver<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap: McCapability<
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

/** Returns The granted area of a communal capability. */
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

  const [area] = cap.delegations[cap.delegations.length - 1];

  return area;
}

/** Returns the granted area of an owned capability. */
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
  Cap extends McCapability<
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

// Subspace capabilities

/** Get the receiver of a subspace capability. */
export function getReceiverSubspaceCap<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap: McSubspaceCapability<
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

  return last[0];
}

/** Get the granted namespace of a capability. */
export function getGrantedNamespaceSubspaceCap<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap: McSubspaceCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
): NamespacePublicKey {
  return cap.namespaceKey;
}

export function getPrevCapSubspace<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
  Cap extends McSubspaceCapability<
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
