import { assertEquals } from "$std/assert/assert_equals.ts";
import { successorPath, successorTimestamp } from "./successors.ts";

Deno.test("successorTimestamp", () => {
  {
    const bytes = new Uint8Array([0, 0, 0, 0]);
    const expected = new Uint8Array([0, 0, 0, 1]);
    assertEquals(successorTimestamp(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 0, 255]);
    const expected = new Uint8Array([0, 0, 1, 0]);
    assertEquals(successorTimestamp(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 255, 255]);
    const expected = new Uint8Array([0, 1, 0, 0]);
    assertEquals(successorTimestamp(bytes), expected);
  }

  {
    const bytes = new Uint8Array([255, 255, 255, 255]);
    const expected = new Uint8Array([255, 255, 255, 255]);
    assertEquals(successorTimestamp(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 7, 8]);
    const expected = new Uint8Array([0, 0, 7, 9]);
    assertEquals(successorTimestamp(bytes), expected);
  }
});

Deno.test("successorPath", () => {
  {
    const bytes = new Uint8Array([0, 0, 0, 0]);
    const expected = new Uint8Array([0, 0, 0, 1]);
    assertEquals(successorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 0, 255]);
    const expected = new Uint8Array([0, 0, 0, 255, 0]);
    assertEquals(successorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 255, 0]);
    const expected = new Uint8Array([0, 0, 255, 1]);
    assertEquals(successorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 255, 255]);
    const expected = new Uint8Array([0, 0, 255, 255, 0]);
    assertEquals(successorPath(bytes), expected);
  }
});
