import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, AlertCircle, Volume2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function VoiceSearchModal({ isOpen, onClose, onQuerySubmit }) {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  // Known on first render, so no effect is needed (avoids a flash of "supported").
  const [isSupported, setIsSupported] = useState(
    () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const startRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    stopRecognition();
    setTranscript('');
    setErrorMessage('');

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage('');
      };

      recognition.onresult = (event) => {
        let currentText = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          currentText += item[0].transcript;
          if (item.isFinal) isFinal = true;
        }

        const trimmed = currentText.trim();
        setTranscript(trimmed);

        if (isFinal && trimmed) {
          handleSuccessResult(trimmed);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access is blocked. Please enable it in browser settings.');
        } else if (event.error === 'no-speech') {
          setErrorMessage("Didn't catch that. Please speak clearly or tap to try again.");
        } else {
          setErrorMessage('Could not hear audio. Please try again.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();

      // Fallback timeout if user remains silent
      timerRef.current = setTimeout(() => {
        if (!transcript) {
          stopRecognition();
        }
      }, 10000);
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
      setErrorMessage('Failed to start voice search. Please try again.');
    }
  };

  const handleSuccessResult = (text) => {
    stopRecognition();
    setTimeout(() => {
      onClose();
      if (typeof onQuerySubmit === 'function') {
        onQuerySubmit(text);
      } else {
        navigate(`/search?q=${encodeURIComponent(text)}`);
      }
    }, 600);
  };

  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setErrorMessage('');
      startRecognition();
    } else {
      stopRecognition();
    }
    return () => stopRecognition();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center overflow-hidden"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close Voice Search"
          >
            <X size={20} />
          </button>

          {/* Title */}
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-black tracking-wider uppercase text-slate-400">
              Voice Search
            </span>
          </div>

          {!isSupported ? (
            <div className="py-6 space-y-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl flex items-center gap-3 text-left">
                <AlertCircle className="h-6 w-6 shrink-0 text-amber-600" />
                <p className="text-xs font-medium">
                  Voice search is not supported in this browser. Please type in the search bar instead.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/search');
                }}
                className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                Go to Search <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* Mic Visualizer with Ripple Waves */}
              <div className="relative my-6 flex items-center justify-center">
                {isListening && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute h-28 w-28 rounded-full bg-rose-500/20"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      className="absolute h-28 w-28 rounded-full bg-rose-500/10"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={isListening ? stopRecognition : startRecognition}
                  className={`relative z-10 h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 text-white shadow-rose-500/30 ring-4 ring-rose-100'
                      : transcript
                      ? 'bg-emerald-600 text-white shadow-emerald-500/30'
                      : 'bg-indigo-600 text-white shadow-indigo-500/30'
                  }`}
                  aria-label={isListening ? 'Stop listening' : 'Start listening'}
                >
                  <Mic size={32} className={isListening ? 'animate-bounce' : ''} />
                </button>
              </div>

              {/* Status or Recognized Transcript */}
              <div className="min-h-[64px] flex flex-col items-center justify-center mb-4 px-2">
                {transcript ? (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1"
                  >
                    <p className="text-lg font-black text-slate-900 leading-snug">
                      &quot;{transcript}&quot;
                    </p>
                    <p className="text-xs font-semibold text-emerald-600">
                      Searching store...
                    </p>
                  </motion.div>
                ) : isListening ? (
                  <div className="space-y-1.5">
                    <p className="text-base font-bold text-slate-800">
                      Listening... Speak now
                    </p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-xs font-medium text-slate-400">
                        Try saying &quot;Atta&quot;, &quot;Amul Milk&quot;, &quot;Maggi&quot;, &quot;Cold drink&quot;
                      </span>
                    </div>
                  </div>
                ) : errorMessage ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-rose-600 flex items-center justify-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0" /> {errorMessage}
                    </p>
                    <button
                      type="button"
                      onClick={startRecognition}
                      className="text-xs font-black text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
                    >
                      Tap here to try again
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">
                    Tap the mic to start speaking
                  </p>
                )}
              </div>

              {/* Suggestions Chips */}
              <div className="w-full pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-1.5">
                {['Amul Milk', 'Basmati Rice', 'Chai Patti', 'Biscuits'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuccessResult(suggestion)}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
