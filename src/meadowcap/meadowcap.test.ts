import { assert, assertEquals, assertRejects } from "$std/assert/mod.ts";
import {
  ANY_SUBSPACE,
  encodeEntry,
  Entry,
  KeypairScheme,
  OPEN_END,
  orderBytes,
} from "../../deps.ts";
import {
  getGrantedAreaCommunal,
  getGrantedAreaOwned,
  getGrantedNamespace,
  getReceiver,
} from "../capabilities/semantics.ts";
import { Meadowcap } from "./meadowcap.ts";

function isCommunal(key: ArrayBuffer): boolean {
  const ui8 = new Uint8Array(key);
  const last = ui8[64];

  // Check if last bit is 1.
  return (last & 0x1) === 0x1;
}

async function makeKeypair() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );

  return {
    publicKey: await crypto.subtle.exportKey("raw", publicKey),
    privateKey,
  };
}

async function makeKeypairCommunal() {
  while (true) {
    const keypair = await makeKeypair();

    if (isCommunal(keypair.publicKey)) {
      return keypair;
    }
  }
}

async function makeKeypairOwned() {
  while (true) {
    const keypair = await makeKeypair();

    if (!isCommunal(keypair.publicKey)) {
      return keypair;
    }
  }
}

const ecdsaScheme: KeypairScheme<ArrayBuffer, CryptoKey, ArrayBuffer> = {
  encodings: {
    publicKey: {
      encode: (key) => new Uint8Array(key),
      decode: (key) => key.buffer,
      encodedLength: () => 65,
      decodeStream: () => {
        // Not used here.
        return Promise.resolve(new Uint8Array());
      },
    },
    signature: {
      encode: (sig: ArrayBuffer) => new Uint8Array(sig),
      decode: (enc: Uint8Array) => enc.buffer,
      encodedLength: () => 64,
      decodeStream: () => {
        // Not used here.
        return Promise.resolve(new Uint8Array());
      },
    },
  },
  signatures: {
    sign: (
      _publicKey: ArrayBuffer,
      secretKey: CryptoKey,
      bytestring: Uint8Array,
    ) => {
      return crypto.subtle.sign(
        {
          name: "ECDSA",
          hash: { name: "SHA-256" },
        },
        secretKey,
        bytestring,
      );
    },
    verify: async (
      publicKey: ArrayBuffer,
      signature: ArrayBuffer,
      bytestring: Uint8Array,
    ) => {
      const publicKeyWeb = await crypto.subtle.importKey(
        "raw",
        publicKey,
        {
          name: "ECDSA",
          namedCurve: "P-256",
        },
        true,
        ["verify"],
      );

      return crypto.subtle.verify(
        {
          name: "ECDSA",
          hash: { name: "SHA-256" },
        },
        publicKeyWeb,
        signature,
        bytestring,
      );
    },
  },
};

function getTestMc() {
  return new Meadowcap<
    ArrayBuffer,
    CryptoKey,
    ArrayBuffer,
    ArrayBuffer,
    CryptoKey,
    ArrayBuffer,
    ArrayBuffer
  >({
    namespaceKeypairScheme: ecdsaScheme,
    userScheme: {
      ...ecdsaScheme,
      order: (a, b) => {
        return orderBytes(new Uint8Array(a), new Uint8Array(b));
      },
    },
    isCommunal,
    pathScheme: {
      maxComponentCount: 3,
      maxComponentLength: 4,
      maxPathLength: 10,
    },
    payloadScheme: {
      encode: (buffer: ArrayBuffer) => new Uint8Array(buffer),
      decode: (enc: Uint8Array) => enc.buffer,
      encodedLength: () => 32,
      decodeStream: () => {
        // Not used here.
        return Promise.resolve(new Uint8Array());
      },
    },
  });
}

Deno.test("createCapCommunal", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairCommunal();

  const userKeypair = await makeKeypair();

  // Makes a valid cap.
  const communalCap = mc.createCapCommunal({
    accessMode: "read",
    namespace: namespaceKeypair.publicKey,
    user: userKeypair.publicKey,
  });

  assert(await mc.isValidCap(communalCap));

  assertEquals(getGrantedNamespace(communalCap), namespaceKeypair.publicKey);
  assertEquals(getReceiver(communalCap), userKeypair.publicKey);
  assertEquals(getGrantedAreaCommunal(communalCap), {
    pathPrefix: [],
    timeRange: {
      start: BigInt(0),
      end: OPEN_END,
    },
    includedSubspaceId: userKeypair.publicKey,
  });
});

Deno.test("createCapOwned", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairOwned();

  const userKeypair = await makeKeypair();

  // Makes a valid cap.
  const ownedCap = await mc.createCapOwned({
    accessMode: "read",
    namespace: namespaceKeypair.publicKey,
    namespaceSecret: namespaceKeypair.privateKey,
    user: userKeypair.publicKey,
  });

  assert(await mc.isValidCap(ownedCap));

  assertEquals(getGrantedNamespace(ownedCap), namespaceKeypair.publicKey);
  assertEquals(getReceiver(ownedCap), userKeypair.publicKey);
  assertEquals(getGrantedAreaOwned(ownedCap), {
    pathPrefix: [],
    timeRange: {
      start: BigInt(0),
      end: OPEN_END,
    },
    includedSubspaceId: ANY_SUBSPACE,
  });
});

Deno.test("delegateCap (communal)", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairCommunal();

  const userKeypair = await makeKeypair();

  // Makes a valid cap.
  const communalCap = mc.createCapCommunal({
    accessMode: "read",
    namespace: namespaceKeypair.publicKey,
    user: userKeypair.publicKey,
  });

  // Delegate it!

  const delegeeKeypair = await makeKeypair();

  const delegatedCap = await mc.delegateCapCommunal({
    cap: communalCap,
    user: delegeeKeypair.publicKey,
    secret: userKeypair.privateKey,
    area: {
      pathPrefix: [new Uint8Array([1, 1, 1, 1])],
      timeRange: {
        start: BigInt(1000),
        end: BigInt(2000),
      },
      includedSubspaceId: userKeypair.publicKey,
    },
  });

  assert(mc.isValidCap(delegatedCap));

  assertEquals(getGrantedNamespace(delegatedCap), namespaceKeypair.publicKey);
  assertEquals(getReceiver(delegatedCap), delegeeKeypair.publicKey);
  assertEquals(getGrantedAreaCommunal(delegatedCap), {
    pathPrefix: [new Uint8Array([1, 1, 1, 1])],
    timeRange: {
      start: BigInt(1000),
      end: BigInt(2000),
    },
    includedSubspaceId: userKeypair.publicKey,
  });

  // Delegate it, again!

  const delegee2Keypair = await makeKeypair();

  const delegated2Cap = await mc.delegateCapCommunal({
    cap: delegatedCap,
    user: delegee2Keypair.publicKey,
    secret: delegeeKeypair.privateKey,
    area: {
      pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([0])],
      timeRange: {
        start: BigInt(1200),
        end: BigInt(1800),
      },
      includedSubspaceId: userKeypair.publicKey,
    },
  });

  assert(mc.isValidCap(delegated2Cap));

  assertEquals(getGrantedNamespace(delegated2Cap), namespaceKeypair.publicKey);
  assertEquals(getReceiver(delegated2Cap), delegee2Keypair.publicKey);
  assertEquals(getGrantedAreaCommunal(delegated2Cap), {
    pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([0])],
    timeRange: {
      start: BigInt(1200),
      end: BigInt(1800),
    },
    includedSubspaceId: userKeypair.publicKey,
  });

  const delegee3Keypair = await makeKeypair();

  // test that delegating area outside granted area throws.
  assertRejects(async () => {
    await mc.delegateCapCommunal({
      cap: delegatedCap,
      user: delegee3Keypair.publicKey,
      secret: delegee2Keypair.privateKey,
      area: {
        pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([1])],
        timeRange: {
          start: BigInt(0),
          end: BigInt(3000),
        },
        includedSubspaceId: userKeypair.publicKey,
      },
    });
  });

  // test that signing with the wrong secret throws.

  const invalidCap = await mc.delegateCapCommunal({
    cap: delegatedCap,
    user: delegee3Keypair.publicKey,
    // Wrong secret.
    secret: userKeypair.privateKey,
    area: {
      pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([1])],
      timeRange: {
        start: BigInt(1200),
        end: BigInt(1800),
      },
      includedSubspaceId: userKeypair.publicKey,
    },
  });

  assert(!await mc.isValidCap(invalidCap));
});

Deno.test("delegateCap (owned)", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairOwned();

  const userKeypair = await makeKeypair();

  // Makes a valid cap.
  const ownedCap = await mc.createCapOwned({
    accessMode: "read",
    namespace: namespaceKeypair.publicKey,
    namespaceSecret: namespaceKeypair.privateKey,
    user: userKeypair.publicKey,
  });

  // Delegate it!

  const delegeeKeypair = await makeKeypair();

  const delegatedCap = await mc.delegateCapOwned({
    cap: ownedCap,
    user: delegeeKeypair.publicKey,
    secret: userKeypair.privateKey,
    area: {
      pathPrefix: [new Uint8Array([1, 1, 1, 1])],
      timeRange: {
        start: BigInt(1000),
        end: BigInt(2000),
      },
      includedSubspaceId: ANY_SUBSPACE,
    },
  });

  assert(mc.isValidCap(delegatedCap));

  assertEquals(getGrantedNamespace(delegatedCap), namespaceKeypair.publicKey);
  assertEquals(getReceiver(delegatedCap), delegeeKeypair.publicKey);
  assertEquals(getGrantedAreaOwned(delegatedCap), {
    pathPrefix: [new Uint8Array([1, 1, 1, 1])],
    timeRange: {
      start: BigInt(1000),
      end: BigInt(2000),
    },
    includedSubspaceId: ANY_SUBSPACE,
  });

  // Delegate it, again!

  const delegee2Keypair = await makeKeypair();

  const delegated2Cap = await mc.delegateCapOwned({
    cap: delegatedCap,
    user: delegee2Keypair.publicKey,
    secret: delegeeKeypair.privateKey,
    area: {
      pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([0])],
      timeRange: {
        start: BigInt(1200),
        end: BigInt(1800),
      },
      includedSubspaceId: delegeeKeypair.publicKey,
    },
  });

  assert(mc.isValidCap(delegated2Cap));

  assertEquals(getGrantedNamespace(delegated2Cap), namespaceKeypair.publicKey);
  assertEquals(getReceiver(delegated2Cap), delegee2Keypair.publicKey);
  assertEquals(getGrantedAreaCommunal(delegated2Cap), {
    pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([0])],
    timeRange: {
      start: BigInt(1200),
      end: BigInt(1800),
    },
    includedSubspaceId: delegeeKeypair.publicKey,
  });

  const delegee3Keypair = await makeKeypair();

  // test that delegating area outside granted area throws.
  assertRejects(async () => {
    await mc.delegateCapOwned({
      cap: delegatedCap,
      user: delegee3Keypair.publicKey,
      secret: delegee2Keypair.privateKey,
      area: {
        pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([1])],
        timeRange: {
          start: BigInt(0),
          end: BigInt(3000),
        },
        includedSubspaceId: delegee3Keypair.publicKey,
      },
    });
  });

  // test that signing with the wrong secret produces invalid cap.

  const invalidCap = await mc.delegateCapOwned({
    cap: delegatedCap,
    user: delegee3Keypair.publicKey,
    // Wrong secret.
    secret: userKeypair.privateKey,
    area: {
      pathPrefix: [new Uint8Array([1, 1, 1, 1]), new Uint8Array([1])],
      timeRange: {
        start: BigInt(1200),
        end: BigInt(1800),
      },
      includedSubspaceId: delegee3Keypair.publicKey,
    },
  });

  assert(!await mc.isValidCap(invalidCap));
});

Deno.test("isAuthorisedWrite", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairCommunal();
  const userKeypair = await makeKeypair();

  const sourceCapCommunal = mc.createCapCommunal({
    accessMode: "write",
    namespace: namespaceKeypair.publicKey,
    user: userKeypair.publicKey,
  });

  // An authorised write

  {
    const payload = new TextEncoder().encode("Hello");

    const entry: Entry<ArrayBuffer, ArrayBuffer, ArrayBuffer> = {
      namespaceId: namespaceKeypair.publicKey,
      subspaceId: userKeypair.publicKey,
      path: [],
      payloadLength: BigInt(payload.byteLength),
      payloadDigest: await crypto.subtle.digest("SHA-256", payload),
      timestamp: BigInt(0),
    };

    const encodedEntry = encodeEntry({
      namespaceScheme: ecdsaScheme.encodings.publicKey,
      subspaceScheme: ecdsaScheme.encodings.publicKey,
      pathScheme: {
        maxComponentCount: 3,
        maxComponentLength: 4,
        maxPathLength: 10,
      },
      payloadScheme: {
        encode: (buffer: ArrayBuffer) => new Uint8Array(buffer),
        decode: (enc: Uint8Array) => enc.buffer,
        encodedLength: () => 32,
        decodeStream: () => {
          // Not used here.
          return Promise.resolve(new Uint8Array());
        },
      },
    }, entry);

    const signature = await ecdsaScheme.signatures.sign(
      userKeypair.publicKey,
      userKeypair.privateKey,
      encodedEntry,
    );

    assert(
      await mc.isAuthorisedWrite(entry, {
        capability: sourceCapCommunal,
        signature,
      }),
    );
  }

  // Attempt write outside the granted area
  {
    const userKeypair2 = await makeKeypair();

    const payload = new TextEncoder().encode("Heehee");

    const entry: Entry<ArrayBuffer, ArrayBuffer, ArrayBuffer> = {
      namespaceId: namespaceKeypair.publicKey,
      subspaceId: userKeypair2.publicKey,
      path: [],
      payloadLength: BigInt(payload.byteLength),
      payloadDigest: await crypto.subtle.digest("SHA-256", payload),
      timestamp: BigInt(0),
    };

    const encodedEntry = encodeEntry({
      namespaceScheme: ecdsaScheme.encodings.publicKey,
      subspaceScheme: ecdsaScheme.encodings.publicKey,
      pathScheme: {
        maxComponentCount: 3,
        maxComponentLength: 4,
        maxPathLength: 10,
      },
      payloadScheme: {
        encode: (buffer: ArrayBuffer) => new Uint8Array(buffer),
        decode: (enc: Uint8Array) => enc.buffer,
        encodedLength: () => 32,
        decodeStream: () => {
          // Not used here.
          return Promise.resolve(new Uint8Array());
        },
      },
    }, entry);

    const signature = await ecdsaScheme.signatures.sign(
      userKeypair.publicKey,
      userKeypair.privateKey,
      encodedEntry,
    );

    assert(
      await mc.isAuthorisedWrite(entry, {
        capability: sourceCapCommunal,
        signature,
      }) === false,
    );
  }

  // Signed with public key other than capability's
  {
    const userKeypair2 = await makeKeypair();

    const payload = new TextEncoder().encode("Mohoho");

    const entry: Entry<ArrayBuffer, ArrayBuffer, ArrayBuffer> = {
      namespaceId: namespaceKeypair.publicKey,
      subspaceId: userKeypair.publicKey,
      path: [],
      payloadLength: BigInt(payload.byteLength),
      payloadDigest: await crypto.subtle.digest("SHA-256", payload),
      timestamp: BigInt(0),
    };

    const encodedEntry = encodeEntry({
      namespaceScheme: ecdsaScheme.encodings.publicKey,
      subspaceScheme: ecdsaScheme.encodings.publicKey,
      pathScheme: {
        maxComponentCount: 3,
        maxComponentLength: 4,
        maxPathLength: 10,
      },
      payloadScheme: {
        encode: (buffer: ArrayBuffer) => new Uint8Array(buffer),
        decode: (enc: Uint8Array) => enc.buffer,
        encodedLength: () => 32,
        decodeStream: () => {
          // Not used here.
          return Promise.resolve(new Uint8Array());
        },
      },
    }, entry);

    const signature = await ecdsaScheme.signatures.sign(
      userKeypair2.publicKey,
      userKeypair2.privateKey,
      encodedEntry,
    );

    assert(
      await mc.isAuthorisedWrite(entry, {
        capability: sourceCapCommunal,
        signature,
      }) === false,
    );
  }
});

Deno.test("needsSubspaceCapability", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairOwned();
  const userKeypair = await makeKeypair();

  const writeCap = await mc.createCapOwned({
    accessMode: "write",
    namespace: namespaceKeypair.publicKey,
    user: userKeypair.publicKey,
    namespaceSecret: namespaceKeypair.privateKey,
  });

  assertEquals(mc.needsSubspaceCap(writeCap), false);

  const readCap = await mc.createCapOwned({
    accessMode: "read",
    namespace: namespaceKeypair.publicKey,
    user: userKeypair.publicKey,
    namespaceSecret: namespaceKeypair.privateKey,
  });

  assertEquals(mc.needsSubspaceCap(readCap), false);

  const delegatedToSubspace = await mc.delegateCapOwned({
    cap: readCap,
    secret: userKeypair.privateKey,
    user: userKeypair.publicKey,
    area: {
      includedSubspaceId: userKeypair.publicKey,
      pathPrefix: [],
      timeRange: {
        start: 0n,
        end: 1000n,
      },
    },
  });

  assertEquals(mc.needsSubspaceCap(delegatedToSubspace), false);

  const delegatedToNonEmptyPath = await mc.delegateCapOwned({
    cap: readCap,
    secret: userKeypair.privateKey,
    user: userKeypair.publicKey,
    area: {
      includedSubspaceId: ANY_SUBSPACE,
      pathPrefix: [new Uint8Array([77])],
      timeRange: {
        start: 0n,
        end: 1000n,
      },
    },
  });

  assertEquals(mc.needsSubspaceCap(delegatedToNonEmptyPath), true);
});

Deno.test("createSubspaceCap", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairOwned();
  const userKeypair = await makeKeypair();

  const subspaceCap = await mc.createSubspaceCap(
    namespaceKeypair.publicKey,
    namespaceKeypair.privateKey,
    userKeypair.publicKey,
  );

  assert(mc.isValidSubspaceCap(subspaceCap));
});

Deno.test("delegateSubspaceCapability", async () => {
  const mc = getTestMc();

  const namespaceKeypair = await makeKeypairOwned();
  const userKeypair = await makeKeypair();

  const subspaceCap = await mc.createSubspaceCap(
    namespaceKeypair.publicKey,
    namespaceKeypair.privateKey,
    userKeypair.publicKey,
  );

  const userKeypair2 = await makeKeypair();

  const badDelegatedCap = await mc.delegateSubspaceCap(
    subspaceCap,
    userKeypair2.publicKey,
    userKeypair2.privateKey,
  );

  assertEquals(await mc.isValidSubspaceCap(badDelegatedCap), false);

  const delegatedCap = await mc.delegateSubspaceCap(
    subspaceCap,
    userKeypair2.publicKey,
    userKeypair.privateKey,
  );

  assert(await mc.isValidSubspaceCap(delegatedCap));
});
