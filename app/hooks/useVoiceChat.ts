import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const RECOGNITION_LANG = "en-US";
// Chrome silently stops long utterances after ~15s, so replies are spoken
// as a queue of sentence-sized chunks instead of one long utterance.
const MAX_UTTERANCE_CHARS = 200;

const UNSUPPORTED_MESSAGE =
  "Voice input isn't supported in this browser. Try Chrome, Edge, or Safari.";

const RECOGNITION_ERROR_MESSAGES: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  "not-allowed":
    "Microphone access was blocked. Allow it in your browser's site settings and try again.",
  "service-not-allowed":
    "Microphone access was blocked. Allow it in your browser's site settings and try again.",
  "no-speech": "Didn't catch that. Try again.",
  "audio-capture": "No microphone was found.",
  network: "The speech recognition service is unavailable. Check your connection.",
  "language-not-supported": "English speech recognition isn't available in this browser.",
};

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

const subscribeNoop = () => () => {};

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " Code omitted. ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/([*_~]{1,3})([^*_~\n]+)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

function splitForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > MAX_UTTERANCE_CHARS) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function useVoiceChat() {
  // Read browser support without touching window during server rendering.
  const recognitionSupported = useSyncExternalStore(
    subscribeNoop,
    () => !!getRecognitionConstructor(),
    () => false
  );
  const synthesisSupported = useSyncExternalStore(
    subscribeNoop,
    () => "speechSynthesis" in window,
    () => false
  );

  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mutedRef = useRef(false);
  // Each recording gets a session number; callbacks from an older session
  // (cancelled, or replaced by a newer recording) are ignored.
  const sessionRef = useRef(0);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (mutedRef.current || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    for (const chunk of splitForSpeech(stripMarkdown(text))) {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = RECOGNITION_LANG;
      synth.speak(utterance);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) stopSpeaking();
  }, [stopSpeaking]);

  // Discards the current recording without sending its transcript.
  const cancelListening = useCallback(() => {
    sessionRef.current++;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
    setLiveTranscript("");
  }, []);

  // Ends the current recording; the final transcript is still delivered.
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(
    (onFinalTranscript: (text: string) => void) => {
      const Recognition = getRecognitionConstructor();
      if (!Recognition) {
        setVoiceError(UNSUPPORTED_MESSAGE);
        return;
      }

      stopSpeaking();
      cancelListening();

      const session = sessionRef.current;
      const recognition = new Recognition();
      recognition.lang = RECOGNITION_LANG;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalTranscript = "";
      let failed = false;

      recognition.onresult = (event) => {
        if (session !== sessionRef.current) return;
        let interim = "";
        finalTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interim += result[0].transcript;
        }
        setLiveTranscript((finalTranscript + interim).trim());
      };

      recognition.onerror = (event) => {
        if (session !== sessionRef.current || event.error === "aborted") return;
        failed = true;
        setVoiceError(
          RECOGNITION_ERROR_MESSAGES[event.error] ?? "Voice input failed. Try again."
        );
      };

      recognition.onend = () => {
        if (session !== sessionRef.current) return;
        // Close this session so the transcript is delivered at most once.
        sessionRef.current++;
        recognitionRef.current = null;
        setListening(false);
        setLiveTranscript("");
        const text = finalTranscript.trim();
        if (!failed && text) onFinalTranscript(text);
      };

      recognitionRef.current = recognition;
      setVoiceError(null);
      try {
        recognition.start();
        setListening(true);
      } catch (error) {
        console.error("Speech recognition failed to start:", error);
        recognitionRef.current = null;
        setVoiceError("Voice input failed to start. Try again.");
      }
    },
    [cancelListening, stopSpeaking]
  );

  useEffect(() => {
    return () => {
      sessionRef.current++;
      recognitionRef.current?.abort();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    recognitionSupported,
    synthesisSupported,
    listening,
    liveTranscript,
    voiceError,
    muted,
    startListening,
    stopListening,
    cancelListening,
    speak,
    stopSpeaking,
    toggleMute,
  };
}
