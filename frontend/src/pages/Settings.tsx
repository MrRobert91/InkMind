import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Provider, TaskSetting } from "../types";

const TASK_HELP: Record<string, string> = {
  chat: "Conversaciones del asistente narrativo. Conviene un modelo potente con buen contexto.",
  structure: "Genera el esquema de capítulos en JSON. Necesita un modelo que siga bien instrucciones.",
  edit: "Reescritura de fragmentos seleccionados (tono, tensión, ritmo…).",
  summary: "Informe editorial del estado de la historia.",
};

export default function Settings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<TaskSetting[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.listProviders(), api.getTaskSettings()])
      .then(([p, s]) => {
        setProviders(p);
        setSettings(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  const providerById = (id: string) => providers.find((p) => p.id === id);

  const update = (task: string, patch: Partial<TaskSetting>) => {
    setSettings((prev) =>
      prev.map((s) => {
        if (s.task !== task) return s;
        const next = { ...s, ...patch };
        // Switching provider resets the model to that provider's default.
        if (patch.provider && patch.provider !== s.provider) {
          next.model = providerById(patch.provider)?.default_model ?? "";
        }
        return next;
      }),
    );
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await api.saveTaskSettings(settings);
      setSettings(result);
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const configured = providers.filter((p) => p.configured);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <Link to="/" className="back-link">← Proyectos</Link>
          <h1 className="brand">Configuración IA</h1>
          <p className="tagline">Elige qué proveedor y qué modelo ejecuta cada tarea.</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar cambios"}
        </button>
      </header>

      {error && <div className="alert">{error}</div>}

      <section className="card">
        <h3>Proveedores</h3>
        <p className="muted small">
          Un proveedor está disponible cuando su clave está definida en el archivo <code>.env</code>{" "}
          del servidor (reinicia el backend tras cambiarla). Todos los proveedores compatibles con la
          API de OpenAI funcionan: OpenAI, OpenRouter, Groq, xAI/Grok, NVIDIA NIM, Hugging Face,
          Ollama local o cualquier endpoint personalizado.
        </p>
        <div className="provider-list">
          {providers.map((p) => (
            <div key={p.id} className={`provider-pill ${p.configured ? "ok" : ""}`}>
              <span className="provider-dot" />
              <span>{p.label}</span>
              <span className="muted small">
                {p.configured ? "disponible" : `falta ${p.requires_key ? p.env : "URL base"}`}
              </span>
            </div>
          ))}
        </div>
        {configured.length === 0 && (
          <div className="alert" style={{ marginTop: "0.8rem" }}>
            Ningún proveedor configurado todavía: las funciones de IA estarán desactivadas.
          </div>
        )}
      </section>

      <section className="card">
        <h3>Modelo por tarea</h3>
        {settings.map((s) => {
          const provider = providerById(s.provider);
          return (
            <div key={s.task} className="task-setting">
              <div className="task-info">
                <strong>{s.label}</strong>
                <p className="muted small">{TASK_HELP[s.task]}</p>
              </div>
              <label>
                Proveedor
                <select value={s.provider} onChange={(e) => update(s.task, { provider: e.target.value })}>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.configured ? "" : " (sin configurar)"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Modelo
                <input
                  value={s.model}
                  onChange={(e) => update(s.task, { model: e.target.value })}
                  list={`models-${s.task}`}
                  placeholder={provider?.default_model || "id del modelo"}
                />
                <datalist id={`models-${s.task}`}>
                  {provider?.suggested_models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
            </div>
          );
        })}
      </section>
    </div>
  );
}
