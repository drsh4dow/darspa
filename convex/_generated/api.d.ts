/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as administrators from "../administrators.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as development from "../development.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_developmentSync from "../lib/developmentSync.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_signInEmail from "../lib/signInEmail.js";
import type * as migrationIdentity from "../migrationIdentity.js";
import type * as secretSync from "../secretSync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  administrators: typeof administrators;
  auth: typeof auth;
  crons: typeof crons;
  development: typeof development;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/developmentSync": typeof lib_developmentSync;
  "lib/email": typeof lib_email;
  "lib/identity": typeof lib_identity;
  "lib/signInEmail": typeof lib_signInEmail;
  migrationIdentity: typeof migrationIdentity;
  secretSync: typeof secretSync;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
