import { CommunalCapability, OwnedCapability } from "./types.ts";

export function isCommunalCap<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
>(
  cap:
    | CommunalCapability<NamespacePublicKey, UserPublicKey, UserSignature>
    | OwnedCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
): cap is CommunalCapability<NamespacePublicKey, UserPublicKey, UserSignature> {
  if (
    "initialAuthorisation" in cap === false
  ) {
    return true;
  }

  return false;
}
