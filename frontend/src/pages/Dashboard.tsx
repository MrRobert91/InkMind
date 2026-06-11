import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, FRAMEWORK_LABELS, STATUS_LABELS } from "../api";
import type { Framework, Project } from "../types";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    genre: "",
    tone: "",
    premise: "",
    framework: "three_acts",
  });

  const load = () => {
    api.listProjects().then(setProjects).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    api.listFrameworks().then(setFrameworks).catch(() => {});
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await api.createProject(form);
      setShowForm(false);
      setForm({ title: "", genre: "", tone: "", premise: "", framework: "three_acts" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("¿Eliminar este proyecto y todo su contenido?")) return;
    await api.deleteProject(id);
    load();
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="brand">InkMind</h1>
          <p className="tagline">Tu copiloto narrativo: tú escribes, la IA acompaña.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nuevo proyecto
        </button>
      </header>

      {error && <div className="alert">{error}</div>}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={create}>
            <h2>Nuevo proyecto narrativo</h2>
            <label>
              Título provisional
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="La ciudad que recordaba un crimen"
              />
            </label>
            <div className="form-row">
              <label>
                Género
                <input
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                  placeholder="Misterio, fantasía, drama…"
                />
              </label>
              <label>
                Tono
                <input
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  placeholder="Melancólico, irónico…"
                />
              </label>
            </div>
            <label>
              Premisa (puede ser una idea muy sencilla)
              <textarea
                rows={3}
                value={form.premise}
                onChange={(e) => setForm({ ...form, premise: e.target.value })}
                placeholder="Una mujer vuelve a su pueblo después de muchos años…"
              />
            </label>
            <label>
              Estructura narrativa
              <select
                value={form.framework}
                onChange={(e) => setForm({ ...form, framework: e.target.value })}
              >
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
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Crear proyecto
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="project-grid">
        {projects.map((p) => (
          <div key={p.id} className="project-card">
            <Link to={`/projects/${p.id}`} className="project-card-body">
              <h3>{p.title}</h3>
              <p className="muted">{p.premise || "Sin premisa todavía"}</p>
              <div className="chips">
                {p.genre && <span className="chip">{p.genre}</span>}
                <span className="chip">{FRAMEWORK_LABELS[p.framework] ?? p.framework}</span>
                <span className="chip chip-status">{STATUS_LABELS[p.status] ?? p.status}</span>
              </div>
              <div className="stats">
                <span>{p.chapter_count} capítulos</span>
                <span>{p.character_count} personajes</span>
                <span>{p.word_count.toLocaleString()} palabras</span>
              </div>
            </Link>
            <button className="btn btn-ghost btn-small" onClick={() => remove(p.id)}>
              Eliminar
            </button>
          </div>
        ))}
        {projects.length === 0 && !showForm && (
          <div className="empty-state">
            <h3>Todavía no hay proyectos</h3>
            <p>Empieza con una idea sencilla. InkMind te ayudará a convertirla en una historia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
