import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import type { OutboxOperation } from "../app/local-data/models";
import { SYNC_PROTOCOL_VERSION, SyncProtocolError } from "../app/sync/protocol";
import type { SyncStore } from "./store";

export interface SyncHttpOptions {
  allowedOrigin: string;
}

function bearer(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw new SyncProtocolError("UNAUTHORIZED_DEVICE", "Bearer credential is required.", 401);
  }
  return authorization.slice("Bearer ".length);
}

function errorReply(error: unknown, reply: FastifyReply): void {
  if (error instanceof SyncProtocolError) {
    void reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  void reply.status(500).send({
    error: { code: "INTERNAL_ERROR", message: "The sync server could not complete the request." },
  });
}

export function createSyncHttpServer(
  store: SyncStore,
  options: SyncHttpOptions,
): FastifyInstance {
  const server = Fastify({
    bodyLimit: 1024 * 1024,
    logger: {
      level: "info",
      redact: [
        "req.headers.authorization",
        "req.body.password",
        "req.body.operations",
        "res.body",
      ],
    },
  });

  server.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && origin !== options.allowedOrigin) {
      throw new SyncProtocolError("ORIGIN_NOT_ALLOWED", "Request origin is not allowed.", 403);
    }
    if (origin) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
    }
    reply.header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Shop-Password");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header("Cache-Control", "no-store");
    if (request.method === "OPTIONS") {
      await reply.status(204).send();
    }
  });

  server.get("/health", async () => ({ status: "ok", protocolVersion: 1 }));

  server.post("/sync/v1/enroll", async (request, reply) => {
    try {
      return store.enroll(request.body as never);
    } catch (error) {
      errorReply(error, reply);
    }
  });

  server.post("/sync/v1/push", async (request, reply) => {
    try {
      const body = request.body as {
        protocolVersion?: number;
        operations?: OutboxOperation[];
      };
      if (
        body?.protocolVersion !== SYNC_PROTOCOL_VERSION ||
        !Array.isArray(body.operations)
      ) {
        throw new SyncProtocolError("INVALID_REQUEST", "Valid protocol version and operations are required.");
      }
      return store.push(bearer(request), body.operations);
    } catch (error) {
      errorReply(error, reply);
    }
  });

  server.get("/sync/v1/pull", async (request, reply) => {
    try {
      const query = request.query as { cursor?: string; limit?: string };
      const limit = query.limit === undefined ? undefined : Number(query.limit);
      return store.pull(
        bearer(request),
        query.cursor ?? "0",
        limit,
      );
    } catch (error) {
      errorReply(error, reply);
    }
  });

  server.post("/sync/v1/admin/devices/:deviceId/revoke", async (request, reply) => {
    try {
      const password = request.headers["x-shop-password"];
      if (typeof password !== "string") {
        throw new SyncProtocolError("INVALID_PASSWORD", "Shop password is required.", 401);
      }
      const params = request.params as { deviceId: string };
      store.revoke(password, params.deviceId);
      return { status: "revoked" };
    } catch (error) {
      errorReply(error, reply);
    }
  });

  server.post(
    "/sync/v1/admin/devices/:deviceId/decommission",
    async (request, reply) => {
      try {
        const password = request.headers["x-shop-password"];
        if (typeof password !== "string") {
          throw new SyncProtocolError(
            "INVALID_PASSWORD",
            "Shop password is required.",
            401,
          );
        }
        const params = request.params as { deviceId: string };
        store.decommission(password, params.deviceId);
        return { status: "decommissioned" };
      } catch (error) {
        errorReply(error, reply);
      }
    },
  );

  server.setErrorHandler((error, _request, reply) => {
    errorReply(error, reply);
  });
  return server;
}
