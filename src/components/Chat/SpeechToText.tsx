import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, X, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { getDirection } from '@/i18n';
import clsx from 'clsx';

// ═══════════════════════════════════════════════════════════
// SpeechToText — Web Speech API (client-side, free, real-time)
// Converts speech to text and inserts into the input field
// ═══════════════════════════════════════════════════════════

// Browser SpeechRecognition type
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface SpeechToTextProps {
  onResult: (text: string) => void;
  onCancel: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!SpeechRecognition;
}

export function SpeechToText({ onResult, onCancel }: SpeechToTextProps) {
  const { t } = useTranslation();
  const { language } = useSettingsStore();
  const dir = getDirection(language);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Configure
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      language === 'ar'
        ? 'ar-SA'
        : language === 'zh'
          ? 'zh-CN'
          : language === 'es'
            ? 'es-ES'
            : 'en-US';

    recognition.onstart = () => {
      setListening(true);
      setError('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      setFinalText(final.trim());
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('[STT] Error:', event.error);
      if (event.error === 'no-speech') {
        setError(t('voice.noSpeech', 'No speech detected'));
      } else if (event.error === 'not-allowed') {
        setError(t('voice.micDenied', 'Microphone access denied'));
      } else {
        setError(event.error);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  }, [language, t]);

  const stopAndAccept = useCallback(() => {
    recognitionRef.current?.stop();
    const result = (finalText + ' ' + interimText).trim();
    if (result) {
      onResult(result);
    } else {
      onCancel();
    }
  }, [finalText, interimText, onResult, onCancel]);

  const handleCancel = useCallback(() => {
    recognitionRef.current?.stop();
    onCancel();
  }, [onCancel]);

  // Auto-start on mount
  useEffect(() => {
    startListening();
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const displayText = (finalText + ' ' + interimText).trim();

  return (
    <div className="flex items-center gap-3 w-full px-3 py-2" dir={dir}>
      {/* Cancel */}
      <button
        onClick={handleCancel}
        className="p-2 rounded-lg hover:bg-aegis-danger/20 text-aegis-danger transition-colors"
        title={t('voice.cancel', 'Cancel')}
      >
        <X size={18} />
      </button>

      {/* Listening indicator + text preview */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {/* Pulsing mic */}
        <div className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all',
          listening
            ? 'bg-aegis-primary/20 text-aegis-primary animate-pulse'
            : error
              ? 'bg-aegis-danger/20 text-aegis-danger'
              : 'bg-aegis-surface text-aegis-text-dim'
        )}>
          <Mic size={16} />
        </div>

        {/* Text display */}
        <div className="flex-1 min-w-0">
          {error ? (
            <span className="text-[12px] text-aegis-danger">{error}</span>
          ) : displayText ? (
            <span className="text-[13px] text-aegis-text block truncate">
              {finalText && <span>{finalText} </span>}
              {interimText && <span className="text-aegis-text-dim italic">{interimText}</span>}
            </span>
          ) : (
            <span className="text-[12px] text-aegis-text-dim italic">
              {listening ? t('voice.listening', 'Listening...') : t('voice.starting', 'Starting...')}
            </span>
          )}
        </div>
      </div>

      {/* Accept button */}
      <button
        onClick={stopAndAccept}
        disabled={!displayText}
        className={clsx(
          'p-2.5 rounded-xl transition-all',
          'bg-aegis-primary hover:bg-aegis-primary-hover text-aegis-btn-primary-text',
          'shadow-lg shadow-aegis-primary/20',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
        )}
        title={t('voice.accept', 'Accept text')}
      >
        <Check size={18} />
      </button>
    </div>
  );
}
