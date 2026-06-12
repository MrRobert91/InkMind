import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type { Character } from "../types";
import { useProject } from "./ProjectLayout";

const EMPTY: Partial<Character> = {
  name: "",
  role: "",
  description: "",
  external_desire: "",
  internal_need: "",
  fear: "",
  wound: "",
  voice: "",
  secrets: "",
  arc: "",
  relationships: "",
};

const FIELDS: { key: keyof Character; label: string; placeholder: string; rows?: number }[] = [
  { key: "description", label: "Descripción", placeholder: "Quién es, cómo se presenta…", rows: 3 },
  { key: "external_desire", label: "Deseo externo", placeholder: "Qué quiere conseguir" },
  { key: "internal_need", label: "Necesidad interna", placeholder: "Qué necesita de verdad" },
  { key: "fear", label: "Miedo", placeholder: "A qué teme" },
  { key: "wound", label: "Herida emocional", placeholder: "Qué le marcó" },
  { key: "voice", label: "Voz propia", placeholder: "Cómo habla, muletillas, registro" },
  { key: "secrets", label: "Secretos", placeholder: "Qué oculta y a quién" },
  { key: "arc", label: "Evolución / arco", placeholder: "Cómo cambia a lo largo de la obra", rows: 2 },
  { key: "relationships", label: "Relaciones", placeholder: "Vínculos con otros personajes", rows: 2 },
];

export default function Characters() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { reload } = useProject();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editing, setEditing] = useState<Partial<Character> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.listCharacters(pid).then(setCharacters).catch((e) => setError(e.message));
  }, [pid]);

  useEffect(load, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    try {
      if (editing.id) {
        await api.updateCharacter(editing.id, editing);
      } else {
        await api.createCharacter(pid, editing);
      }
      setEditing(null);
      load();
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("¿Eliminar este personaje?")) return;
    await api.deleteCharacter(id);
    load();
    reload();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Biblioteca de personajes</h2>
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>
          + Personaje
        </button>
      </div>
      <p className="muted small">
        Fichas vivas: la IA las usa para mantener la coherencia de motivaciones, voces y arcos.
      </p>

      {error && <div className="alert">{error}</div>}

      <div className="character-grid">
        {characters.map((c) => (
          <div key={c.id} className="card character-card" onClick={() => setEditing(c)}>
            <div className="character-head">
              <h3>{c.name}</h3>
              {c.role && <span className="chip">{c.role}</span>}
            </div>
            {c.description && <p className="muted">{c.description}</p>}
            <dl className="character-traits">
              {c.external_desire && (
                <>
                  <dt>Deseo</dt>
                  <dd>{c.external_desire}</dd>
                </>
              )}
              {c.fear && (
                <>
                  <dt>Miedo</dt>
                  <dd>{c.fear}</dd>
                </>
              )}
              {c.secrets && (
                <>
                  <dt>Secreto</dt>
                  <dd>{c.secrets}</dd>
                </>
              )}
            </dl>
            <button
              className="btn btn-ghost btn-small"
              onClick={(e) => {
                e.stopPropagation();
                remove(c.id);
              }}
            >
              Eliminar
            </button>
          </div>
        ))}
        {characters.length === 0 && (
          <div className="empty-state">
            <h3>Sin personajes todavía</h3>
            <p>Crea fichas con deseo, necesidad, miedo y herida: el corazón de un buen arco.</p>
          </div>
        )}
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="modal modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{editing.id ? "Editar personaje" : "Nuevo personaje"}</h2>
            <div className="form-row">
              <label>
                Nombre
                <input
                  autoFocus
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label>
                Rol narrativo
                <input
                  value={editing.role ?? ""}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  placeholder="Protagonista, antagonista, mentor…"
                />
              </label>
            </div>
            <div className="character-fields">
              {FIELDS.map((f) => (
                <label key={f.key}>
                  {f.label}
                  <textarea
                    rows={f.rows ?? 1}
                    value={(editing[f.key] as string) ?? ""}
                    onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                  />
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
