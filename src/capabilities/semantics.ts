import {
  decanoniciseProduct,
  intersect3dProducts,
  merge3dProducts,
  SuccessorFn,
  ThreeDimensionalProduct,
  TotalOrder,
} from "../../deps.ts";
import { IsCommunalFn } from "../meadowcap/types.ts";
import { AccessMode, Capability } from "./types.ts";

/** Returns the public key belonging to the receiver of a capability.
 *
 * Will be of type `SubspacePublicKey` if the namespace is communal, and of `NamespacePublicKey` if not.
 */
export function getReceiver<
  NamespacePublicKey,
  NamespaceSignature,
  SubspacePublicKey,
  SubspaceSignature,
>(
  cap: Capability<
    NamespacePublicKey,
    NamespaceSignature,
    SubspacePublicKey,
    SubspaceSignature
  >,
  isCommunalFn: IsCommunalFn<NamespacePublicKey>,
): NamespacePublicKey | SubspacePublicKey {
  switch (cap.kind) {
    case "source": {
      if (isCommunalFn(cap.namespaceId)) {
        return cap.subspaceId;
      }

      return cap.namespaceId;
    }
    case "delegation": {
      return cap.delegee;
    }
    case "restriction": {
      return getReceiver(cap.parent, isCommunalFn);
    }
    case "merge": {
      return getReceiver(cap.components[0], isCommunalFn);
    }
  }
}

/** Returns the access mode (read or write) of a given capability. */
export function getAccessMode<
  NamespacePublicKey,
  NamespaceSecretKey,
  SubspacePublicKey,
  SubspaceSecretKey,
>(
  cap: Capability<
    NamespacePublicKey,
    NamespaceSecretKey,
    SubspacePublicKey,
    SubspaceSecretKey
  >,
): AccessMode {
  switch (cap.kind) {
    case "source": {
      return cap.accessMode;
    }
    case "delegation": {
      return getAccessMode(cap.parent);
    }
    case "restriction": {
      return getAccessMode(cap.parent);
    }
    case "merge": {
      return getAccessMode(cap.components[0]);
    }
  }
}

/** Returns the granted namespace of a capability. */
export function getNamespace<
  NamespacePublicKey,
  NamespaceSecretKey,
  SubspacePublicKey,
  SubspaceSecretKey,
>(
  cap: Capability<
    NamespacePublicKey,
    NamespaceSecretKey,
    SubspacePublicKey,
    SubspaceSecretKey
  >,
): NamespacePublicKey {
  switch (cap.kind) {
    case "source": {
      return cap.namespaceId;
    }
    case "delegation": {
      return getNamespace(
        cap.parent,
      );
    }
    case "restriction": {
      return getNamespace(
        cap.parent,
      );
    }
    case "merge": {
      return getNamespace(cap.components[0]);
    }
  }
}

/** Returns the granted product of a capability. */
export function getGrantedProduct<
  NamespacePublicKey,
  NamespaceSecretKey,
  SubspacePublicKey,
  SubspaceSecretKey,
>(
  {
    isCommunalFn,
    minimalSubspaceKey,
    orderSubspace,
    successorSubspace,
    maxPathLength,
  }: {
    isCommunalFn: IsCommunalFn<NamespacePublicKey>;
    minimalSubspaceKey: SubspacePublicKey;
    orderSubspace: TotalOrder<SubspacePublicKey>;
    successorSubspace: SuccessorFn<SubspacePublicKey>;
    maxPathLength: number;
  },
  cap: Capability<
    NamespacePublicKey,
    NamespaceSecretKey,
    SubspacePublicKey,
    SubspaceSecretKey
  >,
): ThreeDimensionalProduct<SubspacePublicKey> {
  switch (cap.kind) {
    case "source": {
      if (isCommunalFn(cap.namespaceId)) {
        return [
          [{
            kind: "closed_exclusive",
            start: minimalSubspaceKey,
            end: successorSubspace(minimalSubspaceKey),
          }],
          [{ kind: "open", start: new Uint8Array(0) }],
          [{ kind: "open", start: BigInt(0) }],
        ];
      }

      return [
        [{ kind: "open", start: minimalSubspaceKey }],
        [{ kind: "open", start: new Uint8Array(0) }],
        [{ kind: "open", start: BigInt(0) }],
      ];
    }
    case "delegation": {
      return getGrantedProduct(
        {
          isCommunalFn,
          minimalSubspaceKey,
          orderSubspace,
          successorSubspace,
          maxPathLength,
        },
        cap.parent,
      );
    }
    case "restriction": {
      //	the granted product is the intersection of cap.product and the granted product of cap.parent.
      const parentProduct = getGrantedProduct(
        {
          isCommunalFn,
          minimalSubspaceKey,
          orderSubspace,
          successorSubspace,
          maxPathLength,
        },
        cap.parent,
      );

      return intersect3dProducts(
        {
          orderSubspace,
        },
        parentProduct,
        decanoniciseProduct({
          successorSubspace,
          maxPathLength,
        }, cap.product),
      );
    }
    case "merge": {
      //the granted namespace is the granted namespace of the first component (cap.components[0]), and
      //the granted product is the union of the granted products of all capabilities in cap.components.
      // Validity ensures the union is another 3d product.
      const allGrantedProducts: ThreeDimensionalProduct<SubspacePublicKey>[] =
        [];

      for (const component of cap.components) {
        allGrantedProducts.push(
          getGrantedProduct({
            isCommunalFn,
            minimalSubspaceKey,
            orderSubspace,
            successorSubspace,
            maxPathLength,
          }, component),
        );
      }

      return merge3dProducts({
        orderSubspace,
      }, ...allGrantedProducts);
    }
  }
}

/** Returns the the number of times this capability can be delegated further. */
export function getDelegationLimit<
  NamespacePublicKey,
  NamespaceSecretKey,
  SubspacePublicKey,
  SubspaceSecretKey,
>(
  cap: Capability<
    NamespacePublicKey,
    NamespaceSecretKey,
    SubspacePublicKey,
    SubspaceSecretKey
  >,
): number {
  switch (cap.kind) {
    case "source": {
      return 255;
    }
    case "delegation": {
      return cap.delegationLimit;
    }
    case "restriction": {
      return getDelegationLimit(cap.parent);
    }
    case "merge": {
      const delegationLimits: number[] = [];

      for (const component of cap.components) {
        delegationLimits.push(getDelegationLimit(component));
      }

      return Math.min(...delegationLimits);
    }
  }
}
