import { escapeHtml } from "./html";

export function emailButton(label: string, url: URL) {
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Email links must use HTTP or HTTPS");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto"><tr><td align="center" bgcolor="#007f7b" style="border-radius:8px;mso-padding-alt:15px 28px"><a href="${escapeHtml(url.href)}" style="display:inline-block;padding:15px 28px;color:#ffffff;font-size:16px;font-weight:700;line-height:24px;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}

export function emailLayout({
  title,
  preview,
  contentHtml,
  assetOrigin,
}: {
  title: string;
  preview: string;
  contentHtml: string;
  assetOrigin: URL;
}) {
  if (assetOrigin.protocol !== "https:") throw new Error("Email images require HTTPS");
  const logo = escapeHtml(new URL("/images/darspa-logo.png", assetOrigin).href);

  return `<!doctype html>
<html lang="es-CL">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>@media(max-width:480px){.content{padding-left:24px!important;padding-right:24px!important}}</style></head>
<body style="margin:0;padding:0;background:#f1f6f5;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f6f5"><tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;border-top:4px solid #007f7b">
<tr><td align="center" style="padding:24px 24px 12px"><img src="${logo}" width="96" height="96" alt="Dar Spa" style="display:block;border:0"></td></tr>
<tr><td align="center" class="content" style="padding:8px 40px 32px;color:#475569;font-size:15px;line-height:1.65">
<h1 style="margin:0 0 24px;color:#134e4a;font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-0.6px">${escapeHtml(title)}</h1>
${contentHtml}
</td></tr>
<tr><td align="center" style="padding:20px 24px;border-top:1px solid #e2e8f0"><p style="margin:0;color:#475569;font-size:12px">Dar Spa · Castro, Chiloé</p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}
