import {
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
} from "../capabilities/encoding.ts";
import {
  getGrantedAreaCommunal,
  getGrantedAreaOwned,
  getGrantedNamespace,
  getReceiver,
} from "../capabilities/semantics.ts";
import {
  AccessMode,
  CommunalCapability,
  McCapability,
  McSubspaceCapability,
  OwnedCapability,
} from "../capabilities/types.ts";
import {
  isValidCapCommunal,
  isValidCapOwned,
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
  createCapCommunal(
    { accessMode, namespace, user }: {
      accessMode: AccessMode;
      namespace: NamespacePublicKey;
      user: UserPublicKey;
    },
  ): CommunalCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  > {
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
    };
  }

  /** Create a capability for an owned namespace. */
  async createCapOwned({ accessMode, namespace, namespaceSecret, user }: {
    accessMode: AccessMode;
    namespace: NamespacePublicKey;
    namespaceSecret: NamespaceSecretKey;
    user: UserPublicKey;
  }): Promise<
    OwnedCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
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
    };
  }

  /** Delegate a capability to a `UserPublicKey`, restricted to a given `Area`. */
  async delegateCap(
    { cap, user, area, secret }: {
      cap: CommunalCapability<
        NamespacePublicKey,
        UserPublicKey,
        UserSignature
      >;
      user: UserPublicKey;
      area: Area<UserPublicKey>;
      /** The secret of this capabality's receiver. */
      secret: UserSecretKey;
    },
  ): Promise<
    CommunalCapability<
      NamespacePublicKey,
      UserPublicKey,
      UserSignature
    >
  >;
  async delegateCap(
    { cap, user, area, secret }: {
      cap: OwnedCapability<
        NamespacePublicKey,
        UserPublicKey,
        NamespaceSignature,
        UserSignature
      >;
      user: UserPublicKey;
      area: Area<UserPublicKey>;
      /** The secret of this capabality's receiver. */
      secret: UserSecretKey;
    },
  ): Promise<
    OwnedCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >
  >;
  async delegateCap(
    { cap, user, area, secret }: {
      cap:
        | CommunalCapability<
          NamespacePublicKey,
          UserPublicKey,
          UserSignature
        >
        | OwnedCapability<
          NamespacePublicKey,
          UserPublicKey,
          NamespaceSignature,
          UserSignature
        >;
      user: UserPublicKey;
      area: Area<UserPublicKey>;
      /** The secret of this capabality's receiver. */
      secret: UserSecretKey;
    },
  ): Promise<
    McCapability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >
  > {
    if ("initialAuthorisation" in cap === false) {
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

      const signature = await this.params.userScheme.signatures.sign(
        user,
        secret,
        handover,
      );

      return {
        ...cap,
        delegations: [...cap.delegations, [area, user, signature]],
      };
    }

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

    const signature = await this.params.userScheme.signatures.sign(
      user,
      secret,
      handover,
    );

    return {
      ...cap,
      delegations: [...cap.delegations, [area, user, signature]],
    };
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
  ): boolean | InvalidCapError {
    const isCommunal = this.params.isCommunal(cap.namespaceKey);

    if ("initialAuthorisation" in cap && isCommunal) {
      return new InvalidCapError(
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
