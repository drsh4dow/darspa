# A purchase carries exactly one Webpay payment

A purchase stores the cart's offering terms and a single Webpay attempt (buy
order, token and status) in one record. A declined, aborted or timed-out
payment stays on its purchase, and trying again creates a new purchase that
rechecks today's catalog. This keeps the terms a customer saw tied to the
amount Webpay charged, and it means there is no separate payment transaction
concept.
