import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";
import pino from "pino";
const logger = pino({ level: "info" });
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    logger.warn({ event: "request_failed", status });
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        error:
          status === 401
            ? "Vui lòng đăng nhập lại."
            : status === 429
              ? "Bạn hãy chờ một chút rồi thử lại nhé."
              : "Mình gặp một chút trục trặc. Bạn có thể thử lại sau một lát.",
      });
  }
}
