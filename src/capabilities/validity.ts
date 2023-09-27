import { concat } from "$std/bytes/concat.ts";
import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import { merge3dProducts } from "../products/products.ts";
import { ThreeDimensionalProduct } from "../products/types.ts";
import { encodeCapability } from "./encoding.ts";
import {
  getAccessMode,
  getDelegationLimit,
  getGrantedProduct,
  getNamespace,
  getReceiver,
} from "./semantics.ts";
import { AccessMode, Capability, IsCommunalFn, VerifyFn } from "./types.ts";

export async function isCapabilityValid<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
>(
  opts: {
    orderSubspace: TotalOrder<SubspacePublicKey>;
    predecessorSubspace: PredecessorFn<SubspacePublicKey>;
    successorSubspace: SuccessorFn<SubspacePublicKey>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspacePublicKey,
      exclusive: SubspacePublicKey,
    ) => boolean;
    isCommunal: IsCommunalFn<NamespacePublicKey>;
    minimalSubspaceKey: SubspacePublicKey;
    encodeNamespace: (namespace: NamespacePublicKey) => Uint8Array;
    encodeSubspace: (subspace: SubspacePublicKey) => Uint8Array;
    encodeAuthorPublicKey: (author: AuthorPublicKey) => Uint8Array;
    encodeAuthorSignature: (signature: AuthorSignature) => Uint8Array;
    encodePathLength: (length: number) => Uint8Array;
    verify: VerifyFn<
      NamespacePublicKey,
      SubspacePublicKey,
      AuthorPublicKey,
      AuthorSignature
    >;
    hashEncodedCapability: (encodedCap: Uint8Array) => Promise<Uint8Array>;
  },
  cap: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >,
): Promise<boolean> {
  switch (cap.kind) {
    case "source": {
      // If the namespace is communal, it's always valid.
      if (opts.isCommunal(cap.namespaceId)) {
        return true;
      }

      // Otherwise the subspace must be the minimal subspace key.
      return opts.orderSubspace(cap.subspaceId, opts.minimalSubspaceKey) === 0;
    }
    case "delegation": {
      // The delegation limit must be 255, or the delegation limit strictly less than its parent's.
      if (
        cap.delegationLimit > 255 ||
        cap.delegationLimit >= getDelegationLimit(cap.parent)
      ) {
        return false;
      }

      // Verify that the authorisation for this delegation is authentic.
      if (
        opts.verify(
          getReceiver(cap.parent, opts.isCommunal),
          cap.authorisation,
          concat(
            await opts.hashEncodedCapability(encodeCapability({
              encodeAuthorPublicKey: opts.encodeAuthorPublicKey,
              encodeNamespace: opts.encodeNamespace,
              encodeAuthorSignature: opts.encodeAuthorSignature,
              encodePathLength: opts.encodePathLength,
              encodeSubspace: opts.encodeSubspace,
              isCommunalFn: opts.isCommunal,
              isInclusiveSmallerSubspace: opts.isInclusiveSmallerSubspace,
              orderSubspace: opts.orderSubspace,
              predecessorSubspace: opts.predecessorSubspace,
            }, cap.parent)),
            new Uint8Array([cap.delegationLimit]),
            opts.encodeAuthorPublicKey(cap.delegee),
          ),
        ) === false
      ) {
        return false;
      }

      // Parent capability is valid
      if (await isCapabilityValid(opts, cap.parent) === false) {
        return false;
      }

      break;
    }
    case "restriction": {
      // All product dimensions must have strictly less than 2^64 ranges.
      if (
        cap.product[0].length >= (2 ** 64) ||
        cap.product[1].length >= (2 ** 64) ||
        cap.product[2].length >= (2 ** 64)
      ) {
        return false;
      }

      // Parent capability is valid.
      if (await isCapabilityValid(opts, cap.parent) === false) {
        return false;
      }

      break;
    }
    case "merge": {
      // Check all component access modes are the same.
      let accessMode: AccessMode | null = null;

      for (const component of cap.components) {
        if (accessMode === null) {
          accessMode = getAccessMode(component, opts.isCommunal);
          continue;
        }

        if (accessMode !== getAccessMode(component, opts.isCommunal)) {
          return false;
        }
      }

      // Check all component access receivers are the same.
      let receiver:
        | NamespacePublicKey
        | SubspacePublicKey
        | AuthorPublicKey
        | null = null;

      for (const component of cap.components) {
        if (receiver === null) {
          receiver = getReceiver(component, opts.isCommunal);
          continue;
        }

        if (receiver !== getReceiver(component, opts.isCommunal)) {
          console.log({
            receiver,
            and: getReceiver(component, opts.isCommunal),
            component,
            first: cap.components[0],
          });

          return false;
        }
      }

      // Check all component namespaces are the same.
      let grantedNamespace: NamespacePublicKey | null = null;

      for (const component of cap.components) {
        if (grantedNamespace === null) {
          grantedNamespace = getNamespace(component);
          continue;
        }

        if (grantedNamespace !== getNamespace(component)) {
          return false;
        }
      }

      // Check all granted products are pairwise mergeable.
      const grantedProducts: ThreeDimensionalProduct<SubspacePublicKey>[] = [];

      for (const component of cap.components) {
        grantedProducts.push(getGrantedProduct({
          isCommunalFn: opts.isCommunal,
          minimalSubspaceKey: opts.minimalSubspaceKey,
          orderSubspace: opts.orderSubspace,
          successorSubspace: opts.successorSubspace,
        }, component));
      }

      const merged = merge3dProducts({
        orderSubspace: opts.orderSubspace,
      }, ...grantedProducts);

      if (
        merged[0].length === 0 && merged[1].length === 0 &&
        merged[2].length === 0
      ) {
        return false;
      }

      // Check all components are valid
      for (const component of cap.components) {
        if (await isCapabilityValid(opts, component) === false) {
          return false;
        }
      }
    }
  }

  return true;
}
