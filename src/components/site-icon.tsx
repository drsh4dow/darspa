import { facebookPath, instagramPath, whatsappPath } from "../content/social-icons";
import { cn } from "../lib/utils";

const paths = {
  menu: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
  arrow: "M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75",
  account:
    "M15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM5.5 18.5a7.5 7.5 0 0 1 13 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  cart: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z",
  shop: "M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z",
  link: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
};

export function SiteIcon({ name, className }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg
      className={cn("size-6 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const socialPaths = { instagram: instagramPath, facebook: facebookPath, whatsapp: whatsappPath };

export function SocialIcon({ name }: { name: keyof typeof socialPaths }) {
  return (
    <svg className="size-8 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={socialPaths[name]} />
    </svg>
  );
}
