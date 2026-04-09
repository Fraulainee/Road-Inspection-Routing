import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, isElectron } from "../api/client";
import { RefreshCcw } from 'lucide-react';


export default function ProjectPage({ projectsApi }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects } = projectsApi;
  const [selectedRowId, setSelectedRowId] = useState(null);

  const [chainages, setChainages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showNewChainageModal, setShowNewChainageModal] = useState(false);
  const [newChainageName, setNewChainageName] = useState("");
  const [creating, setCreating] = useState(false);

  const project = useMemo(
    () => projects.find((p) => String(p.id) === String(projectId)),
    [projects, projectId]
  );

  // Load chainages when component mounts
  async function refreshChainages() {
    setLoading(true);
    setError("");
    try {
      const data = await api.listChainages(projectId);
      setChainages(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading chainages:", e);
      setError(e?.message || "Failed to load chainages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshChainages();
  }, [projectId]);

  async function handleDeleteChainage(id) {
    const ok = confirm("Delete this chainage?");
    if (!ok) return;

    try {
      await api.deleteChainage(id);
      if (selectedRowId === id) setSelectedRowId(null);
      await refreshChainages();
    } catch (e) {
      console.error("Error deleting chainage:", e);
      alert(e?.message || "Failed to delete chainage.");
    }
  }

  function handleEnterChainage(chainageId) {
    navigate(`/projects/${projectId}/chainage/${chainageId}`);
  }

  async function handleCreateChainage() {
    const name = newChainageName.trim();
    if (!name) {
      alert("Please enter a chainage name");
      return;
    }

    setCreating(true);
    try {
      const chainageData = {
        projectId: parseInt(projectId),
        name: name,
      };

      const created = await api.createChainage(chainageData);
      console.log("Chainage created:", created);

      setNewChainageName("");
      setShowNewChainageModal(false);
      await refreshChainages();
    } catch (e) {
      console.error("Error creating chainage:", e);
      alert(e?.message || "Failed to create chainage.");
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    if (creating) return;
    setShowNewChainageModal(false);
    setNewChainageName("");
  }

  async function handleOpenFolder(folderPath) {
    if (!isElectron()) {
      alert("Opening folders is only available in the desktop app");
      return;
    }

    try {
      const result = await window.api.openProjectFolder(folderPath);
      if (result && !result.ok) alert("Failed to open folder: " + result.error);
    } catch (err) { console.error("Error opening folder:", err); }
  }

  function fmtCreated(v) {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h2>
            <span className="project-label">Project</span>{" "}
            <span className="project-title">{project?.name || `#${projectId}`}</span>
          </h2>
          <div className="stats-pills">
            <span className="stat-pill">Chainages: {chainages.length}</span>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate("/projects")}>
            Back to Projects
          </button>
          <button className="btn-secondary" onClick={refreshChainages} disabled={loading}>
            {loading ? "Refreshing..." : <RefreshCcw size={18} />}
            Refresh
          </button>
          <button className="btn-new-project" onClick={() => setShowNewChainageModal(true)}>
            + New Chainage
          </button>
        </div>
      </header>

      <div className="content">
        {error && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Error</h4>
            <div style={{ color: "var(--light-gray)" }}>{error}</div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={refreshChainages}>
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="projects-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Main Chainage</th>
                <th>File Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 18 }}>
                    Loading chainages...
                  </td>
                </tr>
              ) : chainages.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 18 }}>
                    No chainages yet. Click "+ New Chainage" to add one.
                  </td>
                </tr>
              ) : (
                chainages.map((c, index) => (
                  <tr
                    key={c.id}
                    className={selectedRowId === c.id ? "row-selected" : ""}
                    onClick={() => setSelectedRowId(c.id)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>{c.name}</span>
                        {/* {c.folder_path && isElectron() && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--light-gray)',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFolder(c.folder_path);
                            }}
                          >
                            📁 {c.folder_path}
                          </span>
                        )} */}
                      </div>
                    </td>
                    <td>{fmtCreated(c.created_at || c.created)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-enter"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnterChainage(c.id);
                          }}
                        >
                          Enter
                        </button>
                        {c.folder_path && isElectron() && (
                          <button
                            className="btn-folder"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFolder(c.folder_path);
                            }}
                            title="Open folder"
                          >
                            📁 Open
                          </button>
                        )}
                        <button
                          className="btn-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChainage(c.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Chainage Modal */}
      {showNewChainageModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Chainage</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              A folder will be created inside the project folder
            </p>
            <input
              type="text"
              placeholder="Enter chainage name (e.g., K1512)..."
              value={newChainageName}
              onChange={(e) => setNewChainageName(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleCreateChainage()}
              autoFocus
              disabled={creating}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeModal} disabled={creating}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateChainage} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '12px 0' }} />
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              Format: <strong>K</strong> followed by the kilometer number (e.g., <strong>K1512</strong>, <strong>K200</strong>)
            </p>
          </div>
        </div>
      )}
    </>
  );
}