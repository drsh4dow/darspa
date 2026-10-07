# Compile the catalog into the Worker from repository content

Offerings, prices and sale availability live in `content/offerings/*.md` and
are compiled into the Worker at build time. There is no catalog table or
catalog editing screen, so a price change requires a commit and a deployment.
The specification makes the repository the single source of truth and Git
deployment the only publishing workflow. Purchases and vouchers snapshot the
offering terms, so later catalog changes never rewrite history.
