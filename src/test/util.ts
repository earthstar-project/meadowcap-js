import { Interval, ThreeDimensionalInterval } from "../intervals/types.ts";
import { orderPaths, orderTimestamps } from "../order/orders.ts";
import {
  predecessorPath,
  predecessorTimestamp,
} from "../order/predecessors.ts";
import { makeSuccessorPath, successorTimestamp } from "../order/successors.ts";
import { PredecessorFn, SuccessorFn, TotalOrder } from "../order/types.ts";
import {
  DisjointInterval,
  ThreeDimensionalProduct,
} from "../products/types.ts";
import { rangeFromInterval } from "../ranges/ranges.ts";
import { Range, ThreeDimensionalRange } from "../ranges/types.ts";

export function getRandomIntervalKind(): Interval<number>["kind"] {
  return Math.random() > 0.5 ? "open" : "closed_exclusive";
}

export function randomOpenInterval<ValueType>(
  minValue: ValueType,
  successor: SuccessorFn<ValueType>,
  maxIterations = 100,
): Extract<Interval<ValueType>, { kind: "open" }> {
  let start = minValue;

  for (let i = 0; i < Math.random() * maxIterations; i++) {
    start = successor(start);
  }

  return {
    kind: "open",
    start,
  };
}

export function randomClosedInterval<ValueType>(
  minValue: ValueType,
  successor: SuccessorFn<ValueType>,
  maxIterations = 100,
): Extract<Interval<ValueType>, { kind: "closed_exclusive" }> {
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

export function randomClosedIntervalInvalid<ValueType>(
  maxValue: ValueType,
  predecessor: PredecessorFn<ValueType>,
  maxIterations = 100,
): Extract<Interval<ValueType>, { kind: "closed_exclusive" }> {
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

export function getRandomInterval<ValueType>(
  { minValue, successor }: {
    minValue: ValueType;
    successor: SuccessorFn<ValueType>;
  },
): Interval<ValueType> {
  const rangeKind = getRandomIntervalKind();

  switch (rangeKind) {
    case "open": {
      return randomOpenInterval(minValue, successor);
    }
    case "closed_exclusive": {
      return randomClosedInterval(minValue, successor);
    }
  }
}

export function getRandomRange<ValueType>(
  { minValue, predecessor, successor }: {
    minValue: ValueType;
    predecessor: PredecessorFn<ValueType>;
    successor: SuccessorFn<ValueType>;
  },
): Range<ValueType> {
  const interval = getRandomInterval({ minValue, successor });

  return rangeFromInterval({
    predecessor,
    isInclusiveSmaller: () => Math.random() > 0.5,
  }, interval);
}

export function getRandomClosedRangeInvalid<ValueType>(
  { maxValue, predecessor }: {
    maxValue: ValueType;
    predecessor: PredecessorFn<ValueType>;
  },
): Range<ValueType> {
  const interval = randomClosedIntervalInvalid(maxValue, predecessor);

  return rangeFromInterval({
    predecessor,
    isInclusiveSmaller: () => Math.random() > 0.5,
  }, interval);
}

export function getRandom3dInterval<ValueType>(
  { minSubspaceValue, minPathValue, minTimeValue, successorSubspace }: {
    minSubspaceValue: ValueType;
    minPathValue: Uint8Array;
    minTimeValue: bigint;
    successorSubspace: SuccessorFn<ValueType>;
  },
): ThreeDimensionalInterval<ValueType> {
  const subspaceRange = getRandomInterval({
    minValue: minSubspaceValue,
    successor: successorSubspace,
  });

  const pathRange = getRandomInterval({
    minValue: minPathValue,
    successor: makeSuccessorPath(4),
  });

  const timeRange = getRandomInterval({
    minValue: minTimeValue,
    successor: successorTimestamp,
  });

  return [
    subspaceRange,
    pathRange,
    timeRange,
  ];
}

export function getRandomRange3d<ValueType>(
  {
    minSubspaceValue,
    minPathValue,
    minTimeValue,
    predecessorSubspace,
    successorSubspace,
  }: {
    minSubspaceValue: ValueType;
    minPathValue: Uint8Array;
    minTimeValue: bigint;
    predecessorSubspace: PredecessorFn<ValueType>;
    successorSubspace: SuccessorFn<ValueType>;
  },
): ThreeDimensionalRange<ValueType> {
  const subspaceRange = getRandomRange({
    minValue: minSubspaceValue,
    successor: successorSubspace,
    predecessor: predecessorSubspace,
  });

  const pathRange = getRandomRange({
    minValue: minPathValue,
    successor: makeSuccessorPath(4),
    predecessor: predecessorPath,
  });

  const timeRange = getRandomRange({
    minValue: minTimeValue,
    successor: successorTimestamp,
    predecessor: predecessorTimestamp,
  });

  return [
    subspaceRange,
    pathRange,
    timeRange,
  ];
}

export function getRandomInvalidRange3d<ValueType>(
  {
    maxSubspaceValue,
    maxPathValue,
    maxTimeValue,
    predecessorSubspace,
  }: {
    maxSubspaceValue: ValueType;
    maxPathValue: Uint8Array;
    maxTimeValue: bigint;
    predecessorSubspace: PredecessorFn<ValueType>;
  },
): ThreeDimensionalRange<ValueType> {
  const subspaceRange = getRandomClosedRangeInvalid({
    maxValue: maxSubspaceValue,
    predecessor: predecessorSubspace,
  });

  const pathRange = getRandomClosedRangeInvalid({
    maxValue: maxPathValue,
    predecessor: predecessorPath,
  });

  const timeRange = getRandomClosedRangeInvalid({
    maxValue: maxTimeValue,
    predecessor: predecessorTimestamp,
  });

  return [
    subspaceRange,
    pathRange,
    timeRange,
  ];
}

export function getRandom3dIntervalInvalid<ValueType>(
  {
    minSubspaceValue,
    maxSubspaceValue,
    minPathValue,
    maxPathValue,
    minTimeValue,
    maxTimeValue,
    predecessorSubspace,
    successorSubspace,
  }: {
    minSubspaceValue: ValueType;
    maxSubspaceValue: ValueType;
    minPathValue: Uint8Array;
    maxPathValue: Uint8Array;
    minTimeValue: bigint;
    maxTimeValue: bigint;
    predecessorSubspace: PredecessorFn<ValueType>;
    successorSubspace: SuccessorFn<ValueType>;
  },
): ThreeDimensionalInterval<ValueType> {
  let subspaceValid = Math.random() > 0.15;
  let pathValid = Math.random() > 0.15;
  let timeValid = Math.random() > 0.15;

  if (subspaceValid && pathValid && timeValid) {
    subspaceValid = false;
    pathValid = false;
    timeValid = false;
  }

  const subspaceRange = subspaceValid
    ? getRandomInterval({
      minValue: minSubspaceValue,
      successor: successorSubspace,
    })
    : randomClosedIntervalInvalid(maxSubspaceValue, predecessorSubspace);

  const pathRange = pathValid
    ? getRandomInterval({
      minValue: minPathValue,
      successor: makeSuccessorPath(4),
    })
    : randomClosedIntervalInvalid(maxPathValue, predecessorPath);

  const timeRange = timeValid
    ? getRandomInterval({
      minValue: minTimeValue,
      successor: successorTimestamp,
    })
    : randomClosedIntervalInvalid(maxTimeValue, predecessorTimestamp);

  return [
    subspaceRange,
    pathRange,
    timeRange,
  ];
}

export function getRandomDisjointInterval<ValueType>(
  { minValue, successor, order, maxSize }: {
    minValue: ValueType;
    successor: SuccessorFn<ValueType>;
    maxSize: ValueType;
    order: TotalOrder<ValueType>;
  },
): DisjointInterval<ValueType> {
  const disjointInterval: DisjointInterval<ValueType> = [];

  while (true) {
    const startDelta = Math.floor(Math.random() * (10 - 1) + 1);

    const isOpen = Math.random() < 0.15;

    let start = minValue;

    if (isOpen) {
      for (let i = 0; i < startDelta; i++) {
        start = successor(start);
      }

      disjointInterval.push({
        kind: "open",
        start,
      });

      break;
    }

    const size = Math.floor(Math.random() * (10 - 1) + 1);

    let end = start;

    for (let i = 0; i < size; i++) {
      const next = successor(end);

      if (order(next, maxSize) <= 0) {
        end = next;
      }
    }

    disjointInterval.push({
      kind: "closed_exclusive",
      start,
      end,
    });

    if (order(end, maxSize) >= 0) {
      break;
    }
  }

  return disjointInterval;
}

export function getRandom3dProduct<ValueType>(
  { minValue, successor, order, maxSize, noEmpty }: {
    minValue: ValueType;
    successor: SuccessorFn<ValueType>;
    maxSize: ValueType;
    order: TotalOrder<ValueType>;
    noEmpty?: boolean;
  },
): ThreeDimensionalProduct<ValueType> {
  const isEmpty = Math.random() > 0.75;

  if (!noEmpty && isEmpty) {
    return [[], [], []];
  }

  return [
    getRandomDisjointInterval({
      minValue,
      maxSize,
      order,
      successor,
    }),
    getRandomDisjointInterval({
      minValue: new Uint8Array(),
      maxSize: new Uint8Array([0, 0, 0, 255]),
      order: orderPaths,
      successor: makeSuccessorPath(4),
    }),
    getRandomDisjointInterval({
      minValue: BigInt(0),
      maxSize: BigInt(1000),
      order: orderTimestamps,
      successor: successorTimestamp,
    }),
  ];
}

export function getIncludedValues<ValueType>({ max, order, successor }: {
  max: ValueType;
  successor: SuccessorFn<ValueType>;
  order: TotalOrder<ValueType>;
}, interval: Interval<ValueType>): ValueType[] {
  if (interval.kind === "open") {
    let prev = interval.start;

    const values = [];

    while (order(prev, max) < 1) {
      values.push(prev);
      prev = successor(prev);
    }

    return values;
  } else {
    let prev = interval.start;

    const values = [];

    while (
      order(prev, max) < 1 &&
      interval.kind === "closed_exclusive" && order(prev, interval.end) < 0
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
  interval3d: ThreeDimensionalInterval<SubspaceType>,
): [SubspaceType[], Uint8Array[], bigint[]] {
  const [subspace, path, time] = interval3d;

  const subspaceValues = getIncludedValues({
    max: maxSubspace,
    order: orderSubspace,
    successor: successorSubspace,
  }, subspace);

  const pathValues = getIncludedValues({
    max: maxPath,
    order: orderPaths,
    successor: makeSuccessorPath(4),
  }, path);

  const timeValues = getIncludedValues({
    max: maxTime,
    order: orderTimestamps,
    successor: successorTimestamp,
  }, time);

  return [subspaceValues, pathValues, timeValues];
}

export function successorNumber(num: number) {
  return num + 1;
}

export function predecessorNumber(num: number) {
  return num - 1;
}

export function orderNumber(a: number, b: number) {
  if (a > b) {
    return 1;
  } else if (a < b) {
    return -1;
  }

  return 0;
}

export function getIncludedValuesDisjointInterval<ValueType>(
  { max, order, successor }: {
    max: ValueType;
    successor: SuccessorFn<ValueType>;
    order: TotalOrder<ValueType>;
  },
  disjointInterval: DisjointInterval<ValueType>,
): ValueType[] {
  const values: ValueType[] = [];

  for (const interval of disjointInterval) {
    const intervalValues = getIncludedValues({
      max,
      order,
      successor,
    }, interval);

    for (const intervalValue of intervalValues) {
      if (values.find((v) => order(v, intervalValue) === 0) === undefined) {
        values.push(intervalValue);
      }
    }
  }

  return Array.from(values);
}

export function getIncludedValues3dProduct<ValueType>(
  { maxSubspace, orderSubspace, successorSubspace }: {
    maxSubspace: ValueType;
    successorSubspace: SuccessorFn<ValueType>;
    orderSubspace: TotalOrder<ValueType>;
  },
  product: ThreeDimensionalProduct<ValueType>,
): [ValueType[], Uint8Array[], bigint[]] {
  const [subspace, path, time] = product;

  return [
    getIncludedValuesDisjointInterval({
      max: maxSubspace,
      successor: successorSubspace,
      order: orderSubspace,
    }, subspace),
    getIncludedValuesDisjointInterval({
      max: new Uint8Array([0, 0, 0, 255]),
      order: orderPaths,
      successor: makeSuccessorPath(4),
    }, path),
    getIncludedValuesDisjointInterval({
      max: BigInt(1000),
      order: orderTimestamps,
      successor: successorTimestamp,
    }, time),
  ];
}
