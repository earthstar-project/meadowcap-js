import { concat } from "$std/bytes/concat.ts";
import { IsCommunalFn } from "../meadowcap/types.ts";
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
import { AccessMode, Capability } from "./types.ts";
import { isCommunalDelegationCap } from "./util.ts";

export async function isCapabilityValid<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
>(
  opts: {
    orderSubspace: TotalOrder<SubspacePublicKey>;
    predecessorSubspace: PredecessorFn<SubspacePublicKey>;
    successorSubspace: SuccessorFn<SubspacePublicKey>;
    isInclusiveSmallerSubspace: (
      inclusive: SubspacePublicKey,
      exclusive: SubspacePublicKey,
    ) => boolean;
    isCommunalFn: IsCommunalFn<NamespacePublicKey>;
    minimalSubspaceKey: SubspacePublicKey;
    encodeNamespacePublicKey: (key: NamespacePublicKey) => Uint8Array;
    encodeNamespaceSignature: (signature: NamespaceSignature) => Uint8Array;
    encodeSubspacePublicKey: (key: SubspacePublicKey) => Uint8Array;
    encodeSubspaceSignature: (signature: SubspaceSignature) => Uint8Array;

    encodePathLength: (length: number) => Uint8Array;
    verifySignatureNamespace: (
      publicKey: NamespacePublicKey,
      signature: NamespaceSignature,
      bytestring: Uint8Array,
    ) => boolean;
    verifySignatureSubspace: (
      publicKey: SubspacePublicKey,
      signature: SubspaceSignature,
      bytestring: Uint8Array,
    ) => boolean;

    hashCapability: (encodedCap: Uint8Array) => Promise<Uint8Array>;
  },
  cap: Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >,
): Promise<boolean> {
  switch (cap.kind) {
    case "source": {
      // If the namespace is communal, it's always valid.
      if (opts.isCommunalFn(cap.namespaceId)) {
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

      const hashedParent = await opts.hashCapability(encodeCapability({
        encodeNamespacePublicKey: opts.encodeNamespacePublicKey,
        encodeNamespaceSignature: opts.encodeNamespaceSignature,
        encodeSubspacePublicKey: opts.encodeSubspacePublicKey,
        encodeSubspaceSignature: opts.encodeSubspaceSignature,
        encodePathLength: opts.encodePathLength,
        isCommunalFn: opts.isCommunalFn,
        isInclusiveSmallerSubspace: opts.isInclusiveSmallerSubspace,
        orderSubspace: opts.orderSubspace,
        predecessorSubspace: opts.predecessorSubspace,
      }, cap.parent));

      // If the delegation capability is for a communal namespace
      // use the subspace signature scheme
      // otherwise use the namespace signature scheme
      if (isCommunalDelegationCap(cap, opts.isCommunalFn)) {
        const isValid = opts.verifySignatureSubspace(
          getReceiver(cap.parent, opts.isCommunalFn) as SubspacePublicKey,
          cap.authorisation,
          concat(
            hashedParent,
            new Uint8Array([cap.delegationLimit]),
            opts.encodeSubspacePublicKey(cap.delegee),
          ),
        );

        if (!isValid) {
          return false;
        }
      } else {
        const isValid = opts.verifySignatureNamespace(
          getReceiver(cap.parent, opts.isCommunalFn) as NamespacePublicKey,
          cap.authorisation,
          concat(
            hashedParent,
            new Uint8Array([cap.delegationLimit]),
            opts.encodeNamespacePublicKey(cap.delegee),
          ),
        );

        if (!isValid) {
          return false;
        }
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
          accessMode = getAccessMode(component);
          continue;
        }

        if (accessMode !== getAccessMode(component)) {
          return false;
        }
      }

      // Check all component access receivers are the same.
      let receiver:
        | NamespacePublicKey
        | SubspacePublicKey
        | null = null;

      for (const component of cap.components) {
        if (receiver === null) {
          receiver = getReceiver(component, opts.isCommunalFn);
          continue;
        }

        if (receiver !== getReceiver(component, opts.isCommunalFn)) {
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
          isCommunalFn: opts.isCommunalFn,
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
