import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { api } from "../api";
import type { Project } from "../types";

interface ProjectContextValue {
  project: Project | null;
  reload: () => void;
}

const ProjectContext = createContext<ProjectContextValue>({ project: null, reload: () => {} });

export function useProject() {
  return useContext(ProjectContext);
}

export default function ProjectLayout() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);

  const reload = useCallback(() => {
    if (projectId) {
      api.getProject(Number(projectId)).then(setProject).catch(() => setProject(null));
    }
  }, [projectId]);

  useEffect(reload, [reload]);

  return (
    <ProjectContext.Provider value={{ project, reload }}>
      <div className="project-layout">
        <aside className="sidebar">
          <Link to="/" className="brand brand-small">
            InkMind
          </Link>
          <div className="sidebar-title">{project?.title ?? "…"}</div>
          <nav>
            <NavLink to="overview">Panel</NavLink>
            <NavLink to="board">Tablero</NavLink>
            <NavLink to="characters">Personajes</NavLink>
            <NavLink to="chat">Asistente IA</NavLink>
            <NavLink to="/settings" className="nav-secondary">
              ⚙ Configuración IA
            </NavLink>
          </nav>
        </aside>
        <main className="project-main">
          <Outlet />
        </main>
      </div>
    </ProjectContext.Provider>
  );
}
