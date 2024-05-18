import { Area } from "@earthstar/willow-utils";

/** Whether a capability grants read or write access. */
export type AccessMode = "read" | "write";

/** A successive authorisation of a new `UserPublicKey`, restricted to a particular `Area`. */
export type Delegation<UserPublicKey, UserSignature> = [
  Area<UserPublicKey>,
  UserPublicKey,
  UserSignature,
];

type CommunalBase<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
> = {
  /** The namespace in which this grants access. */
  namespaceKey: NamespacePublicKey;
  /** The subspace for which and to whom this capability grants access. */
  userKey: UserPublicKey;
  /** Successive authorisations of new UserPublicKeys, each restricted to a particular Area. */
  delegations: Delegation<UserPublicKey, UserSignature>[];
};

export type CommunalReadCapability<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
> =
  & CommunalBase<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >
  & {
    /** The kind of access this capability grants. */
    accessMode: "read";
  };

export type CommunalWriteCapability<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
> =
  & CommunalBase<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >
  & {
    /** The kind of access this capability grants. */
    accessMode: "write";
  };

/** A capability that implements communal namespaces.
 *
 * https://willowprotocol.org/specs/meadowcap/index.html#communal_capabilities
 */
export type CommunalCapability<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
> =
  | CommunalReadCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >
  | CommunalWriteCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >;

type OwnedBase<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> = {
  /** The namespace for which this grants access. */
  namespaceKey: NamespacePublicKey;
  /** The user to whom this grants access; granting access for the full namespace_key, not just to a subspace. */
  userKey: UserPublicKey;
  /** Authorisation of the user_key by the owned_namespace_key. */
  initialAuthorisation: NamespaceSignature;
  /** Successive authorizations of new UserPublicKeys, each restricted to a particular Area. */
  delegations: Delegation<UserPublicKey, UserSignature>[];
};

export type OwnedReadCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> =
  & OwnedBase<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >
  & {
    /** The kind of access this capability grants. */
    accessMode: "read";
  };

export type OwnedWriteCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> =
  & OwnedBase<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >
  & {
    /** The kind of access this capability grants. */
    accessMode: "write";
  };

/** A capability that implements owned namespaces.
 *
 * https://willowprotocol.org/specs/meadowcap/index.html#owned_capabilities
 */
export type OwnedCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> =
  | OwnedReadCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >
  | OwnedWriteCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >;

/** A Meadowcap capability.
 *
 * https://willowprotocol.org/specs/meadowcap/index.html#proper_capabilities
 */
export type McCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> =
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

/** A capability that certifies read access to arbitrary SubspaceIds at some unspecified Path.
 *
 * https://willowprotocol.org/specs/pai/index.html#McSubspaceCapability
 */
export type McSubspaceCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> = {
  /** The namespace for which this grants access. */
  namespaceKey: NamespacePublicKey;
  /** The user to whom this grants access; granting access for the full namespace_key, not just to a subspace. */
  userKey: UserPublicKey;
  /** Authorisation of the user_key by the owned_namespace_key. */
  initialAuthorisation: NamespaceSignature;
  /** Successive authorisations of new UserPublicKeys, [each restricted to a particular Area. */
  delegations: [UserPublicKey, UserSignature][];
};

export type ReadCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> =
  | CommunalReadCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >
  | OwnedReadCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >;

export type WriteCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> =
  | CommunalWriteCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >
  | OwnedWriteCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >;

export type ReadOrWriteCommunal<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
  A extends AccessMode,
> = A extends "read"
  ? CommunalReadCapability<NamespacePublicKey, UserPublicKey, UserSignature>
  : CommunalWriteCapability<NamespacePublicKey, UserPublicKey, UserSignature>;

export type ReadOrWriteOwned<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
  A extends AccessMode,
> = A extends "read" ? OwnedReadCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >
  : OwnedWriteCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >;

export type ReadOrWriteCommunalCap<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
  Cap extends CommunalCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >,
> = Cap extends
  CommunalReadCapability<NamespacePublicKey, UserPublicKey, UserSignature>
  ? CommunalReadCapability<NamespacePublicKey, UserPublicKey, UserSignature>
  : CommunalWriteCapability<NamespacePublicKey, UserPublicKey, UserSignature>;

export type ReadOrWriteOwnedCap<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
  Cap extends OwnedCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >,
> = Cap extends OwnedReadCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature
> ? OwnedReadCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >
  : OwnedWriteCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >;

export type IsCommunalCapability<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
  Cap extends CommunalCapability<
    NamespacePublicKey,
    UserPublicKey,
    UserSignature
  >,
> = Cap extends
  CommunalReadCapability<NamespacePublicKey, UserPublicKey, UserSignature>
  ? CommunalReadCapability<NamespacePublicKey, UserPublicKey, UserSignature>
  : CommunalWriteCapability<NamespacePublicKey, UserPublicKey, UserSignature>;
