# Launch with fresh data instead of migrating the legacy application

The specification required legacy customers, purchases, voucher codes and
redemption states to survive the replacement. The read-only snapshot of the
legacy database failed because its Supabase tenant was unavailable. The owner
accepted launching with empty data instead
([#8](https://github.com/drsh4dow/darspa/issues/8)). Staff handle old vouchers
outside the application, and nothing in the replacement needs to stay compatible
with legacy records.
