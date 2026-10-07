import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { PaymentStatus, ProviderResult, PurchaseLine, Voucher } from "../../shared/contracts";

export const user = sqliteTable("user", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: "boolean" }).notNull().default(false),
  image: text(),
  role: text({ enum: ["customer", "administrator"] })
    .notNull()
    .default("customer"),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    token: text().notNull().unique(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    createdAt: integer({ mode: "timestamp_ms" }).notNull(),
    updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
    ipAddress: text(),
    userAgent: text(),
  },
  (table) => [index("session_user").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    scope: text(),
    password: text(),
    accessTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    createdAt: integer({ mode: "timestamp_ms" }).notNull(),
    updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("account_user").on(table.userId),
    uniqueIndex("account_provider").on(table.providerId, table.accountId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    createdAt: integer({ mode: "timestamp_ms" }).notNull(),
    updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_identifier").on(table.identifier)],
);

export const rateLimit = sqliteTable("rateLimit", {
  id: text().primaryKey().notNull(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: integer().notNull(),
});

export const budgets = sqliteTable("budgets", {
  key: text().primaryKey().notNull(),
  tokens: real().notNull(),
  updatedAt: integer().notNull(),
});

export const purchases = sqliteTable(
  "purchases",
  {
    id: text().primaryKey().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id),
    requestId: text().notNull(),
    createdAt: integer().notNull(),
    lines: text({ mode: "json" }).$type<readonly PurchaseLine[]>().notNull(),
    totalClp: integer().notNull(),
    buyOrder: text().notNull().unique(),
    sessionId: text().notNull(),
    environment: text({ enum: ["integration", "production"] }).notNull(),
    status: text().$type<PaymentStatus>().notNull(),
    token: text().unique(),
    checkoutUrl: text(),
    returnKind: text({ enum: ["normal", "aborted", "timeout", "error"] }),
    result: text({ mode: "json" }).$type<ProviderResult>(),
    attempts: integer().notNull().default(0),
    lease: integer().notNull().default(0),
    nextCheckAt: integer(),
    lastCheckedAt: integer(),
    problem: text(),
  },
  (table) => [
    uniqueIndex("purchases_request").on(table.userId, table.requestId),
    index("purchases_customer").on(table.userId, table.createdAt, table.id),
    index("purchases_created").on(table.createdAt, table.id),
    index("purchases_due").on(table.nextCheckAt),
    check("purchase_amount_positive", sql`${table.totalClp} > 0`),
  ],
);

export const vouchers = sqliteTable(
  "vouchers",
  {
    id: text().primaryKey().notNull(),
    code: text().notNull().unique(),
    source: text({ enum: ["webpay", "manual"] }).notNull(),
    userId: text().references(() => user.id),
    purchaseId: text().references(() => purchases.id),
    unit: integer(),
    terms: text({ mode: "json" }).$type<Voucher["terms"]>().notNull(),
    issuedAt: integer().notNull(),
    expiresAt: integer().notNull(),
    redeemed: integer({ mode: "boolean" }).notNull().default(false),
    revision: integer().notNull().default(0),
    category: text({ enum: ["external_payment", "complimentary"] }),
    issuanceReason: text(),
    issuedBy: text().references(() => user.id),
    requestId: text(),
  },
  (table) => [
    uniqueIndex("voucher_paid_unit").on(table.purchaseId, table.unit),
    uniqueIndex("voucher_issuance").on(table.issuedBy, table.requestId),
    index("voucher_customer").on(table.userId, table.issuedAt, table.id),
    index("voucher_source").on(table.source, table.issuedAt, table.id),
    index("voucher_issued").on(table.issuedAt, table.id),
    check(
      "voucher_source_fields",
      sql`(${table.source} = 'webpay' AND ${table.userId} IS NOT NULL AND ${table.purchaseId} IS NOT NULL AND ${table.unit} IS NOT NULL) OR (${table.source} = 'manual' AND ${table.issuedBy} IS NOT NULL AND ${table.requestId} IS NOT NULL AND ${table.category} IS NOT NULL AND ${table.issuanceReason} IS NOT NULL)`,
    ),
  ],
);

export const voucherEvents = sqliteTable(
  "voucherEvents",
  {
    id: text().primaryKey().notNull(),
    voucherId: text()
      .notNull()
      .references(() => vouchers.id),
    kind: text({ enum: ["redeemed", "reversed"] }).notNull(),
    actorId: text()
      .notNull()
      .references(() => user.id),
    at: integer().notNull(),
    reason: text(),
  },
  (table) => [index("voucher_event_history").on(table.voucherId, table.at, table.id)],
);

export const deliveries = sqliteTable(
  "deliveries",
  {
    id: text().primaryKey().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id),
    voucherId: text()
      .notNull()
      .references(() => vouchers.id),
    requestId: text().notNull(),
    recipient: text().notNull(),
    createdAt: integer().notNull(),
    status: text({ enum: ["queued", "accepted", "unconfirmed"] }).notNull(),
    providerId: text(),
    attempts: integer().notNull().default(0),
    lease: integer().notNull().default(0),
    nextAttemptAt: integer(),
  },
  (table) => [
    uniqueIndex("delivery_request").on(table.userId, table.requestId),
    index("delivery_voucher").on(table.voucherId, table.createdAt),
    index("delivery_due").on(table.nextAttemptAt),
  ],
);

export const roleChanges = sqliteTable("roleChanges", {
  id: text().primaryKey().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id),
  from: text().notNull(),
  to: text().notNull(),
  operator: text().notNull(),
  reason: text().notNull(),
  at: integer().notNull(),
});
