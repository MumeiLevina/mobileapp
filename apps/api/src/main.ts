import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import pino from "pino";
import { AppModule } from "./app.module";
import { readConfig } from "./config/env";
import { ErrorFilter } from "./common/error.filter";
import { MetricsService } from "./observability/metrics.service";
import { requestMetricsMiddleware } from "./observability/request-metrics.middleware";
async function bootstrap() {
  const env = readConfig();
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(requestMetricsMiddleware(app.get(MetricsService)));
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGIN.split(","),
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["X-Request-ID"],
  });
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  await app.listen(env.PORT, "0.0.0.0");
  pino().info({
    event: "api_started",
    port: env.PORT,
    mockAI: env.MOCK_AI === "true",
  });
}
bootstrap().catch(() => {
  pino().fatal({
    event: "startup_failed",
    hint: "Check server environment configuration",
  });
  process.exitCode = 1;
});
