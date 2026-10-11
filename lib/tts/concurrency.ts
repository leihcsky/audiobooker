type Waiter = () => void;

type Gate = { active: number; queue: Waiter[] };

const gates = new Map<string, Gate>();

/**
 * Process-local limiter for provider calls. It caps concurrent requests per
 * provider inside one server process; it is not a distributed lock.
 */
export async function withProviderSlot<T>(
  providerId: string,
  maxConcurrency: number,
  task: () => Promise<T>,
): Promise<T> {
  const gate = gates.get(providerId) ?? { active: 0, queue: [] };
  gates.set(providerId, gate);

  if (gate.active >= Math.max(1, maxConcurrency)) {
    await new Promise<void>((resolve) => gate.queue.push(resolve));
  } else {
    gate.active += 1;
  }
  try {
    return await task();
  } finally {
    const next = gate.queue.shift();
    if (next) {
      next();
    } else {
      gate.active -= 1;
    }
  }
}
