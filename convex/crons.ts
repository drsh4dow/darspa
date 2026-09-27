import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Convex allows at most one run of this cron at a time. Each tick reconciles
// current source data, including after a failed or interrupted request.
crons.interval(
  "sync development environment",
  { minutes: 1 },
  internal.secretSync.reconcileDevelopment,
);

crons.interval("reconcile Webpay payments", { minutes: 1 }, internal.purchasing.transactions.sweep);

crons.interval("retry voucher delivery", { minutes: 1 }, internal.vouchers.deliveries.sweep);

export default crons;
