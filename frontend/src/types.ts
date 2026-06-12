export interface Project {
  id: number;
  title: string;
  genre: string;
  tone: string;
  audience: string;
  premise: string;
  theme: string;
  framework: string;
  status: string;
  world_notes: string;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  character_count: number;
  word_count: number;
}

export interface Chapter {
  id: number;
  project_id: number;
  title: string;
  summary: string;
  content: string;
  order_index: number;
  status: string;
  conflict: string;
  emotion: string;
  narrative_function: string;
  created_at: string;
  updated_at: string;
}

export interface ChapterVersion {
  id: number;
  chapter_id: number;
  title: string;
  content: string;
  note: string;
  origin: string;
  created_at: string;
}

export interface Character {
  id: number;
  project_id: number;
  name: string;
  role: string;
  description: string;
  external_desire: string;
  internal_need: string;
  fear: string;
  wound: string;
  voice: string;
  secrets: string;
  arc: string;
  relationships: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Framework {
  id: string;
  description: string;
}

export interface EditAction {
  id: string;
  description: string;
}
