import { IsCommunalFn } from "../meadowcap/types.ts";
import { getNamespace } from "./semantics.ts";
import { DelegationCap } from "./types.ts";

export function isCommunalDelegationCap<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
>(
  cap:
    | DelegationCap<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature,
      NamespacePublicKey,
      NamespaceSignature
    >
    | DelegationCap<
      NamespacePublicKey,
      NamespaceSignature,
      SubspacePublicKey,
      SubspaceSignature,
      SubspacePublicKey,
      SubspaceSignature
    >,
  isCommunal: IsCommunalFn<NamespacePublicKey>,
): cap is DelegationCap<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
  SubspacePublicKey,
  SubspaceSignature
> {
  const namespace = getNamespace(cap);

  if (isCommunal(namespace)) {
    return true;
  }

  return false;
}

export function isSubspaceDelegee<
  NamespacePublicKey,
  SubspacePublicKey,
>(
  delegee: NamespacePublicKey | SubspacePublicKey,
  isCommunal: boolean,
): delegee is SubspacePublicKey {
  if (isCommunal) {
    return true;
  }

  return false;
}
