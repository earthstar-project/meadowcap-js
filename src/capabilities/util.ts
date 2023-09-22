import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import { intersect3dProducts, merge3dProducts } from "../products/products.ts";
import { CanonicProduct, ThreeDimensionalProduct } from "../products/types.ts";
import { AccessMode, Capability, IsCommunalFn } from "./types.ts";

export function getReceiver<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
>(
  cap: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >,
  isCommunalFn: IsCommunalFn<NamespacePublicKey>,
): NamespacePublicKey | SubspacePublicKey | AuthorPublicKey {
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

export function getAccessMode<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
>(
  cap: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
  >,
  isCommunalFn: IsCommunalFn<NamespacePublicKey>,
): AccessMode {
  switch (cap.kind) {
    case "source": {
      return cap.accessMode;
    }
    case "delegation": {
      return getAccessMode(cap.parent, isCommunalFn);
    }
    case "restriction": {
      return getAccessMode(cap.parent, isCommunalFn);
    }
    case "merge": {
      return getAccessMode(cap.components[0], isCommunalFn);
    }
  }
}

export function getNamespace<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
>(
  cap: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
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
      //the granted namespace is the granted namespace of cap.parent, and
      //	the granted product is the intersection of cap.product and the granted product of cap.parent.
      return getNamespace(
        cap.parent,
      );
    }
    case "merge": {
      return getNamespace(cap.components[0]);
    }
  }
}

export function getGrantedProduct<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
>(
  {
    isCommunalFn,
    minimalSubspaceKey,
    orderSubspace,
    successorSubspace,
  }: {
    isCommunalFn: IsCommunalFn<NamespacePublicKey>;
    minimalSubspaceKey: SubspacePublicKey;
    orderSubspace: TotalOrder<SubspacePublicKey>;
    successorSubspace: SuccessorFn<SubspacePublicKey>;
  },
  cap: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
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
        },
        cap.parent,
      );
    }
    case "restriction": {
      //the granted namespace is the granted namespace of cap.parent, and
      //	the granted product is the intersection of cap.product and the granted product of cap.parent.
      const parentProduct = getGrantedProduct(
        {
          isCommunalFn,
          minimalSubspaceKey,
          orderSubspace,
          successorSubspace,
        },
        cap.parent,
      );

      return intersect3dProducts(
        {
          orderSubspace,
        },
        parentProduct,
        cap.product,
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
          }, component),
        );
      }

      return merge3dProducts({
        orderSubspace,
      }, ...allGrantedProducts);
    }
  }
}

export function getDelegationLimit<
  NamespacePublicKey,
  SubspacePublicKey,
  AuthorPublicKey,
  AuthorSignature,
>(
  cap: Capability<
    NamespacePublicKey,
    SubspacePublicKey,
    AuthorPublicKey,
    AuthorSignature
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
