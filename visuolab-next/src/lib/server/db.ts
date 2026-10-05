import "server-only";
import { env } from "cloudflare:workers";
import { configureMedia } from "@/lib/media/url";

/** The D1 database (binding DB). Server code only. */
export const getDb = (): D1Database => {
  configureMedia(env.MEDIA_BASE_URL, env.IMAGE_TRANSFORMS); // every page reads media through the database, so this is where the media domain is picked up
  return env.DB;
};

export const getEnv = () => env;
