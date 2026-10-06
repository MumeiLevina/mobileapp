import { Injectable, Optional } from "@nestjs/common";
import pino from "pino";

type MetricFields = Record<string, string | number | boolean | undefined>;

export interface MetricLogger {
  info(fields: MetricFields): void;
  warn(fields: MetricFields): void;
}

@Injectable()
export class MetricsService {
  constructor(
    @Optional()
    private readonly logger: MetricLogger = pino({
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
    }),
  ) {}

  request(fields: {
    request_id: string;
    endpoint: string;
    status: number;
    duration_ms: number;
  }) {
    this.logger.info({ event: "http_request", ...fields });
  }

  safetyDecision(fields: {
    safety_level: string;
    classifier_status: string;
    requires_escalation: boolean;
  }) {
    this.logger.info({ event: "safety_decision", ...fields });
  }

  outputGuardRejected(reason: "lexical" | "reviewer" | "unavailable") {
    this.logger.warn({ event: "output_guard_rejected", reason });
  }
}
