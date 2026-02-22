type TweetCardProps = {
  name: string;
  handle: string;
  avatarUrl?: string;
  text: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function TweetCard({ name, handle, avatarUrl, text }: TweetCardProps) {
  return (
    <article className="rounded-md border border-border bg-card p-4 text-card-foreground">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${name} avatar`} className="h-full w-full object-cover" />
          ) : (
            getInitials(name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">@{handle}</p>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            <InlineMarkdown text={text} />
          </p>
        </div>
      </div>
    </article>
  );
}
