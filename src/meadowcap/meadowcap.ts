import {
  Area,
  concat,
  encodeEntry,
  Entry,
  entryPosition,
  isIncludedArea,
} from "../../deps.ts";
import { handoverCommunal, handoverOwned } from "../capabilities/encoding.ts";
import {
  getGrantedAreaCommunal,
  getGrantedAreaOwned,
  getReceiver,
} from "../capabilities/semantics.ts";
import {
  AccessMode,
  Capability,
  CommunalCapability,
  OwnedCapability,
} from "../capabilities/types.ts";
import {
  isValidCapCommunal,
  isValidCapOwned,
} from "../capabilities/validity.ts";

import { MeadowcapAuthorisationToken, MeadowcapParams } from "./types.ts";

export class Meadowcap<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSecretKey,
  UserSecretKey,
  NamespaceSignature,
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

  createCommunalCap(
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
    return {
      accessMode,
      namespaceKey: namespace,
      userKey: user,
      delegations: [],
    };
  }

  async createOwnedCap({ accessMode, namespace, namespaceSecret, user }: {
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
    const accessModeByte = new Uint8Array([accessMode === "read" ? 0x0 : 0x1]);

    const message = concat(
      accessModeByte,
      this.params.userScheme.encodingScheme.publicKey.encode(user),
    );

    const signature = await this.params.namespaceKeypairScheme.signatureScheme
      .sign(
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
    Capability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >
  > {
    if ("initialAuthorisation" in cap === false) {
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

      const signature = await this.params.userScheme.signatureScheme.sign(
        secret,
        handover,
      );

      return {
        ...cap,
        delegations: [...cap.delegations, [area, user, signature]],
      };
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

    const signature = await this.params.userScheme.signatureScheme.sign(
      secret,
      handover,
    );

    return {
      ...cap,
      delegations: [...cap.delegations, [area, user, signature]],
    };
  }

  isValidCap(
    cap: Capability<
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

  isCommunal(
    cap: Capability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): boolean {
    const isCommunal = this.params.isCommunal(cap.namespaceKey);

    if ("initialAuthorisation" in cap && isCommunal) {
      throw new Error("OwnedCapability for to a communal namespace ");
    }

    return isCommunal;
  }

  getCapReceiver(
    cap: Capability<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
  ): UserPublicKey {
    return getReceiver(cap);
  }

  getCapGrantedArea(
    cap: Capability<
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

  async isAuthorisedWrite(
    token: MeadowcapAuthorisationToken<
      NamespacePublicKey,
      UserPublicKey,
      NamespaceSignature,
      UserSignature
    >,
    entry: Entry<NamespacePublicKey, UserPublicKey, unknown>,
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

    // Finally, verify.
    const receiver = this.getCapReceiver(token.capability);

    const encodedEntry = encodeEntry({
      namespaceScheme:
        this.params.namespaceKeypairScheme.encodingScheme.publicKey,
      pathScheme: this.params.pathScheme,
      subspaceScheme: this.params.userScheme.encodingScheme.publicKey,
      payloadScheme: this.params.payloadScheme,
    }, entry);

    return this.params.userScheme.signatureScheme.verify(
      receiver,
      token.signature,
      encodedEntry,
    );
  }
}
