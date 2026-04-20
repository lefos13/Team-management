/* Normalize domain, validation, and persistence failures into one response envelope for the client. */
import { Prisma } from "@prisma/client";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  public constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, "BAD_REQUEST", message, details);
}

export function forbidden(message: string, details?: unknown): AppError {
  return new AppError(403, "FORBIDDEN", message, details);
}

export function unauthorized(message = "Unauthorized."): AppError {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, "CONFLICT", message, details);
}

export function notFound(resource: string): AppError {
  return new AppError(404, "NOT_FOUND", `${resource} was not found.`);
}

export function registerErrorHandler() {
  return async function errorHandler(error: unknown, _request: FastifyRequest, reply: FastifyReply) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: error.validation,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: error.flatten(),
        },
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return reply.status(409).send({
        error: {
          code: "CONFLICT",
          message: "A record with the same unique value already exists.",
        },
      });
    }

    reply.log.error(error);

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  };
}
