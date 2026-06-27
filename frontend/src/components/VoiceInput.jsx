import { useCallback, useEffect, useRef, useState } from "react";
import "./VoiceInput.css";

const STATES = {
  IDLE: "idle",
  RECORDING: "recording",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
  LISTENING_WEB: "listening_web",
};

const API_BASE = import.meta.env.VITE_API_URL || "";

const getSpeechRecognition = () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  return SpeechRecognition ? new SpeechRecognition() : null;
};

export default function VoiceInput({
  symptomsText,
  onSymptomsChange,
  onAnalyze,
  age,
  sex,
  symptomIds = [],
  placeholder = "Describe your symptoms here, or tap the mic to speak...",
}) {
  const [state, setState] = useState(STATES.IDLE);
  const [interimText, setInterimText] = useState("");
  const [countdown, setCountdown] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const delayTimerRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startAutoSubmitCountdown = useCallback(
    (transcript) => {
      clearTimers();

      delayTimerRef.current = setTimeout(() => {
        let remaining = 3;
        setCountdown(remaining);

        countdownTimerRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearTimers();
            onAnalyze?.({
              symptoms_text: transcript,
              symptom_ids: symptomIds,
              age,
              sex,
            });
          } else {
            setCountdown(remaining);
          }
        }, 1000);
      }, 1000);
    },
    [age, sex, symptomIds, onAnalyze, clearTimers]
  );

  const handleTranscriptionComplete = useCallback(
    (transcript) => {
      if (!transcript?.trim()) {
        setState(STATES.ERROR);
        return;
      }

      onSymptomsChange(transcript.trim());
      setInterimText("");
      setState(STATES.DONE);
      startAutoSubmitCountdown(transcript.trim());
    },
    [onSymptomsChange, startAutoSubmitCountdown]
  );

  const startWebSpeechFallback = useCallback(() => {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setState(STATES.ERROR);
      return;
    }

    recognitionRef.current = recognition;
    recognition.lang = "en-CA";
    recognition.continuous = false;
    recognition.interimResults = true;

    setInterimText("");
    setState(STATES.LISTENING_WEB);

    recognition.onresult = (event) => {
      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterimText(interim);
      }

      if (finalTranscript) {
        recognition.stop();
        handleTranscriptionComplete(finalTranscript);
      }
    };

    recognition.onerror = () => {
      setState(STATES.ERROR);
      setInterimText("");
    };

    recognition.onend = () => {
      if (state === STATES.LISTENING_WEB) {
        setInterimText("");
      }
    };

    recognition.start();
  }, [handleTranscriptionComplete, state]);

  const transcribeWithValencia = useCallback(
    async (audioBlob) => {
      setState(STATES.PROCESSING);

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      try {
        const response = await fetch(`${API_BASE}/api/voice-transcribe`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (data.fallback_mode || !data.transcript) {
          startWebSpeechFallback();
          return;
        }

        handleTranscriptionComplete(data.transcript);
      } catch {
        startWebSpeechFallback();
      }
    },
    [handleTranscriptionComplete, startWebSpeechFallback]
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const startValenciaRecording = useCallback(async () => {
    clearTimers();
    setState(STATES.IDLE);
    setInterimText("");

    if (!navigator.mediaDevices?.getUserMedia) {
      startWebSpeechFallback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size === 0) {
          setState(STATES.ERROR);
          return;
        }

        await transcribeWithValencia(audioBlob);
      };

      recorder.start();
      setState(STATES.RECORDING);
    } catch {
      startWebSpeechFallback();
    }
  }, [clearTimers, startWebSpeechFallback, transcribeWithValencia]);

  const handleButtonClick = () => {
    if (state === STATES.RECORDING || state === STATES.LISTENING_WEB) {
      if (state === STATES.RECORDING) {
        stopRecording();
      } else if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    if (state === STATES.DONE || state === STATES.ERROR) {
      clearTimers();
      if (state === STATES.DONE) {
        onSymptomsChange("");
      }
      startValenciaRecording();
      return;
    }

    startValenciaRecording();
  };

  const cancelCountdown = () => {
    clearTimers();
  };

  useEffect(() => {
    return () => {
      clearTimers();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [clearTimers]);

  const renderButtonContent = () => {
    switch (state) {
      case STATES.RECORDING:
        return (
          <>
            <span className="voice-input__icon">
              <span className="voice-input__pulse" />
            </span>
            <span className="voice-input__bars" aria-hidden="true">
              <span className="voice-input__bar" />
              <span className="voice-input__bar" />
              <span className="voice-input__bar" />
            </span>
            <span>Listening... tap to stop</span>
          </>
        );

      case STATES.LISTENING_WEB:
        return (
          <>
            <span className="voice-input__icon">
              <span className="voice-input__pulse" />
            </span>
            <span className="voice-input__bars" aria-hidden="true">
              <span className="voice-input__bar" />
              <span className="voice-input__bar" />
              <span className="voice-input__bar" />
            </span>
            <span>Listening... tap to stop</span>
          </>
        );

      case STATES.PROCESSING:
        return (
          <>
            <span className="voice-input__icon">
              <span className="voice-input__spinner" />
            </span>
            <span>Transcribing with Valencia...</span>
          </>
        );

      case STATES.DONE:
        return (
          <>
            <span className="voice-input__icon">
              <span className="voice-input__check">✓</span>
            </span>
            <span>Got it! Tap to re-record</span>
          </>
        );

      case STATES.ERROR:
        return (
          <>
            <span className="voice-input__icon">
              <span className="voice-input__warning">⚠</span>
            </span>
            <span>Couldn&apos;t hear you — try again</span>
          </>
        );

      default:
        return (
          <>
            <span className="voice-input__icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </span>
            <span>Speak your symptoms</span>
          </>
        );
    }
  };

  const buttonClass = [
    "voice-input__button",
    `voice-input__button--${
      state === STATES.LISTENING_WEB ? "listening" : state
    }`,
  ].join(" ");

  return (
    <div className="voice-input">
      <div className="voice-input__textarea-wrap">
        <textarea
          className="voice-input__textarea"
          value={symptomsText}
          onChange={(e) => onSymptomsChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Symptoms description"
        />
        {(state === STATES.LISTENING_WEB || interimText) && (
          <p className="voice-input__interim">{interimText || "Listening..."}</p>
        )}
      </div>

      <button
        type="button"
        className={buttonClass}
        onClick={handleButtonClick}
        aria-label={
          state === STATES.RECORDING || state === STATES.LISTENING_WEB
            ? "Stop recording"
            : "Start voice input"
        }
      >
        {renderButtonContent()}
      </button>

      <p className="voice-input__powered">Powered by Valencia API</p>

      {countdown !== null && (
        <div className="voice-input__countdown">
          <span>Analyzing in {countdown}...</span>
          <button
            type="button"
            className="voice-input__countdown-cancel"
            onClick={cancelCountdown}
            aria-label="Cancel auto-analyze"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
