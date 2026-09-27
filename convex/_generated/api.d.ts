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
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as development from "../development.js";
import type * as examOrders_email from "../examOrders/email.js";
import type * as examOrders_generate from "../examOrders/generate.js";
import type * as examOrders_http from "../examOrders/http.js";
import type * as examOrders_limits from "../examOrders/limits.js";
import type * as examOrders_model from "../examOrders/model.js";
import type * as examOrders_pdf from "../examOrders/pdf.js";
import type * as examOrders_workflow from "../examOrders/workflow.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_developmentSync from "../lib/developmentSync.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailLayout from "../lib/emailLayout.js";
import type * as lib_html from "../lib/html.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_runtime from "../lib/runtime.js";
import type * as lib_signInEmail from "../lib/signInEmail.js";
import type * as migrationIdentity from "../migrationIdentity.js";
import type * as operations_model from "../operations/model.js";
import type * as operations_records from "../operations/records.js";
import type * as purchasing_model from "../purchasing/model.js";
import type * as purchasing_payments from "../purchasing/payments.js";
import type * as purchasing_processor from "../purchasing/processor.js";
import type * as purchasing_purchases from "../purchasing/purchases.js";
import type * as purchasing_returns from "../purchasing/returns.js";
import type * as purchasing_transactions from "../purchasing/transactions.js";
import type * as purchasing_webpay from "../purchasing/webpay.js";
import type * as secretSync from "../secretSync.js";
import type * as vouchers_access from "../vouchers/access.js";
import type * as vouchers_deliveries from "../vouchers/deliveries.js";
import type * as vouchers_documents from "../vouchers/documents.js";
import type * as vouchers_email from "../vouchers/email.js";
import type * as vouchers_issuance from "../vouchers/issuance.js";
import type * as vouchers_lifecycle from "../vouchers/lifecycle.js";
import type * as vouchers_mail from "../vouchers/mail.js";
import type * as vouchers_model from "../vouchers/model.js";
import type * as vouchers_operations from "../vouchers/operations.js";
import type * as vouchers_pdf from "../vouchers/pdf.js";
import type * as vouchers_validity from "../vouchers/validity.js";
import type * as vouchers_vouchers from "../vouchers/vouchers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  administrators: typeof administrators;
  auth: typeof auth;
  catalog: typeof catalog;
  crons: typeof crons;
  development: typeof development;
  "examOrders/email": typeof examOrders_email;
  "examOrders/generate": typeof examOrders_generate;
  "examOrders/http": typeof examOrders_http;
  "examOrders/limits": typeof examOrders_limits;
  "examOrders/model": typeof examOrders_model;
  "examOrders/pdf": typeof examOrders_pdf;
  "examOrders/workflow": typeof examOrders_workflow;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/developmentSync": typeof lib_developmentSync;
  "lib/email": typeof lib_email;
  "lib/emailLayout": typeof lib_emailLayout;
  "lib/html": typeof lib_html;
  "lib/identity": typeof lib_identity;
  "lib/runtime": typeof lib_runtime;
  "lib/signInEmail": typeof lib_signInEmail;
  migrationIdentity: typeof migrationIdentity;
  "operations/model": typeof operations_model;
  "operations/records": typeof operations_records;
  "purchasing/model": typeof purchasing_model;
  "purchasing/payments": typeof purchasing_payments;
  "purchasing/processor": typeof purchasing_processor;
  "purchasing/purchases": typeof purchasing_purchases;
  "purchasing/returns": typeof purchasing_returns;
  "purchasing/transactions": typeof purchasing_transactions;
  "purchasing/webpay": typeof purchasing_webpay;
  secretSync: typeof secretSync;
  "vouchers/access": typeof vouchers_access;
  "vouchers/deliveries": typeof vouchers_deliveries;
  "vouchers/documents": typeof vouchers_documents;
  "vouchers/email": typeof vouchers_email;
  "vouchers/issuance": typeof vouchers_issuance;
  "vouchers/lifecycle": typeof vouchers_lifecycle;
  "vouchers/mail": typeof vouchers_mail;
  "vouchers/model": typeof vouchers_model;
  "vouchers/operations": typeof vouchers_operations;
  "vouchers/pdf": typeof vouchers_pdf;
  "vouchers/validity": typeof vouchers_validity;
  "vouchers/vouchers": typeof vouchers_vouchers;
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
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
