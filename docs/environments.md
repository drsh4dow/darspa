# Credential bootstrap and rotation

## Secret-sync credentials

Bootstrap and rotation require authority outside the running sync. Use an authenticated operator's Infisical and Convex CLI sessions.

1. Create a read-only Infisical service token with `infisical service-token create --scope dev:/convex --access-level read --expiry-seconds 31536000 --token-only`. Redirect stdout to a restricted temporary file; remove the trailing newline before importing it.
2. Create a deployment-specific Convex key with `vp exec convex deployment token create <name> --deployment <explicit-target> --save-env <restricted-env-file>`. Extract its value privately.
3. Store the values as `INFISICAL_SYNC_TOKEN` and `INFISICAL_SYNC_CONVEX_KEY` in Infisical `dev:/automation`, using `infisical secrets set NAME=@<value-file> --env dev --path /automation`.
4. Bootstrap the corresponding backend variables through stdin to `vp exec convex env set NAME --deployment <explicit-target>`. The sync cannot manage its own access credentials.
5. Confirm a source change propagates through the scheduled sync before revoking old credentials. Remove the temporary files. Repeat an interrupted rotation with the same replacement credentials; keep the old ones until verification succeeds.

## Payment and development email settings

Set `WEBPAY_ENVIRONMENT`, `WEBPAY_COMMERCE_CODE` and `WEBPAY_API_KEY` in Infisical `dev:/convex` for the existing development deployment. Use Transbank's integration credentials there. The existing secret-sync job owns these keys; do not set browser-public copies. The callback is `<CONVEX_SITE_URL>/api/webpay/return` and accepts both GET and POST. Production merchant activation and live charges require separate authorization.

`DEVELOPMENT_EMAIL_RECIPIENTS` contains the comma-separated owner-approved test inboxes. It replaces the singular `DEVELOPMENT_EMAIL_RECIPIENT` setting. The allowlist applies to sign-in, voucher delivery, and exam-order email on the isolated development deployment. Missing or malformed configuration fails closed.

## Authentication on a new origin

1. Generate a deployment-specific RS256 signing key pair using the [Convex Auth setup procedure](https://labs.convex.dev/auth/setup/manual). Store `JWT_PRIVATE_KEY` and the public `JWKS` in the deployment's Infisical source folder, not directly in Convex. Use raw value files with `NAME=@<file>` for structured values.
2. Set `SITE_URL` to the frontend origin. In the Google OAuth client's console, add `<CONVEX_SITE_URL>/api/auth/callback/google` to its authorized redirect URIs. Preserve existing callbacks until their deployments are retired.
3. Verify the sender domain in Resend and set its API key and sender through Infisical. Coordinate any required DNS changes with the domain owner.
4. After sync, verify sign-in and sign-out through both providers on the new origin. Check the same email reaches the same account before changing live traffic. Rotating signing keys can require customers to sign in again.
