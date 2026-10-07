// The Worker owns the apex and www. Keep the Vercel wildcard for edami.darspa.cl.
export const dnsRecords = [
  {
    id: "VercelSubdomains",
    name: "*.darspa.cl",
    type: "CNAME",
    content: "cname.vercel-dns-017.com",
  },
  {
    id: "GoogleMail",
    name: "darspa.cl",
    type: "MX",
    content: "smtp.google.com",
    priority: 1,
  },
  {
    id: "GoogleSiteVerification",
    name: "darspa.cl",
    type: "TXT",
    content: '"google-site-verification=je0P7gWzT62qWb5lIoLLdmCx2onHf8lI5lFqR2ewyIY"',
  },
  {
    id: "GoogleRecoveryVerification",
    name: "darspa.cl",
    type: "TXT",
    content: '"google-gws-recovery-domain-verification=58201200"',
  },
  {
    id: "GoogleRecoveryAlias",
    name: "58201200.darspa.cl",
    type: "CNAME",
    content: "google.com",
  },
  {
    id: "Dmarc",
    name: "_dmarc.darspa.cl",
    type: "TXT",
    content: '"v=DMARC1; p=none;"',
  },
  {
    id: "ResendDkim",
    name: "resend._domainkey.darspa.cl",
    type: "TXT",
    content:
      '"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDENP9n/EAYFA95B2baAPKEqcTQLzV68ervkJ6/pwvXfNkRpB33OX+RwJ32LhB6/0SQDs5ggOBdmpa9wYNQGu5eti6x3kA+HczxiylsLTpKMGHwcTr//qrllKZ0k2EcXXA9b4nCF1kNZy714zq+hhIa802+MpGijnyIDD7dJU/a4QIDAQAB"',
  },
  {
    id: "ResendSpf",
    name: "send.darspa.cl",
    type: "TXT",
    content: '"v=spf1 include:amazonses.com ~all"',
  },
  {
    id: "ResendMail",
    name: "send.darspa.cl",
    type: "MX",
    content: "feedback-smtp.sa-east-1.amazonses.com",
    priority: 10,
  },
  {
    id: "CertificateGoogle",
    name: "darspa.cl",
    type: "CAA",
    content: '0 issue "pki.goog"',
  },
  {
    id: "CertificateSectigo",
    name: "darspa.cl",
    type: "CAA",
    content: '0 issue "sectigo.com"',
  },
  {
    id: "CertificateLetsEncrypt",
    name: "darspa.cl",
    type: "CAA",
    content: '0 issue "letsencrypt.org"',
  },
] as const;
