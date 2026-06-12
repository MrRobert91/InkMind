import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, FRAMEWORK_LABELS, STATUS_LABELS } from "../api";
import type { Chapter, Framework } from "../types";
import { useProject } from "./ProjectLayout";

export default function Board() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { project, reload } = useProject();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ framework: "", num_chapters: "", instructions: "" });

  const load = useCallback(() => {
    api.listChapters(pid).then(setChapters).catch((e) => setError(e.message));
  }, [pid]);

  useEffect(() => {
    load();
    api.listFrameworks().then(setFrameworks).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (project) setGenForm((f) => ({ ...f, framework: f.framework || project.framework }));
  }, [project]);

  const addChapter = async () => {
    const title = window.prompt("Título del nuevo capítulo:");
    if (!title?.trim()) return;
    await api.createChapter(pid, { title });
    load();
    reload();
  };

  const removeChapter = async (id: number) => {
    if (!window.confirm("¿Eliminar este capítulo y sus versiones?")) return;
    await api.deleteChapter(id);
    load();
    reload();
  };

  const onDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const ids = chapters.map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setChapters(ids.map((id) => chapters.find((c) => c.id === id)!));
    setDragId(null);
    try {
      setChapters(await api.reorderChapters(pid, ids));
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError("");
    try {
      await api.generateStructure(pid, {
        framework: genForm.framework || undefined,
        num_chapters: genForm.num_chapters ? Number(genForm.num_chapters) : undefined,
        instructions: genForm.instructions,
      });
      setShowGenerate(false);
      load();
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Tablero de capítulos</h2>
        <div className="page-actions">
          <button className="btn" onClick={() => setShowGenerate(true)}>
            ✨ Generar estructura con IA
          </button>
          <button className="btn btn-primary" onClick={addChapter}>
            + Capítulo
          </button>
        </div>
      </div>
      <p className="muted small">
        Arrastra las tarjetas para reordenar la historia. Haz clic en una tarjeta para escribir.
      </p>

      {error && <div className="alert">{error}</div>}

      {showGenerate && (
        <div className="modal-backdrop" onClick={() => setShowGenerate(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={generate}>
            <h2>Generar estructura</h2>
            <p className="muted small">
              La IA propondrá un esquema de capítulos según el framework elegido. Las tarjetas
              generadas son totalmente editables: tú decides qué se queda.
            </p>
            <label>
              Framework narrativo
              <select
                value={genForm.framework}
                onChange={(e) => setGenForm({ ...genForm, framework: e.target.value })}
              >
                {frameworks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {FRAMEWORK_LABELS[f.id] ?? f.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Número de capítulos (opcional)
              <input
                type="number"
                min={3}
                max={40}
                value={genForm.num_chapters}
                onChange={(e) => setGenForm({ ...genForm, num_chapters: e.target.value })}
                placeholder="Deja vacío para que decida la IA"
              />
            </label>
            <label>
              Instrucciones adicionales (opcional)
              <textarea
                rows={3}
                value={genForm.instructions}
                onChange={(e) => setGenForm({ ...genForm, instructions: e.target.value })}
                placeholder="Quiero un giro a mitad de la historia, final abierto…"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowGenerate(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={generating}>
                {generating ? "Generando…" : "Generar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="board">
        {chapters.map((c, i) => (
          <div
            key={c.id}
            className={`board-card ${dragId === c.id ? "dragging" : ""}`}
            draggable
            onDragStart={() => setDragId(c.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(c.id)}
            onDragEnd={() => setDragId(null)}
          >
            <div className="board-card-top">
              <span className="chapter-number">Cap. {i + 1}</span>
              <span className={`chip chip-status status-${c.status}`}>
                {STATUS_LABELS[c.status] ?? c.status}
              </span>
            </div>
            <Link to={`../chapters/${c.id}`} className="board-card-title">
              {c.title}
            </Link>
            {c.summary && <p className="board-summary">{c.summary}</p>}
            {c.conflict && (
              <p className="board-meta">
                <strong>Conflicto:</strong> {c.conflict}
              </p>
            )}
            <div className="board-card-footer">
              {c.emotion && <span className="chip">{c.emotion}</span>}
              <span className="muted small">{c.content ? `${c.content.split(/\s+/).filter(Boolean).length} palabras` : "sin texto"}</span>
              <button className="btn btn-ghost btn-small" onClick={() => removeChapter(c.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        {chapters.length === 0 && (
          <div className="empty-state">
            <h3>La historia está en blanco</h3>
            <p>Crea capítulos a mano o deja que la IA proponga una estructura inicial.</p>
          </div>
        )}
      </div>
    </div>
  );
}
