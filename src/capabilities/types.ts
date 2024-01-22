import { Area } from "../../deps.ts";

/** Whether a capability grants read or write access. */
export type AccessMode = "read" | "write";

/** A successive authorisation of a new `UserPublicKey`, restricted to a particular `Area`. */
export type Delegation<UserPublicKey, UserSignature> = [
  Area<UserPublicKey>,
  UserPublicKey,
  UserSignature,
];

/** A capability that implements communal namespaces. */
export type CommunalCapability<
  NamespacePublicKey,
  UserPublicKey,
  UserSignature,
> = {
  /** The kind of access this capability grants. */
  accessMode: AccessMode;
  /** The namespace in which this grants access. */
  namespaceKey: NamespacePublicKey;
  /** The subspace for which and to whom this capability grants access. */
  userKey: UserPublicKey;
  /** Successive authorisations of new UserPublicKeys, each restricted to a particular Area. */
  delegations: Delegation<UserPublicKey, UserSignature>[];
};

/** A capability that implements owned namespaces. */
export type OwnedCapability<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> = {
  /** The kind of access this capability grants. */
  accessMode: AccessMode;
  /** The namespace for which this grants access. */
  namespaceKey: NamespacePublicKey;
  /** The user to whom this grants access; granting access for the full namespace_key, not just to a subspace. */
  userKey: UserPublicKey;
  /** Authorisation of the user_key by the owned_namespace_key. */
  initialAuthorisation: NamespaceSignature;
  /** Successive authorizations of new UserPublicKeys, each restricted to a particular Area. */
  delegations: Delegation<UserPublicKey, UserSignature>[];
};

/** A Meadowcap capability */
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

/** A capability that certifies read access to arbitrary SubspaceIds at some unspecified Path. */
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
