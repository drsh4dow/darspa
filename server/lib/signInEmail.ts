import { emailButton, emailLayout } from "./emailLayout";

export const signInLinkLifetimeMinutes = 15;

export function signInEmail(link: URL, assetOrigin: URL) {
  return {
    subject: "Tu enlace para ingresar a Dar Spa",
    text: `Tu enlace de ingreso\n\n${link.href}\n\nVálido por ${signInLinkLifetimeMinutes} minutos. Un solo uso.\n\nSi no solicitaste ingresar, ignora este correo.\n\nDar Spa · Castro, Chiloé`,
    html: emailLayout({
      title: "Tu enlace de ingreso",
      preview: `Válido por ${signInLinkLifetimeMinutes} minutos. Un solo uso.`,
      assetOrigin,
      contentHtml: `${emailButton("Ingresar a mi cuenta", link)}
<p style="margin:0 0 24px;font-size:14px">Válido por <strong>${signInLinkLifetimeMinutes} minutos</strong> · Un solo uso</p>
<p style="margin:0;font-size:13px">Si no solicitaste ingresar, ignora este correo.</p>`,
    }),
  };
}
