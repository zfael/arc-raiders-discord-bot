import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// Use pino-pretty for development (human readable), raw JSON for production (performance)
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
  },
  isProduction
    ? undefined // Use default destination (stdout) with JSON format
    : pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: false,
        },
      }),
);
