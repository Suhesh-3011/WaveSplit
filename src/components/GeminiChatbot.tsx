import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  Sliders,
  Scissors,
  Mic,
  RotateCcw,
  Zap,
  Brain,
  Layers,
} from 'lucide-react';
import { ChatMessage, GeminiChatModel, AudioTrack } from '../types';

interface GeminiChatbotProps {
  currentTrack?: AudioTrack | null;
}

type ChatRole = 'producer' | 'hook_advisor' | 'vocal_coach';

const ROLE_CONFIGS: Record<
  ChatRole,
  {
    name: string;
    icon: any;
    description: string;
    systemInstruction: string;
    starterPrompts: string[];
  }
> = {
  producer: {
    name: 'Audio Mastering & DSP Producer',
    icon: Sliders,
    description: 'Expert in stereo phase cancellation, vocal formants, EQ carving, and clean instrumental mixes.',
    systemInstruction: `You are an elite Audio Mastering Engineer and Music Producer.
Your role:
1. Guide users on isolating vocals and removing vocal tracks using Center Channel Extraction, Mid/Side processing, and phase inversion.
2. Explain how to preserve sub-bass (<180Hz) and stereo high-end air (>8kHz) so instrumental backing tracks stay punchy.
3. Suggest equalization (EQ) curves to cut remaining vocal reverb bleed (typically 1kHz - 3.5kHz) from instrumentals.
4. Keep explanations practical, precise, and supportive.`,
    starterPrompts: [
      'How does center-channel phase cancellation remove vocals without deleting stereo instruments?',
      'How do I eliminate faint vocal reverb echoes left behind in my instrumental track?',
      'What EQ frequency bands should I carve out to make space for a new singer over this instrumental?',
    ],
  },
  hook_advisor: {
    name: 'Snippet & Viral Hook Advisor',
    icon: Scissors,
    description: 'Specialist in identifying catchiest hooks, drops, and intro timings for TikTok/Reels and custom ringtones.',
    systemInstruction: `You are a Viral Music Consultant and Ringtone Sound Designer.
Your role:
1. Advise users on selecting the absolute best 15-second snippet (for TikTok/Reels) or 30-second loop (for phone ringtones).
2. Recommend where to place start/end markers (e.g. 1 beat before chorus drop, rising synth hook, or punchy vocal hook).
3. Explain fade-in/fade-out envelope strategies so ringtones don't sound jarring when a phone rings.
4. Format your advice clearly with timestamp recommendations when track info is provided.`,
    starterPrompts: [
      'What makes a 30-second ringtone loop sound seamless and pleasant when a phone rings?',
      'Where should I cut this track for a 15-second high-energy TikTok / Reels snippet?',
      'How long should the fade-in and fade-out be for an SMS text notification sound?',
    ],
  },
  vocal_coach: {
    name: 'Karaoke & Vocal Coach',
    icon: Mic,
    description: 'Advises on singing over instrumental backings, pitch practice, and acapella vocal stem arrangement.',
    systemInstruction: `You are a Professional Vocal Coach and Karaoke Arranger.
Your role:
1. Help singers rehearse and perform using isolated vocal stems and custom instrumental backings.
2. Provide warmup exercises and ear-training tips using the isolated vocal track as a guide.
3. Suggest vocal harmonies and cover track ideas based on the user's song.`,
    starterPrompts: [
      'How can I use the isolated vocal stem to practice pitch accuracy and vibrato?',
      'What are the best vocal warmups before recording a cover over an instrumental track?',
      'How can I harmonize with the lead vocal stem?',
    ],
  },
};

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({ currentTrack }) => {
  const [selectedRole, setSelectedRole] = useState<ChatRole>('producer');
  const [selectedModel, setSelectedModel] = useState<GeminiChatModel>('gemini-3.5-flash');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello! I'm your AI Audio Producer. I can help you dial in the cleanest instrumental vocal removal, advise on the best drop timestamps for ringtones & social snippets, or discuss audio mastering. How can I assist with your track today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of thread
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsLoading(true);

    try {
      // Build context including track metadata
      let contextPrefix = '';
      if (currentTrack) {
        contextPrefix = `[Context: Active track is "${currentTrack.title}" by ${currentTrack.artist}, Duration: ${Math.round(currentTrack.duration)}s, Source: ${currentTrack.sourceType}]. `;
      }

      const activeConfig = ROLE_CONFIGS[selectedRole];
      const fullSystemInstruction = `${activeConfig.systemInstruction}\n${contextPrefix}`;

      // Convert history for API
      const apiMessages = newHistory.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemInstruction: fullSystemInstruction,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Chat error: ${res.status}`);
      }

      const modelMessage: ChatMessage = {
        id: `msg-model-${Date.now()}`,
        role: 'model',
        text: data.text || 'I have analyzed your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'model',
        text: `Sorry, I encountered an issue: ${err.message || 'Unable to connect to Gemini'}. Please ensure your GEMINI_API_KEY is configured in Settings > Secrets.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: `Switched role to ${ROLE_CONFIGS[selectedRole].name}. How can I assist with your audio engineering or snippet selection?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[650px] overflow-hidden">
      {/* Chat Header: Role Switcher & Model Affordance */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Role Selector Tabs */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Gemini Multi-Turn Chat
            </span>
            {currentTrack && (
              <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">
                Track: {currentTrack.title}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(ROLE_CONFIGS) as ChatRole[]).map((roleKey) => {
              const cfg = ROLE_CONFIGS[roleKey];
              const Icon = cfg.icon;
              const isSelected = selectedRole === roleKey;
              return (
                <button
                  key={roleKey}
                  id={`role-btn-${roleKey}`}
                  onClick={() => {
                    setSelectedRole(roleKey);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gemini Model Selector Affordance */}
        <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800">
            {[
              { id: 'gemini-3.5-flash', label: 'Flash 3.5 (General)', icon: Zap },
              { id: 'gemini-3.1-pro-preview', label: 'Pro 3.1 (Complex)', icon: Brain },
              { id: 'gemini-3.1-flash-lite', label: 'Flash-Lite (Fast)', icon: Sparkles },
            ].map((m) => {
              const isSelected = selectedModel === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  id={`model-${m.id.replace(/\./g, '-')}`}
                  onClick={() => setSelectedModel(m.id as GeminiChatModel)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={m.label}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{m.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleResetChat}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            title="Clear & Restart Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-200 shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`mt-1.5 text-[10px] ${
                    isUser ? 'text-indigo-200 text-right' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="rounded-2xl p-3.5 bg-slate-950/80 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Thinking with {selectedModel}...
            </div>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Suggested Starter Prompts */}
      <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          Ideas:
        </span>
        {ROLE_CONFIGS[selectedRole].starterPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask the ${ROLE_CONFIGS[selectedRole].name} anything about stems, drops, or mastering...`}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />

        <button
          type="submit"
          id="btn-send-chat"
          disabled={isLoading || !inputText.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
