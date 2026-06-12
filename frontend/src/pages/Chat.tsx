import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type { ChatMessage } from "../types";

const SUGGESTIONS = [
  "Propón cinco premisas más potentes a partir de mi idea.",
  "¿Qué estructura narrativa encaja mejor con esta historia y por qué?",
  "Sugiere un giro de guion para el final del segundo acto.",
  "¿Qué promesas narrativas he abierto y todavía no he cerrado?",
  "Detecta capítulos con poco conflicto.",
  "Hazme tres preguntas que me ayuden a conocer mejor a mi protagonista.",
];

export default function Chat() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.getChat(pid).then(setMessages).catch((e) => setError(e.message));
  }, [pid]);

  useEffect(load, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setError("");
    // Optimistic render of the user turn while the model thinks.
    setMessages((m) => [
      ...m,
      { id: -1, role: "user", content, created_at: new Date().toISOString() },
    ]);
    try {
      await api.sendChat(pid, content);
      load();
    } catch (e) {
      setError((e as Error).message);
      load();
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("¿Borrar toda la conversación?")) return;
    await api.clearChat(pid);
    load();
  };

  return (
    <div className="page chat-page">
      <div className="page-header">
        <h2>Asistente narrativo</h2>
        <button className="btn" onClick={clear} disabled={messages.length === 0}>
          Limpiar conversación
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="chat-window">
        {messages.length === 0 && !sending && (
          <div className="chat-empty">
            <p className="muted">
              El asistente conoce tu premisa, personajes y capítulos. Pídele ideas, estructura,
              análisis o críticas constructivas.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={`${m.id}-${m.created_at}`} className={`chat-msg chat-${m.role}`}>
            <div className="chat-role">{m.role === "user" ? "Tú" : "InkMind"}</div>
            <pre className="ai-text">{m.content}</pre>
          </div>
        ))}
        {sending && (
          <div className="chat-msg chat-assistant">
            <div className="chat-role">InkMind</div>
            <div className="typing">Pensando<span>.</span><span>.</span><span>.</span></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Pregunta sobre tu historia… (Enter para enviar, Shift+Enter para salto de línea)"
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
