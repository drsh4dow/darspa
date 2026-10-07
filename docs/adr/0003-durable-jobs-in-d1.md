# Keep payment and delivery work in D1 rows, recovered by cron

Payment settlement and voucher delivery are scheduled through columns on the
`purchases` and `deliveries` rows (`nextCheckAt`, `nextAttemptAt`,
`lease`, `attempts`). A minute cron recovers due rows, and `waitUntil`
only starts work sooner. We chose this over Cloudflare Queues, Workflows or
Durable Objects because the schedule and the business record are the same row.
Settlement can then issue vouchers and mark the purchase paid in one D1 batch
conditioned on the lease, with no second store to keep consistent.
