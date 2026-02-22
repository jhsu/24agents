export type TweetPost = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  text: string;
  timestamp: number;
};

export type FetchApiParams = {
  url: string;
  options?: RequestInit;
};

export type OpenTimelineStreamParams = {
  debounceMs?: number;
  maxWaitMs?: number;
  redisChannel?: string;
  maxBatchSize?: number;
};

export type ProcessingState = "idle" | "buffering" | "generating" | "error";

export type ProcessingStatus = {
  state: ProcessingState;
  pendingCount?: number;
  personaCount?: number;
  error?: string;
};

export type TimelineWebviewMessages = {
  tweetPushed: TweetPost;
  processingStatus: ProcessingStatus;
};

export type PersonaData = {
  handle: string;
  name: string;
  avatarUrl: string;
  description: string;
};

export type AddPersonaParams = Omit<PersonaData, "avatarUrl">;

export type UpdatePersonaParams = { handle: string } & Partial<
  Omit<PersonaData, "handle" | "avatarUrl">
>;
