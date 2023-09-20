import { assertEquals } from "$std/assert/assert_equals.ts";
import { predecessorPath, predecessorTimestamp } from "./predecessors.ts";

Deno.test("predecessorTimestamp", () => {
  {
    const time = BigInt(1000);
    const expected = BigInt(999);
    assertEquals(predecessorTimestamp(time), expected);
  }

  {
    const time = BigInt(0);
    const expected = BigInt(0);
    assertEquals(predecessorTimestamp(time), expected);
  }
});

Deno.test("predecessorPath", () => {
  {
    const bytes = new Uint8Array([0, 0, 0, 255]);
    const expected = new Uint8Array([0, 0, 0, 254]);
    assertEquals(predecessorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 255, 0]);
    const expected = new Uint8Array([0, 0, 255]);
    assertEquals(predecessorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 255, 0, 0]);
    const expected = new Uint8Array([0, 255, 0]);
    assertEquals(predecessorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0]);
    const expected = new Uint8Array([]);
    assertEquals(predecessorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([]);
    const expected = new Uint8Array([]);
    assertEquals(predecessorPath(bytes), expected);
  }
});
