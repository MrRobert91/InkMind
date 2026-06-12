import { useEffect, useState } from "react";
import { api, FRAMEWORK_LABELS } from "../api";
import type { Framework, Project } from "../types";
import { useProject } from "./ProjectLayout";

const PROJECT_STATUSES = ["idea", "planning", "drafting", "revising", "finished"];
const STATUS_TEXT: Record<string, string> = {
  idea: "Idea",
  planning: "Planificación",
  drafting: "Borrador",
  revising: "Revisión",
  finished: "Terminado",
};

export default function Overview() {
  const { project, reload } = useProject();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [form, setForm] = useState<Partial<Project>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listFrameworks().then(setFrameworks).catch(() => {});
  }, []);

  useEffect(() => {
    if (project) {
      setForm(project);
      setDirty(false);
    }
  }, [project]);

  if (!project) return <div className="loading">Cargando proyecto…</div>;

  const set = (field: keyof Project, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateProject(project.id, {
        title: form.title,
        genre: form.genre,
        tone: form.tone,
        audience: form.audience,
        premise: form.premise,
        theme: form.theme,
        framework: form.framework,
        status: form.status,
        world_notes: form.world_notes,
      });
      reload();
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const generateSummary = async () => {
    setLoadingSummary(true);
    setError("");
    try {
      const res = await api.storySummary(project.id);
      setSummary(res.summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Panel del proyecto</h2>
        <div className="page-actions">
          <button className="btn" onClick={generateSummary} disabled={loadingSummary}>
            {loadingSummary ? "Analizando…" : "Informe del estado de la historia"}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="overview-grid">
        <section className="card">
          <h3>Ficha de la obra</h3>
          <label>
            Título
            <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </label>
          <div className="form-row">
            <label>
              Género
              <input value={form.genre ?? ""} onChange={(e) => set("genre", e.target.value)} />
            </label>
            <label>
              Tono
              <input value={form.tone ?? ""} onChange={(e) => set("tone", e.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Público objetivo
              <input value={form.audience ?? ""} onChange={(e) => set("audience", e.target.value)} />
            </label>
            <label>
              Estado
              <select value={form.status ?? "idea"} onChange={(e) => set("status", e.target.value)}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_TEXT[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Premisa
            <textarea rows={3} value={form.premise ?? ""} onChange={(e) => set("premise", e.target.value)} />
          </label>
          <label>
            Tema central
            <textarea rows={2} value={form.theme ?? ""} onChange={(e) => set("theme", e.target.value)} />
          </label>
          <label>
            Estructura narrativa
            <select value={form.framework ?? "three_acts"} onChange={(e) => set("framework", e.target.value)}>
              {(frameworks.length
                ? frameworks
                : Object.keys(FRAMEWORK_LABELS).map((id) => ({ id, description: "" }))
              ).map((f) => (
                <option key={f.id} value={f.id}>
                  {FRAMEWORK_LABELS[f.id] ?? f.id}
                </option>
              ))}
            </select>
          </label>
          {frameworks.find((f) => f.id === form.framework)?.description && (
            <p className="muted small">
              {frameworks.find((f) => f.id === form.framework)?.description}
            </p>
          )}
        </section>

        <section className="card">
          <h3>Mundo narrativo</h3>
          <p className="muted small">
            Lugares, reglas internas, organizaciones, cronología… La IA usa estas notas para mantener
            la coherencia.
          </p>
          <textarea
            rows={14}
            value={form.world_notes ?? ""}
            onChange={(e) => set("world_notes", e.target.value)}
            placeholder="El pueblo cambia de forma cada noche. Nadie puede salir después de las doce…"
          />
          <div className="stats stats-large">
            <span>{project.chapter_count} capítulos</span>
            <span>{project.character_count} personajes</span>
            <span>{project.word_count.toLocaleString()} palabras</span>
          </div>
        </section>
      </div>

      {summary && (
        <section className="card ai-report">
          <h3>Informe del editor IA</h3>
          <pre className="ai-text">{summary}</pre>
        </section>
      )}
    </div>
  );
}
