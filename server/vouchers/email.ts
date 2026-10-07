import { escapeHtml } from "../lib/html";
import { emailButton, emailLayout } from "../lib/emailLayout";

export function voucherEmail({
  name,
  code,
  expiresAt,
  pdf,
  assetOrigin,
}: {
  name: string;
  code: string;
  expiresAt: number;
  pdf: URL;
  assetOrigin: URL;
}) {
  const expires = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "long",
    timeStyle: "short",
  }).format(expiresAt);

  return {
    subject: `Tu voucher Dar Spa · ${name}`,
    text: `${name}\n\nVence el ${expires} (Chile).\nCódigo: ${code}\n\nDescargar voucher con QR: ${pdf.href}\n\nTransferible. Quien reciba el código podrá canjearlo.\nReserva tu hora: +56 9 7227 5330\n\nDar Spa · Castro, Chiloé`,
    html: emailLayout({
      title: "Tu voucher",
      preview: `${name} · Vence el ${expires}`,
      assetOrigin,
      contentHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f6f5;border-radius:12px"><tr><td align="center" style="padding:28px 20px">
<h2 style="margin:0 0 12px;color:#134e4a;font-size:24px;line-height:1.3">${escapeHtml(name)}</h2>
<p style="margin:0;font-size:14px">Vence el ${escapeHtml(expires)} (Chile)</p>
</td></tr></table>
${emailButton("Descargar voucher con QR", pdf)}
<p style="margin:0 0 6px;font-size:12px">Tu código</p>
<p style="margin:0 0 24px;font-family:monospace;font-size:13px;overflow-wrap:anywhere;word-break:break-all;color:#134e4a">${escapeHtml(code)}</p>
<p style="margin:0 0 8px;font-size:13px">Transferible. Quien reciba el código podrá canjearlo.</p>
<p style="margin:0;font-size:13px"><a href="https://wa.me/56972275330" style="color:#007f7b;text-decoration:underline">Reservar mi hora</a></p>`,
    }),
  };
}
