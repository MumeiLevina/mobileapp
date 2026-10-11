import "reflect-metadata";
import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  DynamicModule,
  ExceptionFilter,
  HttpCode,
  HttpException,
  Inject,
  Module,
  Post,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import helmet from "helmet";
import { LLMProvider } from "../../ai/providers/provider";
import { HttpLLMProvider } from "../../ai/providers/http.provider";
import { LiveConfig, LIVE_CONFIG } from "./live.config";
import { PublicLiveRepository } from "./live.repository";
import { PublicMockProvider } from "./live.pipeline";
import { LiveFailure, PublicLiveService } from "./live.service";

@Controller("v1/live")
class PublicLiveController {
  constructor(
    private readonly service: PublicLiveService,
    @Inject(LIVE_CONFIG) private readonly config: LiveConfig,
  ) {}
  @Post()
  @HttpCode(200)
  handle(@Body() body: unknown) {
    // Principal comes only from server credential configuration, never the body.
    return this.service.handle(body, this.config.MORI_LIVE_PRINCIPAL);
  }
}
@Catch()
class PublicLiveErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status =
      error instanceof LiveFailure
        ? error.status
        : error instanceof HttpException
          ? error.getStatus()
          : 503;
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.too.large"
    )
      status = 413;
    if (status >= 500) status = 503;
    const code =
      error instanceof LiveFailure
        ? error.code
        : status === 404
          ? "NOT_FOUND"
          : status < 500
            ? "INVALID_REQUEST"
            : "UNAVAILABLE";
    response.status(status).json({ version: 1, type: "error", code });
  }
}
type ProviderFactory = (signal: AbortSignal) => LLMProvider;
@Module({})
export class PublicLiveModule {
  static register(
    config: LiveConfig,
    makeProvider?: ProviderFactory,
  ): DynamicModule {
    return {
      module: PublicLiveModule,
      controllers: [PublicLiveController],
      providers: [
        { provide: LIVE_CONFIG, useValue: config },
        {
          provide: PublicLiveRepository,
          useFactory: () =>
            new PublicLiveRepository(config.MORI_LIVE_STORE_DIR),
        },
        {
          provide: PublicLiveService,
          inject: [PublicLiveRepository],
          useFactory: (repository: PublicLiveRepository) =>
            new PublicLiveService(
              config,
              repository,
              makeProvider ??
                ((signal) =>
                  config.MORI_LIVE_MODE === "MOCK"
                    ? new PublicMockProvider()
                    : new HttpLLMProvider(
                        {
                          NODE_ENV: "production",
                          LLM_BASE_URL: config.LLM_BASE_URL,
                          LLM_API_KEY: config.LLM_API_KEY,
                          LLM_MODEL: config.LLM_MODEL,
                          LLM_TEXT_TIMEOUT_MS: 15000,
                          LLM_CLASSIFICATION_TIMEOUT_MS: 10000,
                          LLM_EMBEDDING_TIMEOUT_MS: 1000,
                        },
                        undefined,
                        signal,
                      )),
            ),
        },
      ],
    };
  }
}

export async function createPublicLiveApplication(
  config: LiveConfig,
  makeProvider?: ProviderFactory,
) {
  const app = await NestFactory.create<NestExpressApplication>(
    PublicLiveModule.register(config, makeProvider),
    {
      logger: false,
      bodyParser: false,
      abortOnError: false,
    },
  );
  const tokenHash = createHash("sha256")
    .update(`Bearer ${config.MORI_LIVE_API_TOKEN}`)
    .digest();
  let count = 0;
  let cancelCount = 0;
  let start = Date.now();
  app.use(helmet());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    const reject = (status: number, code: string) =>
      res.status(status).json({ version: 1, type: "error", code });
    if (
      req.headers.host !== `127.0.0.1:${req.socket.localPort}` ||
      req.headers.origin !== undefined ||
      (req.headers["sec-fetch-site"] &&
        req.headers["sec-fetch-site"] !== "none")
    )
      return reject(403, "FORBIDDEN");
    if (
      !timingSafeEqual(
        tokenHash,
        createHash("sha256")
          .update(req.headers.authorization ?? "")
          .digest(),
      )
    )
      return reject(401, "UNAUTHORIZED");
    if (
      req.method === "POST" &&
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
        req.headers["content-type"] ?? "",
      )
    )
      return reject(415, "INVALID_REQUEST");
    next();
  });
  app.useBodyParser("json", { limit: "16kb", strict: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (Date.now() - start >= 60000) {
      count = 0;
      cancelCount = 0;
      start = Date.now();
    }
    // A separate allowance keeps cancellation usable after normal request throttling.
    const cancelling =
      req.method === "POST" &&
      req.path === "/v1/live" &&
      req.body?.type === "turn.cancel";
    if (
      cancelling
        ? ++cancelCount > 120
        : ++count > config.MORI_LIVE_REQUESTS_PER_MINUTE
    ) {
      res
        .status(429)
        .json({ version: 1, type: "error", code: "QUOTA_EXCEEDED" });
      return;
    }
    next();
  });
  app.useGlobalFilters(new PublicLiveErrorFilter());
  await app.init();
  const server = app.getHttpServer();
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxConnections = 32;
  return app;
}
