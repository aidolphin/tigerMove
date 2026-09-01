type RateLimiter = {
  check(identifier: string, limit: number, windowMs: number): boolean;
  reset(identifier: string): void;
};

const store = new Map<string, number[]>();

export function createRateLimiter(): RateLimiter {
  return {
    check(identifier: string, limit: number, windowMs: number): boolean {
      const now = Date.now();
      const timestamps = store.get(identifier) || [];
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        return false;
      }
      recent.push(now);
      store.set(identifier, recent);
      return true;
    },
    reset(identifier: string): void {
      store.delete(identifier);
    },
  };
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("cf-connecting-ip");
  const ip = forwarded ? forwarded.split(",")[0].trim() : realIp || "unknown";
  return ip;
}
