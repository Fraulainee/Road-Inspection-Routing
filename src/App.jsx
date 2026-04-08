import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { useProjects } from "./hooks/useProjects";

import { Folder, LayoutDashboard, MessageSquareWarning, Settings } from 'lucide-react';

import ProjectsPage from "./pages/ProjectsPage";
import ProjectPage from "./pages/ProjectPage";
import NewProjectPage from "./pages/NewProjectPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import ChainagePage from "./pages/ChainagePage";
import SegmentPage from "./pages/SegmentPage";
import SubsegmentPage from "./pages/SubsegmentPage";
import ReviewPage from "./pages/ReviewPage";
import EvaluationPage from "./pages/EvaluationPage";
import PartitionPage from "./pages/PartitionPage";
import logo from "./pages/assets/infraspexlogo.png";
import InspectionFormPage from "./pages/InspectionFormPage";




export default function App() {
  const projectsApi = useProjects();

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <img src={logo} alt="InfraspeX Logo" className="logo" />
            <h1>InfraspeX</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/projects"
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            <Folder size={18} strokeWidth={2} />
            <span>Projects</span>
          </NavLink>

          {/* <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            <LayoutDashboard size={18}/> 
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            <MessageSquareWarning size={18}/> 
            <span>Reports</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            <Settings size={18}/> 
            <span>Settings</span>
          </NavLink> */}
        </nav>
      </aside>

      {/* Main area */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />

          <Route path="/projects" element={<ProjectsPage projectsApi={projectsApi} />} />
          <Route path="/projects/new" element={<NewProjectPage projectsApi={projectsApi} />} />

          <Route path="/dashboard" element={<DashboardPage projectsApi={projectsApi} />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="/projects/:projectId" element={<ProjectPage projectsApi={projectsApi} />} />

          <Route path="/projects/:projectId/chainage/:chainageId" element={<ChainagePage />} />

          <Route path="/projects/:projectId/chainage/:chainageId/segment/:segmentId"element={<SegmentPage />} /> 
          
          <Route path="/projects/:projectId/chainage/:chainageId/segment/:segmentId/subsegment/:subsegmentId" element={<SubsegmentPage />} />

          <Route path="/review" element={<ReviewPage />} />

          <Route path="/evaluate" element={<EvaluationPage />} />

          <Route
            path="/projects/:projectId/chainage/:chainageId/segment/:segmentId/subsegment/:subsegmentId/partition/:partitionId"
            element={<PartitionPage />}
          />

          <Route
            path="/projects/:projectId/chainage/:chainageId/segment/:segmentId/inspection"
            element={<InspectionFormPage />}
          />


          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </main>
    </div>
  );
}