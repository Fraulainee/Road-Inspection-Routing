import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RefreshCcw } from 'lucide-react';


// Helpers (safe for web + electron)
function isElectron() {
  return typeof window !== "undefined" && !!window.api;
}

function fmtNow() {
  return new Date()
    .toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

function fmtCreated(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-US");
}

export default function ChainagePage() {
  const { projectId, chainageId } = useParams();
  const navigate = useNavigate();

  const [selectedRowId, setSelectedRowId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [chainageName, setChainageName] = useState("");
  const [projectName, setProjectName] = useState("");

  // Local fallback / initial sample
  const sampleSegments = useMemo(
    () => [
      {
        id: 1,
        segmentId: "K1512-01",
        segmentStart: "K1512 + (000)",
        segmentEnd: "K1512 + (135)",
        segment: "K1512 + (000)  +  K1512 + (135)",
        length: 135,
        created: "1/2/2025 08:00:00",
      },
      {
        id: 2,
        segmentId: "K1512-02",
        segmentStart: "K1512 + (135)",
        segmentEnd: "K1513 + (000)",
        segment: "K1512 + (135)  +  K1513 + (000)",
        length: 865,
        created: "1/2/2025 08:00:00",
      },
    ],
    []
  );

  const [segments, setSegments] = useState(sampleSegments);

  const [showNewSegmentModal, setShowNewSegmentModal] = useState(false);
  const [newSeg, setNewSeg] = useState({
    segmentId: "",
    segmentSubName: "",
    segmentStart: "",
    segmentEnd: "",
    length: "",
  });
  const [creating, setCreating] = useState(false);

  const [editSeg, setEditSeg] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  function openEditSeg(s) {
    setEditSeg({
      id: s.id,
      segmentStart: s.segmentStart || "",
      segmentEnd: s.segmentEnd || "",
      length_m: s.length_m ?? "",
    });
  }
  function closeEditSeg() { setEditSeg(null); setEditSaving(false); }

  async function handleSaveSeg() {
    if (!editSeg.segmentStart.trim() || !editSeg.segmentEnd.trim()) {
      alert("Segment Start and End are required.");
      return;
    }
    setEditSaving(true);
    try {
      await window.api.updateSegment({
        id: editSeg.id,
        segmentStart: editSeg.segmentStart.trim(),
        segmentEnd: editSeg.segmentEnd.trim(),
        length_m: editSeg.length_m ? Number(editSeg.length_m) : null,
      });
      closeEditSeg();
      await refreshSegments();
    } catch (e) {
      alert(e?.message || "Failed to update segment.");
    } finally {
      setEditSaving(false);
    }
  }

  // ---- Backend actions (Electron) ----
  async function refreshSegments() {
    setError("");

    // If not Electron, just keep local data
    if (!isElectron()) return;

    setLoading(true);
    try {
      // Load project name
      const projects = await window.api.listProjects();
      const foundProject = projects.find((p) => String(p.id) === String(projectId));
      if (foundProject) setProjectName(foundProject.name);

      // Load the real chainage name
      const chainages = await window.api.listChainages(Number(projectId));
      const found = chainages.find((c) => String(c.id) === String(chainageId));
      if (found) setChainageName(found.name);

      const data = await window.api.listSegments(Number(chainageId));
      setSegments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading segments:", e);
      setError(e?.message || "Failed to load segments from desktop backend.");

      // Keep showing local/sample segments so UI isn't empty
      setSegments((prev) => (prev?.length ? prev : sampleSegments));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chainageId]);

  function handleEnterSegment(id) {
    navigate(`/projects/${projectId}/chainage/${chainageId}/segment/${id}`);
  }

  // Open segment folder
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

  async function handleDeleteSegment(id) {
    const ok = confirm("Delete this segment?");
    if (!ok) return;

    // Web fallback: local delete
    if (!isElectron()) {
      setSegments((prev) => prev.filter((s) => s.id !== id));
      if (selectedRowId === id) setSelectedRowId(null);
      return;
    }

    try {
      await window.api.deleteSegment(id);
      if (selectedRowId === id) setSelectedRowId(null);
      await refreshSegments();
    } catch (e) {
      console.error("Delete failed:", e);
      alert(e?.message || "Failed to delete segment.");
    }
  }

  async function handleCreateSegment() {
    const segmentIdText = newSeg.segmentId.trim();
    const start = newSeg.segmentStart.trim();
    const end = newSeg.segmentEnd.trim();
    const lengthNum = Number(newSeg.length);

    if (!segmentIdText || !start || !end || !Number.isFinite(lengthNum)) {
      alert("Please fill up Segment ID, Start, End, and a valid Length.");
      return;
    }

    const created = fmtNow();
    const segmentSubNameText = newSeg.segmentSubName.trim();
    const row = {
      segmentId: segmentIdText,
      segmentSubName: segmentSubNameText,
      segmentStart: start,
      segmentEnd: end,
      segment: `${start}  +  ${end}`,
      length: lengthNum,
      created,
    };

    // Web fallback: local create
    if (!isElectron()) {
      setSegments((prev) => [
        ...prev,
        {
          id: prev.length ? Math.max(...prev.map((x) => x.id)) + 1 : 1,
          ...row,
        },
      ]);
      setNewSeg({ segmentId: "", segmentSubName: "", segmentStart: "", segmentEnd: "", length: "" });
      setShowNewSegmentModal(false);
      return;
    }

    setCreating(true);
    try {
      await window.api.createSegment({
        chainageId: Number(chainageId),
        name: segmentIdText,
        segmentSubName: segmentSubNameText,
        segmentStart: start,
        segmentEnd: end,
        length_m: lengthNum
      });
      setNewSeg({ segmentId: "", segmentSubName: "", segmentStart: "", segmentEnd: "", length: "" });
      setShowNewSegmentModal(false);
      await refreshSegments();
    } catch (e) {
      console.error("Create failed:", e);
      alert(e?.message || "Failed to create segment.");
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    if (creating) return;
    setShowNewSegmentModal(false);
    setNewSeg({ segmentId: "", segmentSubName: "", segmentStart: "", segmentEnd: "", length: "" });
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
          </div>

          <div className="stats-pills">
            <span className="stat-pill">Segments: {segments.length}</span>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate(`/projects/${projectId}`)}>
            Back to Chainage
          </button>

          <button className="btn-secondary" onClick={refreshSegments} disabled={loading}>
            {loading ? "Refreshing..." : <RefreshCcw size={18} />} Refresh
          </button>

          <button className="btn-new-project" onClick={() => setShowNewSegmentModal(true)}>
            + New Segment
          </button>
        </div>
      </header>

      <div className="content">
        {error && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Backend error</h4>
            <div style={{ color: "var(--light-gray)", lineHeight: 1.4 }}>
              {error}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={refreshSegments} disabled={loading}>
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
                <th>Segment Name</th>
                <th>Segment</th>
                <th>Segment (Start)</th>
                <th>Segment (End)</th>
                <th>Segment Length (m)</th>
                <th>File Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 18 }}>
                    Loading segments...
                  </td>
                </tr>
              ) : segments.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 18 }}>
                    No segments yet. Click "+ New Segment".
                  </td>
                </tr>
              ) : (
                segments.map((s, index) => (
                  <tr
                    key={s.id}
                    className={selectedRowId === s.id ? "row-selected" : ""}
                    onClick={() => setSelectedRowId(s.id)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>{s.name || ""}</span>
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
                    <td>{s.segmentSubName || "—"}</td>
                    <td>{s.segmentStart}</td>
                    <td>{s.segmentEnd}</td>
                    <td>{s.length_m}</td>
                    <td>{fmtCreated(s.created || s.created_at)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-enter"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnterSegment(s.id);
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
                          className="btn-enter"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/projects/${projectId}/chainage/${chainageId}/segment/${s.id}/inspection`,
                              {
                                state: {
                                  segmentStart: s.segmentStart,
                                  segmentEnd: s.segmentEnd,
                                  segmentLength: s.length_m,
                                },
                              }
                            );
                          }}
                        >
                          Enter Form
                        </button>

                        <button
                          className="btn-edit"
                          onClick={(e) => { e.stopPropagation(); openEditSeg(s); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSegment(s.id);
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

      {/* Edit Segment Modal */}
      {editSeg && (
        <div className="modal-overlay" onClick={closeEditSeg}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Segment</h3>

            <div className="modal-field">
              <label>Segment Start</label>
              <input
                type="text"
                placeholder="e.g., K1512 + (000)"
                value={editSeg.segmentStart}
                onChange={(e) => setEditSeg((p) => ({ ...p, segmentStart: e.target.value.toUpperCase() }))}
                disabled={editSaving}
                autoFocus
              />
            </div>
            <div className="modal-field">
              <label>Segment End</label>
              <input
                type="text"
                placeholder="e.g., K1512 + (135)"
                value={editSeg.segmentEnd}
                onChange={(e) => setEditSeg((p) => ({ ...p, segmentEnd: e.target.value.toUpperCase() }))}
                disabled={editSaving}
              />
            </div>
            <div className="modal-field">
              <label>Segment Length (m)</label>
              <input
                type="number"
                placeholder="0"
                value={editSeg.length_m}
                onChange={(e) => setEditSeg((p) => ({ ...p, length_m: e.target.value }))}
                disabled={editSaving}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={closeEditSeg} disabled={editSaving}>
                Cancel
              </button>
              <button className="btn-modal-confirm" onClick={handleSaveSeg} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '12px 0' }} />
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              Station format: <strong>K[km] + ([m])</strong> — e.g., <strong>K1512 + (000)</strong>
            </p>
          </div>
        </div>
      )}

      {/* New Segment Modal */}
      {showNewSegmentModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Segment</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              A folder will be created inside the chainage folder
            </p>

            <div className="modal-field">
              <label>Segment Name</label>
              <input
                type="text"
                placeholder="e.g., K1512-03"
                value={newSeg.segmentId}
                onChange={(e) => setNewSeg((p) => ({ ...p, segmentId: e.target.value.toUpperCase() }))}
                disabled={creating}
                autoFocus
              />
            </div>
            <div className="modal-field">
              <label>Segment Sub Name</label>
              <input
                type="text"
                placeholder="e.g., K1512 + (000) + K1512 + (135)"
                value={newSeg.segmentSubName}
                onChange={(e) => setNewSeg((p) => ({ ...p, segmentSubName: e.target.value.toUpperCase() }))}
                disabled={creating}
              />
            </div>
            <div className="modal-field">
              <label>Start Station</label>
              <input
                type="text"
                placeholder="e.g., K1512 + (000)"
                value={newSeg.segmentStart}
                onChange={(e) => setNewSeg((p) => ({ ...p, segmentStart: e.target.value.toUpperCase() }))}
                disabled={creating}
              />
            </div>
            <div className="modal-field">
              <label>End Station</label>
              <input
                type="text"
                placeholder="e.g., K1512 + (135)"
                value={newSeg.segmentEnd}
                onChange={(e) => setNewSeg((p) => ({ ...p, segmentEnd: e.target.value.toUpperCase() }))}
                disabled={creating}
              />
            </div>
            <div className="modal-field">
              <label>Segment Length (m)</label>
              <input
                type="number"
                placeholder="e.g., 135"
                value={newSeg.length}
                onChange={(e) => setNewSeg((p) => ({ ...p, length: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSegment()}
                disabled={creating}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeModal} disabled={creating}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateSegment} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '12px 0' }} />
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              Segment Name: <strong>K[km]-[seq]</strong> (e.g., <strong>K1512-03</strong>) <br /> Segment Sub Name: Start <strong>K[km] + ([m]) + </strong> End <strong>K[km] + ([m])</strong> (e.g., <strong>K1512 + (000) + K1512 + (135))</strong> <br /> Station format: <strong>K[km] + ([m])</strong> (e.g., <strong>K1512 + (000)</strong>)
            </p>
          </div>
        </div>
      )}
    </>
  );
}