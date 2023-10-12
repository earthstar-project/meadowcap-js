import { assert } from "$std/assert/assert.ts";
import {
  orderNumber,
  predecessorNumber,
  successorNumber,
  TEST_MINIMAL_SUBSPACE_KEY,
  testHash,
  testIsCommunalFn,
  testNamespaceScheme,
  testPathLengthScheme,
  testSubspaceScheme,
} from "../test/util.ts";
import { Meadowcap } from "./meadowcap.ts";
import { Entry } from "./types.ts";

Deno.test("isAuthorisedWrite", async () => {
  const meadowcap = new Meadowcap({
    namespaceKeypairScheme: testNamespaceScheme,
    subspaceKeypairScheme: testSubspaceScheme,
    isCommunalFn: testIsCommunalFn,
    minimalSubspacePublicKey: TEST_MINIMAL_SUBSPACE_KEY,
    orderSubspace: orderNumber,
    predecessorSubspace: predecessorNumber,
    successorSubspace: successorNumber,
    isInclusiveSmallerSubspace: () => false,
    pathLengthScheme: testPathLengthScheme,
    hashCapability: testHash,
    encodePayloadHash: (hash: Uint8Array) => hash,
  });

  // Owned namespace - source cap test

  const namespaceKeypair = {
    publicKey: 128,
    secretKey: 128,
  };

  const sourceCap = meadowcap.createSourceCap(
    "write",
    namespaceKeypair.publicKey,
    0,
  );

  const entry: Entry<number, number, Uint8Array> = {
    identifier: {
      namespace: namespaceKeypair.publicKey,
      subspace: 0,
      path: new Uint8Array([0, 1, 2, 3]),
    },
    record: {
      hash: new Uint8Array([1, 1]),
      length: BigInt(2),
      timestamp: BigInt(1000),
    },
  };

  const token = await meadowcap.createAuthorisationToken(
    entry,
    sourceCap,
    namespaceKeypair.secretKey,
  );

  const isAuthorised = await meadowcap.isAuthorisedWrite(entry, token);

  assert(isAuthorised);

  // Owned namespace - wrong keypair

  const otherKeypair = {
    publicKey: 130,
    secretKey: 130,
  };

  const badToken = await meadowcap.createAuthorisationToken(
    entry,
    sourceCap,
    otherKeypair.secretKey,
  );

  const isBadAuthorised = await meadowcap.isAuthorisedWrite(entry, badToken);

  assert(!isBadAuthorised);

  // Owned namespace - restricted (entry not included)

  const subspace1Product = meadowcap.addSingleValueToProduct({
    subspace: 1,
  });

  const restrictionCap = meadowcap.createRestrictionCap(
    sourceCap,
    subspace1Product,
  );

  const restrictionToken = await meadowcap.createAuthorisationToken(
    entry,
    restrictionCap,
    namespaceKeypair.secretKey,
  );

  const isRestrictedAuthorised = await meadowcap.isAuthorisedWrite(
    entry,
    restrictionToken,
  );

  assert(!isRestrictedAuthorised);

  // Owned namespace - restricted (entry included)

  let pathProduct = meadowcap.addSingleValueToProduct({
    path: new Uint8Array([0, 1, 2, 3]),
  });

  pathProduct = meadowcap.addOpenRangeToProduct(
    { subspace: 0 },
    pathProduct,
  );
  pathProduct = meadowcap.addOpenRangeToProduct(
    { time: BigInt(0) },
    pathProduct,
  );

  const restrictionGoodCap = meadowcap.createRestrictionCap(
    sourceCap,
    pathProduct,
  );

  const restrictionGoodToken = await meadowcap.createAuthorisationToken(
    entry,
    restrictionGoodCap,
    namespaceKeypair.secretKey,
  );

  const isRestrictedGoodAuthorised = await meadowcap.isAuthorisedWrite(
    entry,
    restrictionGoodToken,
  );

  assert(isRestrictedGoodAuthorised);

  // Owned namespace - delegated

  const delegeeKeypair = { publicKey: 255, privateKey: 255 };

  const delegated = await meadowcap.createDelegateCapOwned(
    sourceCap,
    delegeeKeypair.publicKey,
    namespaceKeypair.secretKey,
  );

  const delegatedToken = await meadowcap.createAuthorisationToken(
    entry,
    delegated,
    delegeeKeypair.privateKey,
  );

  const isDelegatedAuthorised = await meadowcap.isAuthorisedWrite(
    entry,
    delegatedToken,
  );

  assert(isDelegatedAuthorised);

  // Owned namespace - delegated (wrong key)

  const delegatedBadToken = await meadowcap.createAuthorisationToken(
    entry,
    delegated,
    // Used a different key to sign!
    otherKeypair.secretKey,
  );

  const isBadDelegatedAuthorised = await meadowcap.isAuthorisedWrite(
    entry,
    delegatedBadToken,
  );

  assert(!isBadDelegatedAuthorised);

  // Communal namespace - source cap

  const communalNamespaceKeypair = {
    publicKey: 0,
    secretKey: 0,
  };

  const subspaceKeypair = {
    publicKey: 255,
    secretKey: 255,
  };

  const communalSourceCap = meadowcap.createSourceCap(
    "write",
    subspaceKeypair.publicKey,
    0,
  );

  const communalEntry: Entry<number, number, Uint8Array> = {
    identifier: {
      namespace: communalNamespaceKeypair.publicKey,
      subspace: 255,
      path: new Uint8Array([0, 1, 2, 3]),
    },
    record: {
      hash: new Uint8Array([1, 1]),
      length: BigInt(2),
      timestamp: BigInt(1000),
    },
  };

  const communalToken = await meadowcap.createAuthorisationToken(
    communalEntry,
    communalSourceCap,
    subspaceKeypair.secretKey,
  );

  const isCommunalAuthorised = await meadowcap.isAuthorisedWrite(
    communalEntry,
    communalToken,
  );

  assert(isCommunalAuthorised);

  // Communal namespace - wrong keypair

  const otherSubspaceKeypair = {
    publicKey: 254,
    secretKey: 254,
  };

  const badCommunalToken = await meadowcap.createAuthorisationToken(
    communalEntry,
    communalSourceCap,
    otherSubspaceKeypair.secretKey,
  );

  const isCommunalBadAuthorised = await meadowcap.isAuthorisedWrite(
    entry,
    badCommunalToken,
  );

  assert(!isCommunalBadAuthorised);

  // Communal namespace - restricted (entry not included)

  let path01Product = meadowcap.addSingleValueToProduct({
    path: new Uint8Array([0, 1]),
  });

  path01Product = meadowcap.addSingleValueToProduct({
    subspace: 0,
  }, path01Product);

  path01Product = meadowcap.addOpenRangeToProduct({
    time: BigInt(0),
  }, path01Product);

  const restrictionCommunalCap = meadowcap.createRestrictionCap(
    communalSourceCap,
    path01Product,
  );

  const restrictionCommunalToken = await meadowcap.createAuthorisationToken(
    communalEntry,
    restrictionCommunalCap,
    subspaceKeypair.secretKey,
  );

  const isRestrictedCommunalAuthorised = await meadowcap.isAuthorisedWrite(
    communalEntry,
    restrictionCommunalToken,
  );

  assert(!isRestrictedCommunalAuthorised);

  // Communal namespace - restricted (entry included)

  let time1000Product = meadowcap.addSingleValueToProduct({
    time: BigInt(1000),
  });

  time1000Product = meadowcap.addSingleValueToProduct({
    subspace: 255,
  }, time1000Product);

  time1000Product = meadowcap.addOpenRangeToProduct({
    path: new Uint8Array(),
  }, time1000Product);

  const restrictionIncludedCommunalCap = meadowcap.createRestrictionCap(
    communalSourceCap,
    time1000Product,
  );

  const restrictionIncludedCommunalToken = await meadowcap
    .createAuthorisationToken(
      communalEntry,
      restrictionIncludedCommunalCap,
      subspaceKeypair.secretKey,
    );

  const isRestrictedIncludedCommunalAuthorised = await meadowcap
    .isAuthorisedWrite(
      communalEntry,
      restrictionIncludedCommunalToken,
    );

  assert(isRestrictedIncludedCommunalAuthorised);

  // Communal namespace - delegated

  const communalDelegeeKeypair = { publicKey: 253, privateKey: 253 };

  const communalDelegated = await meadowcap.createDelegateCapOwned(
    communalSourceCap,
    communalDelegeeKeypair.publicKey,
    subspaceKeypair.secretKey,
  );

  const communalDelegatedToken = await meadowcap.createAuthorisationToken(
    entry,
    communalDelegated,
    communalDelegeeKeypair.privateKey,
  );

  const isCommunalDelegatedAuthorised = await meadowcap.isAuthorisedWrite(
    entry,
    communalDelegatedToken,
  );

  assert(isCommunalDelegatedAuthorised);

  // Communal namespace - delegated (wrong key)

  const communalDelegatedBadToken = await meadowcap.createAuthorisationToken(
    entry,
    delegated,
    // Used a different key to sign!
    otherSubspaceKeypair.secretKey,
  );

  const isCommunalBadDelegatedAuthorised = await meadowcap.isAuthorisedWrite(
    entry,
    communalDelegatedBadToken,
  );

  assert(!isCommunalBadDelegatedAuthorised);
});
