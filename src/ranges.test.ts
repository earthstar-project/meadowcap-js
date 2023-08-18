import { assert } from "$std/assert/mod.ts";
import {
  isSensible3dRange,
  isSensibleRange,
  Range,
  ThreeDimensionalRange,
} from "./ranges.ts";

function orderNumber(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  }

  return 0;
}

Deno.test("isRangeSensible", () => {
  const nonsenseRange1: Range<number> = {
    kind: "closed",
    start: 1,
    end: 1,
  };

  const nonsenseRange2: Range<number> = {
    kind: "closed",
    start: 2,
    end: 1,
  };

  assert(!isSensibleRange(orderNumber, nonsenseRange1));
  assert(!isSensibleRange(orderNumber, nonsenseRange2));

  const sensibleRange1: Range<number> = {
    kind: "closed",
    start: 1,
    end: 3,
  };

  const sensibleRange2: Range<number> = {
    kind: "open",
    start: 3,
  };

  assert(isSensibleRange(orderNumber, sensibleRange1));
  assert(isSensibleRange(orderNumber, sensibleRange2));
});

Deno.test("is3dRangeSensible", () => {
  const timestampOld = new Uint8Array(8);
  const timestampOldView = new DataView(timestampOld.buffer);
  timestampOldView.setBigUint64(0, BigInt(1000));

  const timestampNew = new Uint8Array(8);
  const timestampNewView = new DataView(timestampNew.buffer);
  timestampNewView.setBigUint64(0, BigInt(3000));

  const pathA = new TextEncoder().encode("aaaa");
  const pathG = new TextEncoder().encode("gggg");

  const sensibleRange: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed",
      start: pathA,
      end: pathG,
    },
    {
      kind: "open",
      start: 8,
    },
  ];

  assert(isSensible3dRange(orderNumber, sensibleRange));

  const nonsenseRange1: ThreeDimensionalRange<number> = [
    {
      kind: "closed",
      start: timestampOld,
      end: timestampNew,
    },
    {
      kind: "closed",
      start: pathG,
      end: pathA,
    },
    {
      kind: "open",
      start: 1,
    },
  ];

  assert(!isSensible3dRange(orderNumber, nonsenseRange1));
});
