import { assertEquals } from "$std/assert/assert_equals.ts";
import { predecessorPath, predecessorTimestamp } from "./predecessors.ts";

Deno.test("predecessorTimestamp", () => {
  {
    const bytes = new Uint8Array([0, 0, 0, 255]);
    const expected = new Uint8Array([0, 0, 0, 254]);
    assertEquals(predecessorTimestamp(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 255, 0]);
    const expected = new Uint8Array([0, 0, 254, 255]);
    assertEquals(predecessorTimestamp(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 255, 0, 0]);
    const expected = new Uint8Array([0, 254, 255, 255]);
    assertEquals(predecessorTimestamp(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 0, 0]);
    const expected = new Uint8Array([0, 0, 0, 0]);
    assertEquals(predecessorTimestamp(bytes), expected);
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
