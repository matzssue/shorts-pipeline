import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { requireEnv } from "../lib/env.js";
import type { TtsProvider, TtsResult, TtsVoice } from "./tts.js";

/** ElevenLabs TTS with character timings. Key: ELEVENLABS_API_KEY in .env. */
export class ElevenLabsTts implements TtsProvider {
  readonly name = "elevenlabs";
  private readonly client: ElevenLabsClient;

  constructor() {
    requireEnv("ELEVENLABS_API_KEY");
    this.client = new ElevenLabsClient();
  }

  async synthesize(text: string, voice: TtsVoice): Promise<TtsResult> {
    if (!voice.voiceId) throw new Error(`No voice ID – set ${voice.voiceIdEnv ?? "voiceId"} (see .env.example)`);
    const { data, rawResponse } = await this.client.textToSpeech
      .convertWithTimestamps(voice.voiceId, {
        text,
        modelId: voice.model,
        languageCode: voice.languageCode,
        outputFormat: "mp3_44100_128",
        ...(voice.stability !== undefined && { voiceSettings: { stability: voice.stability } }),
      })
      .withRawResponse();
    const a = data.alignment;
    if (!a) throw new Error("ElevenLabs returned no character timings (alignment)");
    const billed = Number(rawResponse.headers.get("x-character-count"));
    return {
      audio: Buffer.from(data.audioBase64, "base64"),
      chars: a.characters.map((char, i) => ({
        char,
        start: a.characterStartTimesSeconds[i]!,
        end: a.characterEndTimesSeconds[i]!,
      })),
      billedChars: Number.isFinite(billed) && billed > 0 ? billed : undefined,
    };
  }
}
