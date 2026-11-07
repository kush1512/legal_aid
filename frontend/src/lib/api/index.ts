import { config } from "../config";
import type { LegalAidApi } from "./client";
import { mockApi } from "../mock/api";
import { realApi } from "./real";

/** The only place the implementation is chosen. UI code imports `api` from here. */
export const api: LegalAidApi = config.apiMode === "real" ? realApi : mockApi;
export type { LegalAidApi } from "./client";
export * from "./types";
export { ApiError, describeError } from "./errors";
