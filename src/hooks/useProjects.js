import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";  // ✅ Use the wrapper instead of window.api

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await api.listProjects();  // ✅ Use api instead of window.api
      setProjects(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("listProjects error:", e);
      setError(e?.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const total = projects.length;
  
  const addProject = useCallback(
    async (projectData) => {
      // Handle both old string format and new object format for backwards compatibility
      let data;
      
      if (typeof projectData === 'string') {
        // Legacy: just a name string
        const trimmed = projectData.trim();
        if (!trimmed) return null;
        data = { name: trimmed };
      } else if (typeof projectData === 'object' && projectData !== null) {
        // New: full project data object
        if (!projectData.name || !projectData.name.trim()) {
          throw new Error("Project name is required");
        }
        data = projectData;
      } else {
        throw new Error("Invalid project data");
      }

      setError("");
      try {
        const created = await api.createProject(data);  // ✅ Use api instead of window.api
        // refresh list so UI shows new project
        await refresh();
        return created;
      } catch (e) {
        console.error("createProject error:", e);
        setError(e?.message || "Failed to create project.");
        throw e;
      }
    },
    [refresh]
  );

  const deleteProject = useCallback(
    async (id) => {
      setError("");
      try {
        await api.deleteProject(id);  // ✅ Use api instead of window.api
        await refresh();
      } catch (e) {
        console.error("deleteProject error:", e);
        setError(e?.message || "Failed to delete project.");
        throw e;
      }
    },
    [refresh]
  );

  return useMemo(
    () => ({
      projects,
      total,
      loading,
      error,
      refresh,
      addProject,
      deleteProject,
    }),
    [projects, total, loading, error, refresh, addProject, deleteProject]
  );
}