import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ACTION_LABELS, api } from "../api";
import type { Chapter, ChapterVersion, EditAction } from "../types";
import { useProject } from "./ProjectLayout";

const CHAPTER_STATUSES = ["outline", "draft", "revising", "done"];
const STATUS_TEXT: Record<string, string> = {
  outline: "Esquema",
  draft: "Borrador",
  revising: "Revisión",
  done: "Terminado",
};

interface Selection {
  start: number;
  end: number;
  text: string;
}

export default function ChapterEditor() {
  const { projectId, chapterId } = useParams();
  const pid = Number(projectId);
  const cid = Number(chapterId);
  const { reload } = useProject();

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [actions, setActions] = useState<EditAction[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMeta, setShowMeta] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<ChapterVersion | null>(null);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [aiAction, setAiAction] = useState("expand");
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadVersions = useCallback(() => {
    api.listVersions(cid).then(setVersions).catch(() => {});
  }, [cid]);

  useEffect(() => {
    api.getChapter(cid).then(setChapter).catch((e) => setError(e.message));
    loadVersions();
    api.listEditActions().then(setActions).catch(() => {});
  }, [cid, loadVersions]);

  if (!chapter) return <div className="loading">Cargando capítulo…</div>;

  const set = (field: keyof Chapter, value: string) => {
    setChapter({ ...chapter, [field]: value });
    setDirty(true);
  };

  const save = async (note?: string) => {
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateChapter(chapter.id, {
        title: chapter.title,
        summary: chapter.summary,
        content: chapter.content,
        status: chapter.status,
        conflict: chapter.conflict,
        emotion: chapter.emotion,
        narrative_function: chapter.narrative_function,
        version_note: note,
      });
      setChapter(updated);
      setDirty(false);
      loadVersions();
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const createMilestone = async () => {
    const note = window.prompt("Nombre del hito (p. ej. «Final alternativo A»):");
    if (note === null) return;
    if (dirty) await save();
    await api.createMilestone(chapter.id, note || "Hito manual");
    loadVersions();
  };

  const restore = async (v: ChapterVersion) => {
    if (!window.confirm("¿Restaurar esta versión? El estado actual se guardará como versión.")) return;
    const restored = await api.restoreVersion(v.id);
    setChapter(restored);
    setDirty(false);
    setPreviewVersion(null);
    loadVersions();
  };

  const captureSelection = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (end > start) {
      setSelection({ start, end, text: chapter.content.slice(start, end) });
    } else {
      setSelection(null);
    }
  };

  const runAi = async () => {
    if (!selection) return;
    setAiLoading(true);
    setAiResult(null);
    setError("");
    try {
      const res = await api.editFragment(pid, {
        fragment: selection.text,
        action: aiAction,
        instructions: aiInstructions,
        chapter_id: chapter.id,
      });
      setAiResult(res.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    if (!selection || aiResult === null) return;
    const next =
      chapter.content.slice(0, selection.start) + aiResult + chapter.content.slice(selection.end);
    setChapter({ ...chapter, content: next });
    setDirty(true);
    setAiResult(null);
    setSelection(null);
  };

  const replaceable = !["alternatives", "analyze"].includes(aiAction);
  const wordCount = chapter.content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="page editor-page">
      <div className="page-header">
        <div className="editor-title-group">
          <Link to="../board" className="back-link">
            ← Tablero
          </Link>
          <input
            className="editor-title"
            value={chapter.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="page-actions">
          <select value={chapter.status} onChange={(e) => set("status", e.target.value)}>
            {CHAPTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_TEXT[s]}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setShowMeta(!showMeta)}>
            Ficha de escena
          </button>
          <button className="btn" onClick={() => setShowVersions(!showVersions)}>
            Versiones ({versions.length})
          </button>
          <button className="btn" onClick={createMilestone}>
            Crear hito
          </button>
          <button className="btn btn-primary" onClick={() => save()} disabled={!dirty || saving}>
            {saving ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      {showMeta && (
        <section className="card meta-panel">
          <div className="form-row">
            <label>
              Resumen del capítulo
              <textarea rows={2} value={chapter.summary} onChange={(e) => set("summary", e.target.value)} />
            </label>
            <label>
              Conflicto principal
              <textarea rows={2} value={chapter.conflict} onChange={(e) => set("conflict", e.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Emoción dominante
              <input value={chapter.emotion} onChange={(e) => set("emotion", e.target.value)} />
            </label>
            <label>
              Función narrativa
              <input
                value={chapter.narrative_function}
                onChange={(e) => set("narrative_function", e.target.value)}
              />
            </label>
          </div>
        </section>
      )}

      <div className={`editor-layout ${showVersions ? "with-versions" : ""}`}>
        <div className="editor-main">
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={chapter.content}
            onChange={(e) => set("content", e.target.value)}
            onSelect={captureSelection}
            placeholder="Escribe aquí tu capítulo. Selecciona un fragmento para pedirle acciones a la IA…"
          />
          <div className="editor-statusbar">
            <span>{wordCount.toLocaleString()} palabras</span>
            {selection && <span>{selection.text.split(/\s+/).filter(Boolean).length} palabras seleccionadas</span>}
          </div>

          <section className="card ai-toolbar">
            <h4>Edición inteligente {selection ? "" : "— selecciona un fragmento del texto"}</h4>
            <div className="ai-controls">
              <select value={aiAction} onChange={(e) => setAiAction(e.target.value)}>
                {(actions.length
                  ? actions
                  : Object.keys(ACTION_LABELS).map((id) => ({ id, description: "" }))
                ).map((a) => (
                  <option key={a.id} value={a.id} title={a.description}>
                    {ACTION_LABELS[a.id] ?? a.id}
                  </option>
                ))}
              </select>
              <input
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                placeholder="Instrucciones opcionales: «más tenso, sin adjetivos»…"
              />
              <button className="btn btn-primary" onClick={runAi} disabled={!selection || aiLoading}>
                {aiLoading ? "Pensando…" : "Aplicar IA"}
              </button>
            </div>
            {aiResult !== null && (
              <div className="ai-result">
                <pre className="ai-text">{aiResult}</pre>
                <div className="modal-actions">
                  <button className="btn" onClick={() => setAiResult(null)}>
                    Descartar
                  </button>
                  {replaceable && (
                    <button className="btn btn-primary" onClick={applyAiResult}>
                      Sustituir fragmento
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {showVersions && (
          <aside className="versions-panel card">
            <h4>Historial de versiones</h4>
            {versions.length === 0 && <p className="muted small">Todavía no hay versiones guardadas.</p>}
            <ul className="version-list">
              {versions.map((v) => (
                <li key={v.id}>
                  <div className="version-head">
                    <span className={`chip chip-${v.origin}`}>{v.origin}</span>
                    <span className="muted small">{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                  <div className="version-note">{v.note || v.title}</div>
                  <div className="version-actions">
                    <button className="btn btn-small" onClick={() => setPreviewVersion(v)}>
                      Ver
                    </button>
                    <button className="btn btn-small" onClick={() => restore(v)}>
                      Restaurar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {previewVersion && (
        <div className="modal-backdrop" onClick={() => setPreviewVersion(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>
              {previewVersion.title}{" "}
              <span className="muted small">({new Date(previewVersion.created_at).toLocaleString()})</span>
            </h2>
            <pre className="ai-text version-preview">{previewVersion.content || "(vacío)"}</pre>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPreviewVersion(null)}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={() => restore(previewVersion)}>
                Restaurar esta versión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
