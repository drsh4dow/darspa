import { useQuery } from "@tanstack/react-query";
import { SiteIcon, SocialIcon } from "../../components/site-icon";
import { site } from "../../content/site";
import { request } from "../../lib/api";
import { cn } from "../../lib/utils";

const labels = {
  IMAGE: "Publicación",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Álbum",
} as const;

function describe(post: { caption: string; mediaType: keyof typeof labels }) {
  const text = post.caption.replaceAll(/\s+/gu, " ").trim();

  return text === "" ? `${labels[post.mediaType]} de Instagram` : text.slice(0, 120);
}

export function InstagramFeed({ desktop = false }: { desktop?: boolean }) {
  // A failed or empty feed keeps the plain link; it must never reach the page error boundary.
  const { data: posts } = useQuery({
    queryKey: ["instagram"],
    queryFn: ({ signal }) => request((api) => api.public.instagram(), signal),
    throwOnError: false,
    staleTime: 300_000,
    refetchInterval: false,
  });

  const hasPosts = posts !== undefined && posts.length > 0;

  return (
    <>
      <h2
        className={cn("text-3xl font-black text-heading", desktop && "mb-8 text-2xl text-primary")}
      >
        Novedades Instagram
      </h2>
      {hasPosts ? (
        <ul
          className={cn(
            "my-6 grid w-full grid-cols-3 gap-1",
            desktop && "mb-8 min-h-0 flex-1 content-start",
          )}
        >
          {posts.map((post) => (
            <li key={post.id}>
              <a
                className="group relative block aspect-square overflow-hidden rounded-xs bg-muted"
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  className="size-full object-cover transition-transform group-hover:scale-105"
                  src={post.thumbnailUrl}
                  alt={describe(post)}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {post.mediaType !== "IMAGE" && (
                  <span className="absolute top-1 right-1 rounded-xs bg-foreground/70 px-1 text-xs font-bold text-background">
                    {labels[post.mediaType]}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className={cn(
            "grid min-h-60 place-items-center text-primary",
            desktop && "mb-8 aspect-square min-h-0 w-full flex-1",
          )}
        >
          <a className="underline" href={site.instagram}>
            Ver publicaciones en Instagram
          </a>
        </div>
      )}
      <a
        className={cn(
          "inline-flex items-center gap-1 text-xl font-black text-primary",
          desktop && "self-end text-lg",
        )}
        href={site.instagram}
        target="_blank"
        rel="noreferrer"
      >
        <SiteIcon name="arrow" />
        <SocialIcon name="instagram" />
        darspa.cl
      </a>
    </>
  );
}
