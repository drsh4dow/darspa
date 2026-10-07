import { escapeHtml } from "../lib/html";

export const examOrderFilename = "orden-examen.pdf";

export function examOrderEmail(assetOrigin: URL) {
  if (assetOrigin.protocol !== "https:") throw new Error("Email images require HTTPS");
  const logo = escapeHtml(new URL("/images/darspa-logo.png", assetOrigin).href);

  return {
    subject: "Tus órdenes de examen — Dar Spa",
    text: `Tus órdenes de examen están listas para descargar e imprimir.

Encontrarás la orden de estudio metabólico y la orden de laboratorio en el archivo adjunto: ${examOrderFilename}.

Imprime ambas páginas en tamaño carta. Las indicaciones de preparación están en cada orden.

¿Necesitas ayuda? Escríbenos a contacto@darspa.cl.

Dar Spa
E. Sotomayor 576 · Castro, Chiloé`,
    html: `<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tus órdenes de examen — Dar Spa</title>
<style>
@media(max-width:480px){.content{padding-left:24px!important;padding-right:24px!important}.outer{padding:16px 8px!important}h1{font-size:30px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#edf3f2;font-family:Arial,Helvetica,sans-serif;color:#253d3b;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Tus dos órdenes están en el PDF adjunto. Imprime ambas páginas en tamaño carta.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f2">
<tr><td class="outer" align="center" style="padding:32px 16px">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-top:4px solid #007f7b">
<tr><td class="content" style="padding:28px 40px 20px">
  <img src="${logo}" width="92" height="92" alt="Dar Spa" style="display:block;border:0">
</td></tr>
<tr><td class="content" style="padding:0 40px 28px">
  <p style="margin:0 0 12px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:2px;color:#00716d">ÓRDENES DE EXAMEN</p>
  <h1 style="margin:0 0 18px;font-size:36px;line-height:1.14;letter-spacing:-1px;color:#134e4a">Listas para<br>descargar e imprimir.</h1>
  <p style="margin:0;font-size:16px;line-height:26px;color:#526563">Encontrarás tus órdenes en el archivo adjunto a este correo.</p>
</td></tr>
<tr><td class="content" style="padding:0 40px 28px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #cddedb;background:#f5f9f8">
  <tr><td width="48" valign="top" style="padding:22px 0 22px 20px">
    <div style="border:1px solid #aac8c2;background:#ffffff;color:#006962;font-size:11px;font-weight:700;line-height:42px;text-align:center;width:40px">PDF</div>
  </td><td style="padding:22px 16px">
    <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#134e4a">${examOrderFilename}</p>
    <p style="margin:0;font-size:13px;line-height:20px;color:#526563">2 páginas · Archivo adjunto</p>
  </td></tr>
  </table>
</td></tr>
<tr><td class="content" style="padding:0 40px 30px">
  <h2 style="margin:0 0 16px;font-size:14px;line-height:22px;color:#134e4a">Dentro del documento</h2>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr><td width="32" style="padding:0 0 12px;color:#007f7b;font-size:12px;font-weight:700">01</td><td style="padding:0 0 12px;font-size:15px;line-height:22px">Orden de estudio metabólico</td></tr>
  <tr><td width="32" style="color:#007f7b;font-size:12px;font-weight:700">02</td><td style="font-size:15px;line-height:22px">Orden de laboratorio</td></tr>
  </table>
</td></tr>
<tr><td class="content" style="padding:0 40px 32px">
  <p style="margin:0;border-top:1px solid #e1eae7;padding-top:22px;font-size:14px;line-height:23px;color:#526563"><strong style="color:#253d3b">Imprime ambas páginas en tamaño carta.</strong><br>Las indicaciones de preparación están en cada orden.</p>
</td></tr>
<tr><td class="content" style="padding:22px 40px;background:#f5f9f8">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr><td style="font-size:12px;line-height:21px;color:#526563"><strong style="color:#134e4a">Dar Spa</strong><br>E. Sotomayor 576 · Castro, Chiloé</td><td align="right" valign="top" style="padding-left:12px;font-size:12px;line-height:21px"><a href="mailto:contacto@darspa.cl" style="color:#006f68;text-decoration:underline">¿Necesitas ayuda?</a></td></tr>
  </table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`,
  };
}
