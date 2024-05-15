import {
  ANY_SUBSPACE,
  Area,
  areaIsIncluded,
  concat,
  encodeEntry,
  Entry,
  entryPosition,
  GrowingBytes,
  isIncludedArea,
} from "../../deps.ts";
import {
  decodeMcCapability,
  decodeStreamMcCapability,
  decodeStreamSubspaceCapability,
  decodeSubspaceCapability,
  encodeMcCapability,
  encodeSubspaceCapability,
  handoverCommunal,
  handoverOwned,
  handoverSubspace,
} from "../capabilities/encoding.ts";
import {
  getGrantedAreaCommunal,
  getGrantedAreaOwned,
  getReceiver,
  getReceiverSubspaceCap,
} from "../capabilities/semantics.ts";
import {
  AccessMode,
  CommunalCapability,
  McCapability,
  McSubspaceCapability,
  OwnedCapability,
  ReadOrWriteCommunal,
  ReadOrWriteCommunalCap,
  ReadOrWriteOwned,
  ReadOrWriteOwnedCap,
} from "../capabilities/types.ts";
import {
  isValidCapCommunal,
  isValidCapOwned,
  isValidCapSubspace,
} from "../capabilities/validity.ts";
import { InvalidCapError, MeadowcapError } from "./errors.ts";

import { MeadowcapAuthorisationToken, MeadowcapParams } from "./types.ts";

/** Represents a configured instantiation of [Meadowcap](https://willowprotocol.org/specs/meadowcap), used for the creation, delegation, and validation of capabilities, and more.
 *
 * Example:
 *
 *  ```js
 *  const mc = new Meadowcap(params);
 *
 *  const communalCap = mc.createCapCommunal({
 *    accessMode: "read",
 *    namespace: namespaceKey,
 *    user: userPublicKey
 *  });
 *
 *  const delegatedCap = mc.delegateCap({
 *    cap: communalCap,
 *    user: delegeePublicKey,
 *    area: smallerArea,
 *    secret: userSecretKey
 *  });
 *  ```
 */
export class Meadowcap<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  UserPublicKey,
  UserSecretKey,
  UserSignature,
  PayloadDigest,
> {
  constructor(
    readonly params: MeadowcapParams<
      NamespacePublicKey,
      NamespaceSecretKey,
      NamespaceSignature,
      UserPublicKey,
      UserSecretKey,
      UserSignature,
      PayloadDigest
    >,
  ) {}

  /** Create a capability for a communal namespace. */
  createCapCommunal<A extends AccessMode>(
    { accessMode, namespace, user }: {
      accessMode: A;
      namespace: NamespacePublicKey;
      user: UserPublicKey;
    },
  ): ReadOrWriteCommunal<NamespacePublicKey, UserPublicKey, UserSignature, A> {
    if (!this.params.isCommunal(namespace)) {
      throw new MeadowcapError(
        "Tried to create a communal cap from an owned namespace",
      );
    }

    return {
      accessMode,
      namespaceKey: namespace,
      userKey: user,
      delegations: [],
    } as ReadOrWriteCommunal<
      NamespacePublicKey,
      UserPublicKey,
      UserSignature,
      A
    >;
  }

  /** Create a capability for an owned namespace. */

  async createCapOwned<A extends AccessMode>(
    { accessMode, namespace, namespaceSecret, user }: {
      accessMode: A;
      namespace: NamespacePublicKey;
      namespaceSecret: NamespaceSecretKey;
      user: UserPublicKey;
    },
  ): Promise<
    ReadOrWriteOwned<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature,
      A
    >
  > {
    if (this.params.isCommunal(namespace)) {
      throw new MeadowcapError(
        "Tried to create an owned cap from a communal namespace",
      );
    }

    const accessModeByte = new Uint8Array([accessMode === "read" ? 0x2 : 0x3]);

    const message = concat(
      accessModeByte,
      this.params.userScheme.encodings.publicKey.encode(user),
    );

    const signature = await this.params.namespaceKeypairScheme.signatures
      .sign(
        namespace,
        namespaceSecret,
        message,
      );

    return {
      accessMode,
      namespaceKey: namespace,
      userKey: user,
      initialAuthorisation: signature,
      delegations: [],
    } as ReadOrWriteOwned<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature,
      A
    >;
  }

  /** Delegate a capability to a `UserPublicKey`, restricted to a given `Area`. */

  async delegateCapCommunal<
    Cap extends CommunalCapability<
      NamespacePublicKey,
      UserPublicKey,
      UserSignature
    >,
  >(
    { cap, user, area, secret }: {
      cap: Cap;
      user: UserPublicKey;
      area: Area<UserPublicKey>;
      /** The secret of this capabality's receiver. */
      secret: UserSecretKey;
    },
  ): Promise<
    ReadOrWriteCommunalCap<
      NamespacePublicKey,
      UserPublicKey,
      UserSignature,
      Cap
    >
  > {
    if (
      !areaIsIncluded(
        this.params.userScheme.order,
        area,
        getGrantedAreaCommunal(cap),
      )
    ) {
      throw new MeadowcapError(
        "Tried to grant access to an area outside the capability's granted area.",
      );
    }

    const handover = handoverCommunal(
      {
        namespaceScheme: this.params.namespaceKeypairScheme,
        pathScheme: this.params.pathScheme,
        userScheme: this.params.userScheme,
      },
      cap,
      area,
      user,
    );

    const receiver = this.getCapReceiver(cap);

    const signature = await this.params.userScheme.signatures.sign(
      receiver,
      secret,
      handover,
    );

    return {
      ...cap,
      delegations: [...cap.delegations, [area, user, signature]],
    } as ReadOrWriteCommunalCap<
      NamespacePublicKey,
      UserPublicKey,
      UserSignature,
      Cap
    >;
  }

  /** Delegate a capability to a `UserPublicKey`, restricted to a given `Area`. */
  async delegateCapOwned<
    Cap extends OwnedCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  >(
    { cap, user, area, secret }: {
      cap: Cap;
      user: UserPublicKey;
      area: Area<UserPublicKey>;
      /** The secret of this capabality's receiver. */
      secret: UserSecretKey;
    },
  ): Promise<
    ReadOrWriteOwnedCap<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature,
      Cap
    >
  > {
    if (
      !areaIsIncluded(
        this.params.userScheme.order,
        area,
        getGrantedAreaOwned(cap),
      )
    ) {
      throw new MeadowcapError(
        "Tried to grant access to an area outside the capability's granted area.",
      );
    }

    const handover = handoverOwned(
      {
        namespaceScheme: this.params.namespaceKeypairScheme,
        pathScheme: this.params.pathScheme,
        userScheme: this.params.userScheme,
      },
      cap,
      area,
      user,
    );

    const receiver = this.getCapReceiver(cap);

    const signature = await this.params.userScheme.signatures.sign(
      receiver,
      secret,
      handover,
    );

    return {
      ...cap,
      delegations: [...cap.delegations, [area, user, signature]],
    } as ReadOrWriteOwnedCap<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature,
      Cap
    >;
  }

  /** Returns whether a capability is valid or not. */
  isValidCap(
    cap: McCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): Promise<boolean> {
    if ("initialAuthorisation" in cap) {
      return isValidCapOwned({
        namespaceScheme: this.params.namespaceKeypairScheme,
        pathScheme: this.params.pathScheme,
        userScheme: this.params.userScheme,
      }, cap);
    }

    return isValidCapCommunal({
      namespaceScheme: this.params.namespaceKeypairScheme,
      pathScheme: this.params.pathScheme,
      userScheme: this.params.userScheme,
    }, cap);
  }

  /** Returns whether a valid capability is for a communal namespace or not. */
  isCommunal(
    cap: McCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): cap is CommunalCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  > {
    const isCommunal = this.params.isCommunal(cap.namespaceKey);

    if ("initialAuthorisation" in cap && isCommunal) {
      throw new InvalidCapError(
        "OwnedCapability assigned to a communal namespace ",
      );
    }

    return isCommunal;
  }

  /** Returns the receiver of a valid capability. */
  getCapReceiver(
    cap: McCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): UserPublicKey {
    return getReceiver(cap);
  }

  /** Returns the granted `Area` for a valid capability. */
  getCapGrantedArea(
    cap: McCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): Area<UserPublicKey> {
    if ("initialAuthorisation" in cap) {
      return getGrantedAreaOwned(cap);
    }

    return getGrantedAreaCommunal(cap);
  }

  /** Returns whether a `MeadowcapAuthorisationToken` is permitted to write a given entry.  */
  async isAuthorisedWrite(
    entry: Entry<NamespacePublicKey, UserPublicKey, PayloadDigest>,
    token: MeadowcapAuthorisationToken<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): Promise<boolean> {
    if (token.capability.accessMode !== "write") {
      return false;
    }

    const position = entryPosition(entry);
    const grantedArea = this.getCapGrantedArea(token.capability);

    if (!isIncludedArea(this.params.userScheme.order, grantedArea, position)) {
      return false;
    }

    if (await this.isValidCap(token.capability) === false) {
      return false;
    }

    // Finally, verify the authorisation token signature
    const receiver = this.getCapReceiver(token.capability);

    const encodedEntry = encodeEntry({
      namespaceScheme: this.params.namespaceKeypairScheme.encodings.publicKey,
      pathScheme: this.params.pathScheme,
      subspaceScheme: this.params.userScheme.encodings.publicKey,
      payloadScheme: this.params.payloadScheme,
    }, entry);

    return this.params.userScheme.signatures.verify(
      receiver,
      token.signature,
      encodedEntry,
    );
  }

  // Encoding helpers.

  /** Encode a McCapability to bytes. */
  encodeCap(
    cap: McCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): Uint8Array {
    return encodeMcCapability({
      pathScheme: this.params.pathScheme,
      encodingNamespace: this.params.namespaceKeypairScheme.encodings.publicKey,
      encodingNamespaceSig:
        this.params.namespaceKeypairScheme.encodings.signature,
      encodingUser: this.params.userScheme.encodings.publicKey,
      encodingUserSig: this.params.userScheme.encodings.signature,
      orderSubspace: this.params.userScheme.order,
    }, cap);
  }

  /** Decode a McCapability from bytes. */
  decodeCap(encoded: Uint8Array) {
    return decodeMcCapability({
      pathScheme: this.params.pathScheme,
      encodingNamespace: this.params.namespaceKeypairScheme.encodings.publicKey,
      encodingNamespaceSig:
        this.params.namespaceKeypairScheme.encodings.signature,
      encodingUser: this.params.userScheme.encodings.publicKey,
      encodingUserSig: this.params.userScheme.encodings.signature,
      orderSubspace: this.params.userScheme.order,
    }, encoded);
  }

  /** Decode a McCapability from an incoming stream of bytes. */
  decodeStreamingCap(bytes: GrowingBytes) {
    return decodeStreamMcCapability({
      pathScheme: this.params.pathScheme,
      encodingNamespace: this.params.namespaceKeypairScheme.encodings.publicKey,
      encodingNamespaceSig:
        this.params.namespaceKeypairScheme.encodings.signature,
      encodingUser: this.params.userScheme.encodings.publicKey,
      encodingUserSig: this.params.userScheme.encodings.signature,
      orderSubspace: this.params.userScheme.order,
    }, bytes);
  }

  // Just Subspace Capability Things

  /** Determine whether a Capability for an owned namespace needs a subspace capability or not. */
  needsSubspaceCap(
    cap: OwnedCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): boolean {
    if (cap.accessMode === "write") {
      return false;
    }

    const grantedArea = this.getCapGrantedArea(cap);

    if (grantedArea.includedSubspaceId !== ANY_SUBSPACE) {
      return false;
    }

    if (grantedArea.pathPrefix.length === 0) {
      return false;
    }

    return true;
  }

  /** Create a new subspace capability for an owned namespace. */
  async createSubspaceCap(
    namespaceKey: NamespacePublicKey,
    namespaceSecret: NamespaceSecretKey,
    userKey: UserPublicKey,
  ): Promise<
    McSubspaceCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >
  > {
    const messageToSign = concat(
      new Uint8Array([0x2]),
      this.params.userScheme.encodings.publicKey.encode(userKey),
    );

    const signature = await this.params.namespaceKeypairScheme.signatures.sign(
      namespaceKey,
      namespaceSecret,
      messageToSign,
    );

    return {
      namespaceKey: namespaceKey,
      userKey: userKey,
      delegations: [],
      initialAuthorisation: signature,
    };
  }

  /** Delegate a subspace capability to a `UserPublicKey`. */
  async delegateSubspaceCap(
    cap: McSubspaceCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
    user: UserPublicKey,
    /** The secret of this capabality's receiver. */
    userSecret: UserSecretKey,
  ): Promise<
    McSubspaceCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >
  > {
    const handover = handoverSubspace(
      {
        namespaceScheme: this.params.namespaceKeypairScheme,
        pathScheme: this.params.pathScheme,
        userScheme: this.params.userScheme,
      },
      cap,
      user,
    );

    const receiver = getReceiverSubspaceCap(cap);

    const signature = await this.params.userScheme.signatures.sign(
      receiver,
      userSecret,
      handover,
    );

    return {
      namespaceKey: cap.namespaceKey,
      userKey: cap.userKey,
      initialAuthorisation: cap.initialAuthorisation,
      delegations: [...cap.delegations, [user, signature]],
    };
  }

  /** Determine whether a subspace capability is valid or not. */
  isValidSubspaceCap(
    cap: McSubspaceCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): Promise<boolean> {
    return isValidCapSubspace({
      namespaceScheme: this.params.namespaceKeypairScheme,
      pathScheme: this.params.pathScheme,
      userScheme: this.params.userScheme,
    }, cap);
  }

  /** Encode a McSubspaceCapability to bytes. */
  encodeSubspaceCap(
    cap: McSubspaceCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
    omitNamespace?: boolean,
  ) {
    return encodeSubspaceCapability({
      omitNamespace,
      pathScheme: this.params.pathScheme,
      encodingNamespace: this.params.namespaceKeypairScheme.encodings.publicKey,
      encodingNamespaceSig:
        this.params.namespaceKeypairScheme.encodings.signature,
      encodingUser: this.params.userScheme.encodings.publicKey,
      encodingUserSig: this.params.userScheme.encodings.signature,
      orderSubspace: this.params.userScheme.order,
    }, cap);
  }

  /** Decode a McSubspaceCapability from bytes. */
  decodeSubspaceCap(encoded: Uint8Array, knownNamespace?: NamespacePublicKey) {
    return decodeSubspaceCapability({
      knownNamespace,
      pathScheme: this.params.pathScheme,
      encodingNamespace: this.params.namespaceKeypairScheme.encodings.publicKey,
      encodingNamespaceSig:
        this.params.namespaceKeypairScheme.encodings.signature,
      encodingUser: this.params.userScheme.encodings.publicKey,
      encodingUserSig: this.params.userScheme.encodings.signature,
      orderSubspace: this.params.userScheme.order,
    }, encoded);
  }

  /** Decode a McSubspaceCapability from an incoming stream of bytes. */
  decodeStreamingSubspaceCap(
    bytes: GrowingBytes,
    knownNamespace?: NamespacePublicKey,
  ) {
    return decodeStreamSubspaceCapability({
      knownNamespace,
      pathScheme: this.params.pathScheme,
      encodingNamespace: this.params.namespaceKeypairScheme.encodings.publicKey,
      encodingNamespaceSig:
        this.params.namespaceKeypairScheme.encodings.signature,
      encodingUser: this.params.userScheme.encodings.publicKey,
      encodingUserSig: this.params.userScheme.encodings.signature,
      orderSubspace: this.params.userScheme.order,
    }, bytes);
  }
}
