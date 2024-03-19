import FIFO from "https://deno.land/x/fifo@v0.2.2/mod.ts";
import { delay } from "https://deno.land/std@0.202.0/async/delay.ts";
import {
  decodeMcCapability,
  decodeStreamMcCapability,
  encodeMcCapability,
} from "./encoding.ts";
import { McCapability } from "./types.ts";

import {
  EncodingScheme,
  GrowingBytes,
  OPEN_END,
  orderBytes,
} from "../../deps.ts";
import { assertEquals } from "$std/assert/assert_equals.ts";

type CapVector = McCapability<
  Uint8Array,
  Uint8Array,
  Uint8Array,
  Uint8Array
>;

function makeEncodings(len: number): EncodingScheme<Uint8Array> {
  return {
    encode: (key) => key,
    decode: (key) => key.subarray(0, len),
    encodedLength: () => len,
    decodeStream: async (bytes) => {
      await bytes.nextAbsolute(len);

      const key = bytes.array.slice(0, len);

      bytes.prune(len);

      return key;
    },
  };
}

const NAMESPACE_KEY_LEN = 8;
const NAMESPACE_SIG_LEN = 16;
const USER_KEY_LEN = 24;
const USER_SIG_LEN = 32;

const namespaceKeyEncodings = makeEncodings(NAMESPACE_KEY_LEN);
const namespaceSigEncodings = makeEncodings(NAMESPACE_SIG_LEN);
const userKeyEncodings = makeEncodings(USER_KEY_LEN);
const userSigEncodings = makeEncodings(USER_SIG_LEN);

const subspace = crypto.getRandomValues(new Uint8Array(USER_KEY_LEN));

const vectors: CapVector[] = [
  {
    accessMode: "read",
    namespaceKey: crypto.getRandomValues(new Uint8Array(NAMESPACE_KEY_LEN)),
    userKey: subspace,
    delegations: [[
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4)],
        timeRange: {
          start: BigInt(5),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: BigInt(12),
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ]],
  },
  {
    accessMode: "write",
    namespaceKey: crypto.getRandomValues(new Uint8Array(NAMESPACE_KEY_LEN)),
    userKey: subspace,
    delegations: [[
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4)],
        timeRange: {
          start: BigInt(5),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: BigInt(12),
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ]],
  },
  {
    accessMode: "read",
    namespaceKey: crypto.getRandomValues(new Uint8Array(NAMESPACE_KEY_LEN)),
    userKey: subspace,
    initialAuthorisation: crypto.getRandomValues(
      new Uint8Array(NAMESPACE_SIG_LEN),
    ),
    delegations: [[
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4)],
        timeRange: {
          start: BigInt(5),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: BigInt(12),
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ]],
  },
  {
    accessMode: "write",
    namespaceKey: crypto.getRandomValues(new Uint8Array(NAMESPACE_KEY_LEN)),
    userKey: subspace,
    initialAuthorisation: crypto.getRandomValues(
      new Uint8Array(NAMESPACE_SIG_LEN),
    ),
    delegations: [[
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4)],
        timeRange: {
          start: BigInt(5),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: OPEN_END,
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ], [
      {
        includedSubspaceId: subspace,
        pathPrefix: [new Uint8Array(4), new Uint8Array(5)],
        timeRange: {
          start: BigInt(7),
          end: BigInt(12),
        },
      },
      crypto.getRandomValues(new Uint8Array(USER_KEY_LEN)),
      crypto.getRandomValues(new Uint8Array(USER_SIG_LEN)),
    ]],
  },
];

Deno.test("Cap encoding roundtrip", () => {
  for (const cap of vectors) {
    const encoded = encodeMcCapability({
      encodingNamespace: namespaceKeyEncodings,
      encodingNamespaceSig: namespaceSigEncodings,
      encodingUser: userKeyEncodings,
      encodingUserSig: userSigEncodings,
      orderSubspace: (a, b) => {
        return orderBytes(new Uint8Array(a), new Uint8Array(b));
      },
      pathScheme: {
        maxComponentCount: 255,
        maxComponentLength: 255,
        maxPathLength: 255,
      },
    }, cap);

    const decoded = decodeMcCapability({
      encodingNamespace: namespaceKeyEncodings,
      encodingNamespaceSig: namespaceSigEncodings,
      encodingUser: userKeyEncodings,
      encodingUserSig: userSigEncodings,
      orderSubspace: (a, b) => {
        return orderBytes(new Uint8Array(a), new Uint8Array(b));
      },
      pathScheme: {
        maxComponentCount: 255,
        maxComponentLength: 255,
        maxPathLength: 255,
      },
    }, encoded);

    assertEquals(decoded, cap);
  }
});

Deno.test("Cap encoding roundtrip (streaming)", async () => {
  for (const cap of vectors) {
    const encoded = encodeMcCapability({
      encodingNamespace: namespaceKeyEncodings,
      encodingNamespaceSig: namespaceSigEncodings,
      encodingUser: userKeyEncodings,
      encodingUserSig: userSigEncodings,
      orderSubspace: (a, b) => {
        return orderBytes(new Uint8Array(a), new Uint8Array(b));
      },
      pathScheme: {
        maxComponentCount: 255,
        maxComponentLength: 255,
        maxPathLength: 255,
      },
    }, cap);

    const stream = new FIFO<Uint8Array>();

    const bytes = new GrowingBytes(stream);

    (async () => {
      for (const byte of encoded) {
        stream.push(new Uint8Array([byte]));
        await delay(0);
      }
    })();

    const decoded = await decodeStreamMcCapability({
      encodingNamespace: namespaceKeyEncodings,
      encodingNamespaceSig: namespaceSigEncodings,
      encodingUser: userKeyEncodings,
      encodingUserSig: userSigEncodings,
      orderSubspace: (a, b) => {
        return orderBytes(new Uint8Array(a), new Uint8Array(b));
      },
      pathScheme: {
        maxComponentCount: 255,
        maxComponentLength: 255,
        maxPathLength: 255,
      },
    }, bytes);

    assertEquals(decoded, cap);
  }
});
