import { orderPaths, orderTimestamps } from "../order/orders.ts";
import { predecessorPath } from "../order/predecessors.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import { Range, ThreeDimensionalRange } from "../ranges/types.ts";

export function getRandomRangeKind(): Range<number>["kind"] {
  const roll = Math.random();

  return roll > 0.66
    ? "open"
    : roll > 0.33
    ? "closed_exclusive"
    : "closed_inclusive";
}

export function randomOpenRange<ValueType>(
  minValue: ValueType,
  successor: SuccessorFn<ValueType>,
  maxIterations = 100,
): Extract<Range<ValueType>, { kind: "open" }> {
  let start = minValue;

  for (let i = 0; i < Math.random() * maxIterations; i++) {
    start = successor(start);
  }

  return {
    kind: "open",
    start,
  };
}

export function randomClosedExclusiveRange<ValueType>(
  minValue: ValueType,
  successor: SuccessorFn<ValueType>,
  maxIterations = 100,
): Extract<Range<ValueType>, { kind: "closed_exclusive" }> {
  let start = minValue;

  const iterations = Math.round(Math.random() * maxIterations);

  for (let i = 0; i < iterations / 2; i++) {
    start = successor(start);
  }

  let end = start;

  for (let i = 0; i < (iterations / 2) + 1; i++) {
    end = successor(end);
  }

  return {
    kind: "closed_exclusive",
    start,
    end,
  };
}

export function randomClosedInclusiveRange<ValueType>(
  minValue: ValueType,
  successor: SuccessorFn<ValueType>,
  maxIterations = 100,
): Extract<Range<ValueType>, { kind: "closed_inclusive" }> {
  let start = minValue;

  const iterations = Math.round(Math.random() * maxIterations);

  for (let i = 0; i < iterations / 2; i++) {
    start = successor(start);
  }

  let end = start;

  for (let i = 0; i < iterations / 2; i++) {
    end = successor(end);
  }

  return {
    kind: "closed_inclusive",
    start,
    end,
  };
}

export function randomClosedExclusiveRangeInvalid<ValueType>(
  maxValue: ValueType,
  predecessor: PredecessorFn<ValueType>,
  maxIterations = 100,
): Extract<Range<ValueType>, { kind: "closed_exclusive" }> {
  let start = maxValue;

  const iterations = Math.round(Math.random() * maxIterations);

  for (let i = 0; i < iterations; i++) {
    start = predecessor(start);
  }

  let end = start;

  for (let i = 0; i < iterations; i++) {
    end = predecessor(end);
  }

  return {
    kind: "closed_exclusive",
    start,
    end,
  };
}

export function randomClosedInclusiveRangeInvalid<ValueType>(
  maxValue: ValueType,
  predecessor: PredecessorFn<ValueType>,
  maxIterations = 100,
): Extract<Range<ValueType>, { kind: "closed_inclusive" }> {
  let start = maxValue;

  const iterations = Math.round(Math.random() * maxIterations);

  for (let i = 0; i < iterations / 2; i++) {
    start = predecessor(start);
  }

  let end = start;

  for (let i = 0; i < (iterations / 2) + 1; i++) {
    end = predecessor(end);
  }

  return {
    kind: "closed_inclusive",
    start,
    end,
  };
}

export function getRandomRange<ValueType>(
  { minValue, successor }: {
    minValue: ValueType;
    successor: SuccessorFn<ValueType>;
  },
): Range<ValueType> {
  const rangeKind = getRandomRangeKind();

  switch (rangeKind) {
    case "open": {
      return randomOpenRange(minValue, successor);
    }
    case "closed_exclusive": {
      return randomClosedInclusiveRange(minValue, successor);
    }
    case "closed_inclusive": {
      return randomClosedInclusiveRange(minValue, successor);
    }
  }
}

export function getRandomRangeInvalid<ValueType>(
  { maxValue, predecessor }: {
    maxValue: ValueType;
    predecessor: PredecessorFn<ValueType>;
  },
): Range<ValueType> {
  const rangeKind = Math.random() > 0.5
    ? "closed_exclusive"
    : "closed_inclusive";

  switch (rangeKind) {
    case "closed_exclusive": {
      return randomClosedExclusiveRangeInvalid(maxValue, predecessor);
    }
    case "closed_inclusive": {
      return randomClosedExclusiveRangeInvalid(maxValue, predecessor);
    }
  }
}

export function getRandom3dRange<ValueType>(
  { minSubspaceValue, minPathValue, minTimeValue, successorSubspace }: {
    minSubspaceValue: ValueType;
    minPathValue: Uint8Array;
    minTimeValue: bigint;
    successorSubspace: SuccessorFn<ValueType>;
  },
): ThreeDimensionalRange<ValueType> {
  const subspaceRange = getRandomRange({
    minValue: minSubspaceValue,
    successor: successorSubspace,
  });

  const pathRange = getRandomRange({
    minValue: minPathValue,
    successor: makeSuccessorPath(4),
  });

  const minTimeBytes = new Uint8Array(8);
  const minTimeView = new DataView(minTimeBytes.buffer);
  minTimeView.setBigUint64(0, minTimeValue);

  const timeRange = getRandomRange({
    minValue: minTimeBytes,
    successor: successorTimestamp,
  });

  return [
    timeRange,
    pathRange,
    subspaceRange,
  ];
}

export function getRandom3dRangeInvalid<ValueType>(
  { maxSubspaceValue, maxPathValue, maxTimeValue, predecessorSubspace }: {
    maxSubspaceValue: ValueType;
    maxPathValue: Uint8Array;
    maxTimeValue: bigint;
    predecessorSubspace: PredecessorFn<ValueType>;
  },
): ThreeDimensionalRange<ValueType> {
  let subspaceValid = Math.random() > 0.15;
  let pathValid = Math.random() > 0.15;
  let timeValid = Math.random() > 0.15;

  if (subspaceValid && pathValid && timeValid) {
    subspaceValid = false;
    pathValid = false;
    timeValid = false;
  }

  const subspaceRange = getRandomRangeInvalid({
    maxValue: maxSubspaceValue,
    predecessor: predecessorSubspace,
  });

  const pathRange = getRandomRangeInvalid({
    maxValue: maxPathValue,
    predecessor: predecessorPath,
  });

  const maxTimeBytes = new Uint8Array(8);
  const maxTimeView = new DataView(maxTimeBytes.buffer);
  maxTimeView.setBigUint64(0, maxTimeValue);

  const timeRange = getRandomRangeInvalid({
    maxValue: maxTimeBytes,
    predecessor: successorTimestamp,
  });

  return [
    timeRange,
    pathRange,
    subspaceRange,
  ];
}

export function getIncludedValues<ValueType>({ max, order, successor }: {
  max: ValueType;
  successor: SuccessorFn<ValueType>;
  order: TotalOrder<ValueType>;
}, range: Range<ValueType>): ValueType[] {
  if (range.kind === "open") {
    let prev = range.start;

    const values = [];

    while (order(prev, max) < 1) {
      values.push(prev);
      prev = successor(prev);
    }

    return values;
  } else {
    let prev = range.start;

    const values = [];

    while (
      order(prev, max) < 1 &&
      ((range.kind === "closed_exclusive" && order(prev, range.end) < 0) ||
        (range.kind === "closed_inclusive" && order(prev, range.end) <= 0))
    ) {
      values.push(prev);
      prev = successor(prev);
    }

    return values;
  }
}

export function getIncludedValues3d<SubspaceType>(
  { maxTime, maxPath, maxSubspace, orderSubspace, successorSubspace }: {
    maxTime: bigint;
    maxPath: Uint8Array;
    orderSubspace: TotalOrder<SubspaceType>;
    successorSubspace: SuccessorFn<SubspaceType>;
    maxSubspace: SubspaceType;
  },
  range3d: ThreeDimensionalRange<SubspaceType>,
): [bigint[], Uint8Array[], SubspaceType[]] {
  const [time, path, subspace] = range3d;

  const maxTimeBytes = new Uint8Array(8);
  const maxTimeView = new DataView(maxTimeBytes.buffer);
  maxTimeView.setBigUint64(0, maxTime);

  const timeValues = getIncludedValues({
    max: maxTimeBytes,
    order: orderTimestamps,
    successor: successorTimestamp,
  }, time).map((bytes) => {
    const view = new DataView(bytes.buffer);

    return view.getBigUint64(0);
  });

  const pathValues = getIncludedValues({
    max: maxPath,
    order: orderPaths,
    successor: makeSuccessorPath(4),
  }, path);

  const subspaceValues = getIncludedValues({
    max: maxSubspace,
    order: orderSubspace,
    successor: successorSubspace,
  }, subspace);

  return [timeValues, pathValues, subspaceValues];
}
