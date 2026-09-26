export const signInLinkLifetimeMinutes = 15;

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function signInEmail(link: URL, assetOrigin: URL) {
  if (!["https:", "http:"].includes(link.protocol) || assetOrigin.protocol !== "https:") {
    throw new Error("Sign-in email requires a web link and HTTPS assets");
  }

  const href = escapeAttribute(link.href);
  const logo = escapeAttribute(new URL("/images/darspa-logo.png", assetOrigin).href);

  return {
    subject: "Tu enlace para ingresar a Dar Spa",
    text: `Tu enlace de ingreso

Usa este enlace para ingresar a tu cuenta de Dar Spa.

${link.href}

Válido por ${signInLinkLifetimeMinutes} minutos. Un solo uso.

Si no solicitaste ingresar, ignora este correo.

Dar Spa · Castro, Chiloé`,
    html: `<!doctype html>
<html lang="es-CL">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu enlace para ingresar a Dar Spa</title>
    <style>
      @media (max-width: 480px) {
        .content { padding-left: 26px !important; padding-right: 26px !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: #edf1f2; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">Tu enlace de ingreso vence en ${signInLinkLifetimeMinutes} minutos.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #edf1f2;">
      <tr><td align="center" style="padding: 32px 16px;">
        <!-- Outlook's Word renderer needs an explicit outer width. -->
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background: #ffffff; border-collapse: collapse; font-family: Arial, Helvetica, sans-serif;">
          <tr><td style="height: 4px; font-size: 0; line-height: 4px; background: #497bc0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding: 28px 24px 13px;">
            <img src="${logo}" width="138" height="138" alt="Dar Spa" style="display: block; border: 0;" />
          </td></tr>
          <tr><td align="center" class="content" style="padding: 8px 52px 0;">
            <h1 style="margin: 0; color: #243c4b; font-size: 30px; font-weight: 600; line-height: 1.25; letter-spacing: -0.8px;">Tu enlace de ingreso</h1>
            <p style="margin: 18px 0 0; color: #596b76; font-size: 16px; line-height: 1.7;">Usa este enlace para ingresar a tu cuenta de Dar Spa.</p>
          </td></tr>
          <tr><td align="center" class="content" style="padding: 30px 52px 25px;">
            <table role="presentation" width="246" cellpadding="0" cellspacing="0" border="0">
              <tr><td align="center" bgcolor="#315fa5" style="border-radius: 6px; mso-padding-alt: 15px 28px;">
                <a href="${href}" style="display: block; padding: 15px 28px; border-radius: 6px; background: #315fa5; color: #ffffff; font-size: 16px; font-weight: 700; line-height: 24px; text-decoration: none;">Ingresar a mi cuenta</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding: 0 24px 35px;">
            <p style="margin: 0; color: #596b76; font-size: 13px; line-height: 1.6;">Válido por <strong style="color: #324b59;">${signInLinkLifetimeMinutes} minutos</strong> · Un solo uso</p>
          </td></tr>
          <tr><td class="content" style="padding: 0 52px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top: 1px solid #e5ecee; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
          </td></tr>
          <tr><td align="center" class="content" style="padding: 25px 52px 32px;">
            <p style="margin: 0; color: #65747c; font-size: 13px; line-height: 1.7;">Si no solicitaste ingresar, ignora este correo.</p>
          </td></tr>
          <tr><td align="center" style="padding: 19px 24px; background: #f5f8f9;">
            <p style="margin: 0; color: #5d717c; font-size: 12px; letter-spacing: 0.3px;">Dar Spa <span style="color: #497c6f; padding: 0 9px;">·</span> Castro, Chiloé</p>
          </td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
