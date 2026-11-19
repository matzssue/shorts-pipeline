/** Provider-agnostic TTS interface – the steps depend on this, not on a vendor SDK. */

export interface TtsVoice {
  voiceId: string;
  model: string;
  languageCode?: string;
  stability?: number;
  /** Env variable the voice ID comes from (for a helpful error when it is missing). */
  voiceIdEnv?: string;
}

/** Timing of one character of the input text (seconds from the start of the recording). */
export interface CharTiming {
  char: string;
  start: number;
  end: number;
}

export interface TtsResult {
  /** MP3 recording. */
  audio: Buffer;
  /** Character timings – same count and order as the characters of the input text. */
  chars: CharTiming[];
  /** Characters billed by the provider (cost), when it reports them. */
  billedChars?: number;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(text: string, voice: TtsVoice): Promise<TtsResult>;
}
