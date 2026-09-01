import vinext from "vinext/server/app-router-entry";
import { Match } from "./match";
import { MatchmakingQueue } from "./matchmaking";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MATCH: DurableObjectNamespace;
  MATCHMAKING: DurableObjectNamespace;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

export { Match, MatchmakingQueue };

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!env.MATCH || !env.MATCHMAKING) {
      return new Response("Worker bindings not configured", { status: 500 });
    }

    if (url.pathname.startsWith("/_vinext/image")) {
      const allowedWidths = [...(await import("vinext/server/image-optimization")).DEFAULT_DEVICE_SIZES, ...(await import("vinext/server/image-optimization")).DEFAULT_IMAGE_SIZES];
      return (await import("vinext/server/image-optimization")).handleImageOptimization(request, {
        fetchAsset: (path: string) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body: ArrayBuffer, { width, format, quality }: { width: number; format: string; quality: number }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/matchmaking/quick" && request.method === "POST") {
      const queue = env.MATCHMAKING.get(env.MATCHMAKING.idFromName("global"));
      return queue.fetch(request);
    }

    const matchSegments = url.pathname.match(/^\/api\/matches\/([^\/]+)(\/.*)?$/);
    if (matchSegments) {
      const matchId = env.MATCH.idFromName(matchSegments[1]);
      const match = env.MATCH.get(matchId);
      const suffix = matchSegments[2] || "";
      const path = suffix === "/join" ? "/join" : "/info";
      const rewritten = new Request(
        new URL(path + (url.search ? url.search : "") + (url.hash || ""), url.origin),
        request,
      );
      return match.fetch(rewritten);
    }

    if (url.pathname === "/api/matches" && request.method === "POST") {
      const id = crypto.randomUUID();
      const matchId = env.MATCH.idFromName(id);
      const match = env.MATCH.get(matchId);
      const rewritten = new Request(new URL("/create" + (url.search ? url.search : ""), url.origin), request);
      return match.fetch(rewritten);
    }

    const wsMatchSegments = url.pathname.match(/^\/ws\/matches\/([^\/]+)$/);
    if (wsMatchSegments) {
      const matchId = env.MATCH.idFromName(wsMatchSegments[1]);
      const match = env.MATCH.get(matchId);
      return match.fetch(request);
    }

    const wsMatchmakingSegments = url.pathname.match(/^\/ws\/matchmaking\/([^\/]+)$/);
    if (wsMatchmakingSegments) {
      const queue = env.MATCHMAKING.get(env.MATCHMAKING.idFromName(wsMatchmakingSegments[1]));
      return queue.fetch(request);
    }

    return vinext.fetch(request, env, ctx);
  },
};

export default handler;
