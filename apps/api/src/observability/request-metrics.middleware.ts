import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { MetricsService } from "./metrics.service";

export type ObservedRequest = Request & { requestId?: string };

const validRequestId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export const requestMetricsMiddleware =
  (metrics: MetricsService) =>
  (request: ObservedRequest, response: Response, next: NextFunction) => {
    const incoming = request.headers["x-request-id"];
    const requestId = validRequestId(incoming) ? incoming : randomUUID();
    const startedAt = Date.now();
    request.requestId = requestId;
    response.setHeader("X-Request-ID", requestId);
    response.once("finish", () => {
      const route = request.route?.path ?? "unmatched";
      metrics.request({
        request_id: requestId,
        endpoint: `${request.method} ${route}`,
        status: response.statusCode,
        duration_ms: Date.now() - startedAt,
      });
    });
    next();
  };
