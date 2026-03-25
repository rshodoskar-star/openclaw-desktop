import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, X, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { getDirection } from '@/i18n';
import clsx from 'clsx';

// ═══════════════════════════════════════════════════════════
// VoiceRecorder — Record audio and save to shared folder
// Uses MediaRecorder API → saves WAV/WebM to disk via IPC
// Then sends the file path as a text message
// ═══════════════════════════════════════════════════════════

interface VoiceRecorderProps {
  onSendVoice: (base64: string, mimeType: string, durationSec: number, localUrl: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onSendVoice, onCancel, disabled }: VoiceRecorderProps) {
  const { t } = useTranslation();
  const { language } = useSettingsStore();
  const dir = getDirection(language);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [level, setLevel] = useState(0); // Audio level 0-1 for visualizer

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Format elapsed time ──
  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Audio level visualizer ──
  const updateLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    // Calculate RMS level
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    setLevel(Math.min(1, rms * 3)); // Amplify for visibility

    animFrameRef.current = requestAnimationFrame(updateLevel);
  }, []);

  // ── Start Recording ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Setup audio analyser for level visualization
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Pick best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // Collect chunks every 100ms
      setRecording(true);
      startTimeRef.current = Date.now();

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);

      // Start level visualizer
      updateLevel();
    } catch (err) {
      console.error('[VoiceRecorder] Failed to start:', err);
      alert(t('voice.micError'));
    }
  }, [updateLevel]);

  // ── Stop Recording ──
  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob());
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        resolve(blob);
      };

      recorder.stop();
      setRecording(false);

      // Cleanup
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      analyserRef.current = null;
    });
  }, []);

  // ── Send Voice ──
  const handleSend = useCallback(async () => {
    setSaving(true);
    try {
      const blob = await stopRecording();
      if (blob.size === 0) {
        setSaving(false);
        onCancel();
        return;
      }

      // Convert blob to base64, save to shared folder, and send
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        const mimeType = blob.type || 'audio/webm';
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const filename = `voice-${Date.now()}.${ext}`;

        // Save to shared folder for OpenClaw Station to read from workspace
        let savedPath = '';
        if (window.aegis?.voice?.save) {
          savedPath = await window.aegis.voice.save(filename, base64) || '';
        }

        // Create a local blob URL for playback in chat
        const localUrl = URL.createObjectURL(blob);

        onSendVoice(base64, mimeType, elapsed, localUrl);
        setSaving(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('[VoiceRecorder] Send failed:', err);
      setSaving(false);
    }
  }, [stopRecording, elapsed, onSendVoice, onCancel]);

  // ── Cancel ──
  const handleCancel = useCallback(async () => {
    await stopRecording();
    setElapsed(0);
    setLevel(0);
    onCancel();
  }, [stopRecording, onCancel]);

  // Auto-start recording when mounted
  useEffect(() => {
    startRecording();
    return () => {
      // Cleanup on unmount
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex items-center gap-3 w-full px-3 py-2" dir={dir}>
      {/* Cancel button */}
      <button
        onClick={handleCancel}
        className="p-2 rounded-lg hover:bg-aegis-danger/20 text-aegis-danger transition-colors"
        title={t('voice.cancel')}
      >
        <X size={18} />
      </button>

      {/* Recording indicator + waveform */}
      <div className="flex-1 flex items-center gap-3">
        {/* Pulsing red dot */}
        <div className={clsx(
          'w-3 h-3 rounded-full shrink-0',
          recording ? 'bg-red-500 animate-pulse' : 'bg-aegis-text-dim'
        )} />

        {/* Audio level bars */}
        <div className="flex items-center gap-[2px] h-8 flex-1">
          {Array.from({ length: 24 }).map((_, i) => {
            // Create a wave-like pattern based on audio level
            const barLevel = Math.max(0.1, level * Math.sin((i / 24) * Math.PI) * (0.5 + Math.random() * 0.5));
            return (
              <div
                key={i}
                className="flex-1 rounded-full bg-aegis-primary/60 transition-all duration-75"
                style={{ height: `${Math.max(4, barLevel * 32)}px` }}
              />
            );
          })}
        </div>

        {/* Elapsed time */}
        <span className="text-[13px] font-mono text-aegis-text-muted shrink-0 min-w-[40px] text-center" dir="ltr">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={saving || elapsed < 1}
        className={clsx(
          'p-2.5 rounded-xl transition-all',
          'bg-aegis-primary hover:bg-aegis-primary-hover text-aegis-btn-primary-text',
          'shadow-lg shadow-aegis-primary/20',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
        )}
        title={t('voice.sendRecording')}
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Send size={18} className="rotate-180" />
        )}
      </button>
    </div>
  );
}
