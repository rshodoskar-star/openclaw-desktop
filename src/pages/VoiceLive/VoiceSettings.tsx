// ═══════════════════════════════════════════════════════════
// VoiceSettings — Configuration panel for Voice Live
//
// Allows the user to configure:
//   - Gemini API key
//   - Response model (fetched dynamically from Gateway)
//   - Gemini voice (with test button)
//   - Live model for STT/TTS
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Key,
  Brain,
  Volume2,
  AudioLines,
  Eye,
  EyeOff,
  Play,
  Settings,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useVoiceLiveStore } from '../../stores/voiceLiveStore';
import { useChatStore } from '../../stores/chatStore';
import { gateway } from '../../services/gateway/index';

/** Known Gemini voices */
const GEMINI_VOICES = [
  'Orus', 'Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede',
  'Leda', 'Perseus', 'Altair', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
  'Erinome', 'Gacrux', 'Laomedeia', 'Pulcherrima', 'Rasalgethi',
  'Sadachbia', 'Sadaltager', 'Sulafat', 'Vindemiatrix', 'Zubenelgenubi',
];

/** Known Gemini Live models */
const LIVE_MODELS = [
  'gemini-2.5-flash-native-audio-latest',
  'gemini-2.0-flash-live-001',
];

interface VoiceSettingsProps {
  onClose: () => void;
}

export function VoiceSettings({ onClose }: VoiceSettingsProps) {
  const { t } = useTranslation();
  const store = useVoiceLiveStore();
  const { availableModels } = useChatStore();

  // Local form state (editable, saved on "Save")
  const [apiKey, setApiKey] = useState(store.geminiApiKey);
  const [responseModel, setResponseModel] = useState(store.responseModel);
  const [voice, setVoice] = useState(store.geminiVoice);
  const [liveModel, setLiveModel] = useState(store.geminiModel);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  // Fetch available models from gateway on mount
  useEffect(() => {
    gateway.getAvailableModels().catch(() => {});
  }, []);

  // Save settings to store
  const handleSave = () => {
    store.updateSettings({
      geminiApiKey: apiKey,
      geminiModel: liveModel,
      geminiVoice: voice,
      responseModel,
    });
    onClose();
  };

  // Test voice by sending a short TTS request
  const handleTestVoice = async () => {
    if (!apiKey || testing) return;
    setTesting(true);
    let ctx: AudioContext | null = null;
    try {
      // Use the Gemini TTS model to generate a quick sample
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ role: 'user', parts: [{ text: 'مرحباً، أنا OpenClaw Station' }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      // Play the audio
      const audioData = (response as any)?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const binary = atob(audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        ctx = new AudioContext({ sampleRate: 24000 });
        const int16 = new Int16Array(bytes.buffer);
        const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
        const channel = audioBuffer.getChannelData(0);
        for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
        source.onended = () => ctx?.close();
      }
    } catch (err) {
      ctx?.close();
      console.error('[VoiceSettings] Test voice failed:', err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="voice-settings-overlay">
      {/* Header */}
      <div className="voice-settings-header">
        <div className="voice-settings-title">
          <Settings size={18} />
          <span>{t('voiceLive.settings')}</span>
        </div>
        <button className="voice-btn-ghost" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="voice-settings-body">
        {/* Gemini API Key */}
        <div className="voice-field-group">
          <label className="voice-field-label">
            <Key size={14} />
            <span>{t('voiceLive.apiKey')}</span>
          </label>
          <div className="voice-input-row">
            <input
              type={showKey ? 'text' : 'password'}
              className="voice-field-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('voiceLive.apiKeyPlaceholder')}
            />
            <button
              className="voice-btn-action"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Response Model */}
        <div className="voice-field-group">
          <label className="voice-field-label">
            <Brain size={14} />
            <span>{t('voiceLive.responseModel')}</span>
          </label>
          <select
            className="voice-field-select"
            value={responseModel}
            onChange={(e) => setResponseModel(e.target.value)}
          >
            <option value="">{t('voiceLive.noModels')}</option>
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.alias ? `${m.alias} — ${m.id}` : m.id}
              </option>
            ))}
          </select>
          <div className="voice-field-hint">
            {t('voiceLive.responseModelHint')}
          </div>
        </div>

        <div className="voice-divider" />

        {/* Gemini Voice */}
        <div className="voice-field-group">
          <label className="voice-field-label">
            <Volume2 size={14} />
            <span>{t('voiceLive.geminiVoice')}</span>
          </label>
          <div className="voice-input-row">
            <select
              className="voice-field-select"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            >
              {GEMINI_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              className="voice-btn-action"
              onClick={handleTestVoice}
              disabled={!apiKey || testing}
            >
              <Play size={12} />
              <span>{t('voiceLive.testVoice')}</span>
            </button>
          </div>
        </div>

        {/* Live Model */}
        <div className="voice-field-group">
          <label className="voice-field-label">
            <AudioLines size={14} />
            <span>{t('voiceLive.liveModel')}</span>
          </label>
          <select
            className="voice-field-select"
            value={liveModel}
            onChange={(e) => setLiveModel(e.target.value)}
          >
            {LIVE_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="voice-field-hint">
            {t('voiceLive.liveModelHint')}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="voice-settings-footer">
        <button className="voice-btn-cancel" onClick={onClose}>
          {t('voiceLive.cancel')}
        </button>
        <button className="voice-btn-save" onClick={handleSave}>
          {t('voiceLive.save')}
        </button>
      </div>
    </div>
  );
}
