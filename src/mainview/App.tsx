import { useEffect, useState } from "react";
import type { RPCSchema } from "electrobun/view";
import { Electroview } from "electrobun/view";
import { TweetCard } from "../components/TweetCard";
import { PersonasPage } from "../components/PersonasPage";
import type {
  AddPersonaParams,
  FetchApiParams,
  OpenTimelineStreamParams,
  PersonaData,
  ProcessingStatus,
  TimelineWebviewMessages,
  TweetPost,
  UpdatePersonaParams,
} from "../shared/timeline";

type TimelineRPCSchema = {
  bun: RPCSchema<{
    requests: {
      fetchApi: { params: FetchApiParams; response: unknown };
      openTimelineStream: {
        params: OpenTimelineStreamParams | undefined;
        response: { started: boolean; debounceMs: number; maxWaitMs: number; channel: string };
      };
      closeTimelineStream: {
        params: undefined;
        response: { stopped: boolean };
      };
      getPersonas: { params: undefined; response: PersonaData[] };
      addPersona: { params: AddPersonaParams; response: PersonaData };
      updatePersona: { params: UpdatePersonaParams; response: PersonaData };
      deletePersona: { params: { handle: string }; response: { deleted: boolean } };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: TimelineWebviewMessages;
  }>;
};

const rpc = Electroview.defineRPC<TimelineRPCSchema>({
  handlers: {
    requests: {},
    messages: {},
  },
});

new Electroview({ rpc });

const STATUS_CONFIG = {
  buffering: {
    dot: "bg-amber-400 animate-pulse",
    text: "text-amber-400",
    label: (s: ProcessingStatus) =>
      `Collecting${s.pendingCount ? ` ${s.pendingCount} event${s.pendingCount === 1 ? "" : "s"}` : ""}…`,
  },
  generating: {
    dot: "bg-blue-400 animate-pulse",
    text: "text-blue-400",
    label: (s: ProcessingStatus) =>
      s.personaCount && s.personaCount > 0
        ? `Generating posts from ${s.personaCount} persona${s.personaCount === 1 ? "" : "s"}…`
        : "Generating tweets…",
  },
  error: {
    dot: "bg-red-500",
    text: "text-red-400",
    label: (s: ProcessingStatus) => s.error ?? "Something went wrong",
  },
  idle: null,
} as const;

function StatusBar({ status }: { status: ProcessingStatus | null }) {
  if (!status || status.state === "idle") return null;
  const config = STATUS_CONFIG[status.state];
  if (!config) return null;
  return (
    <div className={`flex items-center gap-2 text-xs ${config.text}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`} />
      {config.label(status)}
    </div>
  );
}

type Tab = "feed" | "personas";

function App() {
  const [tab, setTab] = useState<Tab>("feed");
  const [tweets, setTweets] = useState<TweetPost[]>([]);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);

  useEffect(() => {
    const onTweetPushed = (tweet: TweetPost) => {
      setTweets((current) => [tweet, ...current]);
    };
    const onProcessingStatus = (s: ProcessingStatus) => setStatus(s);

    rpc.addMessageListener("tweetPushed", onTweetPushed);
    rpc.addMessageListener("processingStatus", onProcessingStatus);
    void rpc.request.openTimelineStream({ debounceMs: 3500 });

    return () => {
      rpc.removeMessageListener("tweetPushed", onTweetPushed);
      rpc.removeMessageListener("processingStatus", onProcessingStatus);
      void rpc.request.closeTimelineStream();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <nav className="flex gap-1">
            {(["feed", "personas"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <StatusBar status={status} />
        </div>
      </header>

      {tab === "feed" && (
        <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6">
          {tweets.map((tweet) => (
            <TweetCard
              key={tweet.id}
              name={tweet.name}
              handle={tweet.handle}
              avatarUrl={tweet.avatarUrl}
              text={tweet.text}
            />
          ))}
        </main>
      )}

      {tab === "personas" && (
        <PersonasPage
          onGetPersonas={() => rpc.request.getPersonas(undefined)}
          onAddPersona={(p) => rpc.request.addPersona(p)}
          onUpdatePersona={(p) => rpc.request.updatePersona(p)}
          onDeletePersona={(handle) => rpc.request.deletePersona({ handle })}
        />
      )}
    </div>
  );
}

export default App;
