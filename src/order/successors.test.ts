import { assertEquals } from "$std/assert/assert_equals.ts";
import { makeSuccessorPath, successorTimestamp } from "./successors.ts";

Deno.test("successorTimestamp", () => {
  {
    const time = BigInt(0);
    const expected = BigInt(1);
    assertEquals(successorTimestamp(time), expected);
  }
});

Deno.test("successorPath", () => {
  const successorPath = makeSuccessorPath(4);

  {
    const bytes = new Uint8Array([0, 0, 0, 0]);
    const expected = new Uint8Array([0, 0, 0, 1]);
    assertEquals(successorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 0, 255]);
    const expected = new Uint8Array([0, 0, 1, 0]);
    assertEquals(successorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([0, 0, 255, 0]);
    const expected = new Uint8Array([0, 0, 255, 1]);
    assertEquals(successorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array([255, 255, 255, 255]);
    const expected = new Uint8Array([255, 255, 255, 255]);
    assertEquals(successorPath(bytes), expected);
  }

  {
    const bytes = new Uint8Array(0);
    const expected = new Uint8Array([0]);
    assertEquals(successorPath(bytes), expected);
  }
});
