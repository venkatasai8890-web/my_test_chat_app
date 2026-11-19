import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const RECOGNITION_LANG = "en-US";

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

export function useVoiceChat() {
  // Read browser support without touching window during server rendering.
  const recognitionSupported = useSyncExternalStore(
    subscribeNoop,
    () => !!getRecognitionConstructor(),
    () => false
  );

  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Each recording gets a session number; callbacks from an older session
  // (cancelled, or replaced by a newer recording) are ignored.
  const sessionRef = useRef(0);

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
    [cancelListening]
  );

  useEffect(() => {
    return () => {
      sessionRef.current++;
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    recognitionSupported,
    listening,
    liveTranscript,
    voiceError,
    startListening,
    stopListening,
    cancelListening,
  };
}
