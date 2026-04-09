import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RefreshCcw } from 'lucide-react';


// Helpers
function isElectron() {
  return typeof window !== "undefined" && !!window.api;
}

function fmtCreated(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-US");
}

export default function SegmentPage() {
  const { projectId, chainageId, segmentId } = useParams();
  const navigate = useNavigate();
  const [selectedRowId, setSelectedRowId] = useState(null);

  const [subsegments, setSubsegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [projectName, setProjectName] = useState("");
  const [chainageName, setChainageName] = useState("");
  const [segmentName, setSegmentName] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState({ 
    length: "", 
    lanes: "", 
    pavement: "Asphalt" 
  });
  const [creating, setCreating] = useState(false);

  const [editSub, setEditSub] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  function openEditSub(s) {
    setEditSub({
      id: s.id,
      length: s.subsegment_length_m ?? "",
      lanes: s.lanes ?? "",
      pavement: s.pavement_type || "Asphalt",
    });
  }
  function closeEditSub() { setEditSub(null); setEditSaving(false); }

  async function handleSaveSub() {
    const lengthNum = Number(editSub.length);
    const lanesNum = Number(editSub.lanes);
    if (!Number.isFinite(lengthNum) || lengthNum <= 0) { alert("Please enter a valid length."); return; }
    if (!Number.isFinite(lanesNum) || lanesNum <= 0) { alert("Please enter a valid number of lanes."); return; }
    setEditSaving(true);
    try {
      await window.api.updateSubsegment({
        id: editSub.id,
        subsegment_length_m: lengthNum,
        lanes: lanesNum,
        pavement_type: editSub.pavement,
      });
      closeEditSub();
      await refreshSubsegments();
    } catch (e) {
      alert(e?.message || "Failed to update subsegment.");
    } finally {
      setEditSaving(false);
    }
  }


  // Load subsegments
  async function refreshSubsegments() {
    setError("");

    if (!isElectron()) {
      // Web fallback - show sample data
      setSubsegments([
        { id: 1, subsegment_no: 1, subsegment_length_m: 312, lanes: 4, pavement_type: "Asphalt", created_at: new Date() },
        { id: 2, subsegment_no: 2, subsegment_length_m: 273, lanes: 4, pavement_type: "Asphalt", created_at: new Date() },
      ]);
      return;
    }

    setLoading(true);
    try {
      const projects = await window.api.listProjects();
      const foundProject = projects.find((p) => String(p.id) === String(projectId));
      if (foundProject) setProjectName(foundProject.name);

      const chainages = await window.api.listChainages(Number(projectId));
      const foundChainage = chainages.find((c) => String(c.id) === String(chainageId));
      if (foundChainage) setChainageName(foundChainage.name);

      const segments = await window.api.listSegments(Number(chainageId));
      const foundSegment = segments.find((s) => String(s.id) === String(segmentId));
      if (foundSegment) setSegmentName(foundSegment.name);

      const data = await window.api.listSubsegments(Number(segmentId));
      setSubsegments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading subsegments:", e);
      setError(e?.message || "Failed to load subsegments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSubsegments();
  }, [segmentId]);

  // Open folder
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

  // Delete subsegment
  async function handleDelete(id) {
    const ok = confirm("Delete this subsegment?");
    if (!ok) return;

    if (!isElectron()) {
      setSubsegments((prev) => prev.filter((s) => s.id !== id));
      if (selectedRowId === id) setSelectedRowId(null);
      return;
    }

    try {
      await window.api.deleteSubsegment(id);
      if (selectedRowId === id) setSelectedRowId(null);
      await refreshSubsegments();
    } catch (e) {
      console.error("Delete failed:", e);
      alert(e?.message || "Failed to delete subsegment.");
    }
  }

  // Enter subsegment
  function handleEnter(id) {
    navigate(
      `/projects/${projectId}/chainage/${chainageId}/segment/${segmentId}/subsegment/${id}`
    );
  }

  // Create subsegment
  async function handleCreate() {
    const lengthNum = Number(draft.length);
    const lanesNum = Number(draft.lanes);
    const pavement = String(draft.pavement || "").trim();

    if (!Number.isFinite(lengthNum) || lengthNum <= 0) {
      alert("Please enter a valid subsegment length");
      return;
    }
    if (!Number.isFinite(lanesNum) || lanesNum <= 0) {
      alert("Please enter a valid number of lanes");
      return;
    }
    if (!pavement) {
      alert("Please select a pavement type");
      return;
    }

    // Web fallback
    if (!isElectron()) {
      const newId = subsegments.length ? Math.max(...subsegments.map((x) => x.id)) + 1 : 1;
      setSubsegments((prev) => [
        ...prev,
        {
          id: newId,
          subsegment_no: prev.length + 1,
          subsegment_length_m: lengthNum,
          lanes: lanesNum,
          pavement_type: pavement,
          created_at: new Date(),
        },
      ]);
      setDraft({ length: "", lanes: "", pavement: "Asphalt" });
      setShowModal(false);
      return;
    }

    setCreating(true);
    try {
      await window.api.createSubsegment({
        segmentId: Number(segmentId),
        subsegment_length_m: lengthNum,
        lanes: lanesNum,
        pavement_type: pavement,
      });

      setDraft({ length: "", lanes: "", pavement: "Asphalt" });
      setShowModal(false);
      await refreshSubsegments();
    } catch (e) {
      console.error("Create failed:", e);
      alert(e?.message || "Failed to create subsegment.");
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    if (creating) return;
    setShowModal(false);
    setDraft({ length: "", lanes: "", pavement: "Asphalt" });
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="header-breadcrumb">
            <span className="breadcrumb-item">
              <span className="breadcrumb-label">Project</span>
              <span className="breadcrumb-value">{projectName || `#${projectId}`}</span>
            </span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-item">
              <span className="breadcrumb-label">Chainage</span>
              <span className="breadcrumb-value">{chainageName || `#${chainageId}`}</span>
            </span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-item">
              <span className="breadcrumb-label">Segment</span>
              <span className="breadcrumb-value">{segmentName || `#${segmentId}`}</span>
            </span>
          </div>
          <div className="stats-pills">
            <span className="stat-pill">Subsegments: {subsegments.length}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate(`/projects/${projectId}/chainage/${chainageId}`)}
          >
            Back to Segment
          </button>

          <button className="btn-secondary" onClick={refreshSubsegments} disabled={loading}>
            {loading ? "Refreshing..." : <RefreshCcw size={18} />} Refresh
          </button>

          <button className="btn-new-project" onClick={() => setShowModal(true)}>
            + New Subsegment
          </button>
        </div>
      </header>

      <div className="content">
        {error && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Error</h4>
            <div style={{ color: "var(--light-gray)" }}>{error}</div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={refreshSubsegments}>
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="projects-table">
            <thead>
              <tr>
                <th>Subsegment No.</th>
                <th>Subsegment Length (m)</th>
                <th>No. of Lanes</th>
                <th>Pavement Type</th>
                <th>File Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 18 }}>
                    Loading subsegments...
                  </td>
                </tr>
              ) : subsegments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 18 }}>
                    No subsegments yet. Click "+ New Subsegment".
                  </td>
                </tr>
              ) : (
                subsegments.map((s) => (
                  <tr
                    key={s.id}
                    className={selectedRowId === s.id ? "row-selected" : ""}
                    onClick={() => setSelectedRowId(s.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>{s.subsegment_no}</span>
                        {/* ✅ Show folder path if available */}
                        {/* {s.folder_path && isElectron() && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--light-gray)',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFolder(s.folder_path);
                            }}
                          >
                            📁 {s.folder_path}
                          </span>
                        )} */}
                      </div>
                    </td>
                    <td>{s.subsegment_length_m}</td>
                    <td>{s.lanes}</td>
                    <td>{s.pavement_type}</td>
                    <td>{fmtCreated(s.created_at)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-enter"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnter(s.id);
                          }}
                        >
                          Enter
                        </button>

                        {/* ✅ Open Folder button */}
                        {s.folder_path && isElectron() && (
                          <button
                            className="btn-folder"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFolder(s.folder_path);
                            }}
                            title="Open folder"
                          >
                            📁 Open
                          </button>
                        )}

                        <button
                          className="btn-edit"
                          onClick={(e) => { e.stopPropagation(); openEditSub(s); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(s.id);
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

      {/* Edit Subsegment Modal */}
      {editSub && (
        <div className="modal-overlay" onClick={closeEditSub}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Subsegment</h3>

            <div className="modal-field">
              <label>Subsegment Length (m)</label>
              <input
                type="number"
                placeholder="e.g., 312"
                value={editSub.length}
                onChange={(e) => setEditSub((p) => ({ ...p, length: e.target.value }))}
                disabled={editSaving}
                autoFocus
              />
            </div>
            <div className="modal-field">
              <label>No. of Lanes</label>
              <input
                type="number"
                placeholder="e.g., 4"
                value={editSub.lanes}
                onChange={(e) => setEditSub((p) => ({ ...p, lanes: e.target.value }))}
                disabled={editSaving}
              />
            </div>
            <div className="modal-field">
              <label>Pavement Type</label>
              <select
                className="np-select"
                value={editSub.pavement}
                onChange={(e) => setEditSub((p) => ({ ...p, pavement: e.target.value }))}
                disabled={editSaving}
              >
                <option value="Asphalt">Asphalt</option>
                <option value="Concrete">Concrete</option>
                <option value="Gravel">Gravel</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={closeEditSub} disabled={editSaving}>
                Cancel
              </button>
              <button className="btn-modal-confirm" onClick={handleSaveSub} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '12px 0' }} />
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              Length in meters (m) | Lanes as a whole number (e.g., <strong>4</strong>)
            </p>
          </div>
        </div>
      )}

      {/* New Subsegment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Subsegment</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              A folder will be created inside the segment folder
            </p>

            <input
              type="number"
              placeholder="Subsegment Length (m)"
              value={draft.length}
              onChange={(e) => setDraft((p) => ({ ...p, length: e.target.value }))}
              autoFocus
              disabled={creating}
            />

            <input
              type="number"
              placeholder="No. of Lanes"
              value={draft.lanes}
              onChange={(e) => setDraft((p) => ({ ...p, lanes: e.target.value }))}
              disabled={creating}
            />

            <select
              className="np-select"
              value={draft.pavement}
              onChange={(e) => setDraft((p) => ({ ...p, pavement: e.target.value }))}
              disabled={creating}
            >
              <option value="Asphalt">Asphalt</option>
              <option value="Concrete">Concrete</option>
              <option value="Gravel">Gravel</option>
              <option value="Other">Other</option>
            </select>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeModal} disabled={creating}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '12px 0' }} />
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              Length in meters (m) | Lanes as a whole number (e.g., <strong>4</strong>)
            </p>
          </div>
        </div>
      )}
    </>
  );
}