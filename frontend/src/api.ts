import type {
  Chapter,
  ChapterVersion,
  Character,
  ChatMessage,
  EditAction,
  Framework,
  Project,
  Provider,
  TaskSetting,
} from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Projects
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (data: Partial<Project>) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  getProject: (id: number) => request<Project>(`/api/projects/${id}`),
  updateProject: (id: number, data: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProject: (id: number) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  // Chapters
  listChapters: (projectId: number) => request<Chapter[]>(`/api/projects/${projectId}/chapters`),
  createChapter: (projectId: number, data: Partial<Chapter>) =>
    request<Chapter>(`/api/projects/${projectId}/chapters`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getChapter: (id: number) => request<Chapter>(`/api/chapters/${id}`),
  updateChapter: (id: number, data: Partial<Chapter> & { version_note?: string }) =>
    request<Chapter>(`/api/chapters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteChapter: (id: number) => request<void>(`/api/chapters/${id}`, { method: "DELETE" }),
  reorderChapters: (projectId: number, chapterIds: number[]) =>
    request<Chapter[]>(`/api/projects/${projectId}/chapters/reorder`, {
      method: "PUT",
      body: JSON.stringify({ chapter_ids: chapterIds }),
    }),

  // Versions
  listVersions: (chapterId: number) =>
    request<ChapterVersion[]>(`/api/chapters/${chapterId}/versions`),
  createMilestone: (chapterId: number, note: string) =>
    request<ChapterVersion>(`/api/chapters/${chapterId}/versions`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  restoreVersion: (versionId: number) =>
    request<Chapter>(`/api/versions/${versionId}/restore`, { method: "POST" }),

  // Characters
  listCharacters: (projectId: number) =>
    request<Character[]>(`/api/projects/${projectId}/characters`),
  createCharacter: (projectId: number, data: Partial<Character>) =>
    request<Character>(`/api/projects/${projectId}/characters`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCharacter: (id: number, data: Partial<Character>) =>
    request<Character>(`/api/characters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCharacter: (id: number) => request<void>(`/api/characters/${id}`, { method: "DELETE" }),

  // Chat
  getChat: (projectId: number) => request<ChatMessage[]>(`/api/projects/${projectId}/chat`),
  sendChat: (projectId: number, content: string, chapterId?: number) =>
    request<ChatMessage>(`/api/projects/${projectId}/chat`, {
      method: "POST",
      body: JSON.stringify({ content, chapter_id: chapterId ?? null }),
    }),
  clearChat: (projectId: number) =>
    request<void>(`/api/projects/${projectId}/chat`, { method: "DELETE" }),

  // AI
  listFrameworks: () => request<Framework[]>("/api/frameworks"),
  listEditActions: () => request<EditAction[]>("/api/ai/actions"),
  generateStructure: (
    projectId: number,
    data: { framework?: string; num_chapters?: number; instructions?: string },
  ) =>
    request<Chapter[]>(`/api/projects/${projectId}/generate-structure`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  editFragment: (
    projectId: number,
    data: { fragment: string; action: string; instructions?: string; chapter_id?: number },
  ) =>
    request<{ result: string }>(`/api/projects/${projectId}/edit-fragment`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  storySummary: (projectId: number) =>
    request<{ summary: string }>(`/api/projects/${projectId}/summary`, { method: "POST" }),

  // AI provider settings
  listProviders: () => request<Provider[]>("/api/ai/providers"),
  getTaskSettings: () => request<TaskSetting[]>("/api/ai/task-settings"),
  saveTaskSettings: (settings: TaskSetting[]) =>
    request<TaskSetting[]>("/api/ai/task-settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

export const FRAMEWORK_LABELS: Record<string, string> = {
  three_acts: "Tres actos",
  hero_journey: "Viaje del héroe",
  save_the_cat: "Save the Cat",
  snowflake: "Snowflake",
  mystery: "Misterio",
  custom: "Personalizada",
};

export const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  planning: "Planificación",
  drafting: "Borrador",
  revising: "Revisión",
  finished: "Terminado",
  outline: "Esquema",
  draft: "Borrador",
  done: "Terminado",
};

export const ACTION_LABELS: Record<string, string> = {
  expand: "Expandir",
  summarize: "Resumir",
  tone: "Cambiar tono",
  tension: "Añadir tensión",
  dialogue: "Convertir en diálogo",
  poetic: "Más poético",
  subtle: "Más sutil",
  rhythm: "Mejorar ritmo",
  alternatives: "3 alternativas",
  analyze: "Analizar función",
};
