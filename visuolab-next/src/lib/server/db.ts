import "server-only";
import { env } from "cloudflare:workers";

/** The D1 database (binding DB). Server code only. */
export const getDb = (): D1Database => env.DB;

export const getEnv = () => env;
