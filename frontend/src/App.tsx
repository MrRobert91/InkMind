import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ProjectLayout from "./pages/ProjectLayout";
import Overview from "./pages/Overview";
import Board from "./pages/Board";
import Characters from "./pages/Characters";
import Chat from "./pages/Chat";
import ChapterEditor from "./pages/ChapterEditor";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/projects/:projectId" element={<ProjectLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="board" element={<Board />} />
        <Route path="characters" element={<Characters />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chapters/:chapterId" element={<ChapterEditor />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
