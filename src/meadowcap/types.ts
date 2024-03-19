import {
  EncodingScheme,
  KeypairScheme,
  PathScheme,
  SignatureScheme,
  TotalOrder,
} from "../../deps.ts";
import { McCapability } from "../capabilities/types.ts";

// Yes. It's a lot.
export type MeadowcapParams<
  NamespacePublicKey,
  NamespaceSecretKey,
  NamespaceSignature,
  UserPublicKey,
  UserSecretKey,
  UserSignature,
  PayloadDigest,
> = {
  /** The keypair signature and encoding scheme for namespace key pairs. Used for authorisation when a namespace is owned.
   *
   * Must be the same namespace scheme used by Willow.
   */
  namespaceKeypairScheme: KeypairScheme<
    NamespacePublicKey,
    NamespaceSecretKey,
    NamespaceSignature
  >;

  /** The keypair signature and encoding scheme for namespace key pairs. Used for authorisation when a namespace is communal.
   *
   * Must be the same subspace scheme used by Willow.
   * This will usually be the same as the namespace key pair scheme, but if you use a trivial scheme here then you can effectively remove the notion of subspaces from Willow and Meadowcap.
   */
  userScheme: UserScheme<
    UserPublicKey,
    UserSecretKey,
    UserSignature
  >;

  pathScheme: PathScheme;

  /** Encoding scheme for the payloads used by Willow's entries. */
  payloadScheme: EncodingScheme<PayloadDigest>;

  /** A function which determines whether a namespace is communal or not via its public key. */
  isCommunal: IsCommunalFn<NamespacePublicKey>;
};

/** A function which determines whether a namespace is communal or not using its public key. */
export type IsCommunalFn<NamespacePublicKey> = (
  pubkey: NamespacePublicKey,
) => boolean;

export type UserScheme<UserPublicKey, UserSecret, UserSignature> = {
  order: TotalOrder<UserPublicKey>;
} & KeypairScheme<UserPublicKey, UserSecret, UserSignature>;

/** To be used as an AuthorizationToken for Willow. */
export type MeadowcapAuthorisationToken<
  NamespacePublicKey,
  UserPublicKey,
  NamespaceSignature,
  UserSignature,
> = {
  /** Certifies that an Entry may be written. */
  capability: McCapability<
    NamespacePublicKey,
    UserPublicKey,
    NamespaceSignature,
    UserSignature
  >;
  /** The signature over the encoded entry by the receiver of the corresponding capability. Proves that the Entry was authorised by the receiver of the capability. */
  signature: UserSignature;
};
