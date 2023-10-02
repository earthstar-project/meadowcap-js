import { IsCommunalFn } from "../meadowcap/types.ts";
import { getNamespace } from "./semantics.ts";
import { DelegationCap } from "./types.ts";

// Used to help navigate some of the type-checking palaver which the isCommunal function inevitably brings about.
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

// Same as above.
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
