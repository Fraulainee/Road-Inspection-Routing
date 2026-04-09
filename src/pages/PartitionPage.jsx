import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Edit2, Save, X } from "lucide-react";


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

// IMPORTANT: don’t treat 0 as empty
function displayValue(v, fallback = "—") {
  return v ?? fallback; // only falls back for null/undefined
}

// Optional: pretty numeric display (keeps 0, shows 1.000)
function fmtNum(v, decimals = 3) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(decimals);
}

export default function PartitionPage() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { projectId, chainageId, segmentId, subsegmentId, partitionId } = useParams();

  const [partition, setPartition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  async function loadPartition() {
    setError("");

    if (state?.partition) {
      setPartition(state.partition);
      return;
    }

    if (!isElectron()) {
      setError("Partition data not available in web mode");
      return;
    }

    setLoading(true);
    try {
      const allPartitions = await window.api.listPartitions(Number(subsegmentId));
      const found = allPartitions.find((p) => String(p.id) === String(partitionId));

      if (found) setPartition(found);
      else setError("Partition not found");
    } catch (e) {
      console.error("Error loading partition:", e);
      setError(e?.message || "Failed to load partition.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPartition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partitionId, subsegmentId]);

  function handleEdit() {
    setEditData({
      start_m: partition.start_m ?? "",
      end_m: partition.end_m ?? "",
      partition_m: partition.partition_m ?? "",
      distress_no: partition.distress_no ?? "",
      lane_no: partition.lane_no ?? "",
      item: partition.item ?? "",
      length_m: partition.length_m ?? "",
      width_m: partition.width_m ?? "",
      depth_mm: partition.depth_mm ?? "",
      area_m2: partition.area_m2 ?? "",
      severity: partition.severity ?? "",
      joint: partition.joint ?? "",
      image_folder: partition.image_folder ?? "",
      ai_folder: partition.ai_folder ?? "",
    });
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditData({});
  }

  async function handleSave() {
    if (!isElectron()) {
      alert("Editing is only available in the desktop app");
      return;
    }

    if (Number(editData.partition_m) <= 0) {
      alert("Partition distance cannot be zero or negative. End distance must be greater than start distance.");
      return;
    }
    if (Number(editData.partition_m) > 5) {
      alert("Partition distance (end − start) cannot exceed 5 m. Please re-enter the distances.");
      return;
    }

    setSaving(true);
    try {
      const updated = await window.api.updatePartition({
        id: partition.id,
        ...editData,
      });

      setPartition(updated);
      setIsEditing(false);
      setEditData({});
      alert("Partition updated successfully!");
    } catch (e) {
      console.error("Save failed:", e);
      alert(e?.message || "Failed to save partition.");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenFolder(folderPath) {
    if (!isElectron()) {
      alert("Opening folders is only available in the desktop app");
      return;
    }
    if (!folderPath) {
      alert("No folder path available");
      return;
    }

    try {
      const result = await window.api.openProjectFolder(folderPath);
      if (result && !result.ok) {
        alert("Failed to open folder: " + result.error);
      }
    } catch (err) {
      console.error("Error opening folder:", err);
    }
  }

  async function browseImageFolder() {
    if (!isElectron()) {
      alert("Folder selection is only available in the desktop app");
      return;
    }
    const selected = await window.api.selectImageFolder();
    if (selected) setEditData((prev) => ({ ...prev, image_folder: selected }));
  }

  async function browseAiFolder() {
    if (!isElectron()) {
      alert("Folder selection is only available in the desktop app");
      return;
    }
    const selected = await window.api.selectOutputFolder();
    if (selected) setEditData((prev) => ({ ...prev, ai_folder: selected }));
  }

  function goToReview() {
    nav("/review", {
      state: {
        imageFolder: partition?.image_folder || state?.imageFolder || "",
        aiFolder: partition?.ai_folder || state?.aiFolder || "",
        partitionFolder: partition?.folder_path || "",
        partitionId: partition?.id,
        partitionNo: partition?.partition_no ?? "",
        subsegmentId,
        segmentId,
        chainageId,
        projectId,
        pavementType: state?.pavementType || "",
      },
    });
  }

  if (loading) {
    return (
      <>
        <header className="header">
          <div className="header-left">
            <h2>Partition</h2>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => nav(-1)}>
              Back
            </button>
          </div>
        </header>
        <div className="content">
          <div className="white-card">
            <p>Loading partition data...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !partition) {
    return (
      <>
        <header className="header">
          <div className="header-left">
            <h2>Partition</h2>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => nav(-1)}>
              Back
            </button>
          </div>
        </header>
        <div className="content">
          <div className="white-card">
            <h3 style={{ marginBottom: 10 }}>{error || "No partition data found"}</h3>
            <p style={{ color: "#333", marginBottom: 16 }}>
              {error ? error : "Unable to load partition data."}
            </p>
            <button className="btn-primary" onClick={loadPartition}>
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h2>
            <span className="project-label">Partition</span>{" "}
            <span className="project-title">{displayValue(partition.partition_no, "—")}</span>
          </h2>

          <div className="stats-pills">
            <span className="stat-pill">Subsegment {subsegmentId}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              if (isEditing) {
                setIsEditing(false);   
              } else {
                nav(`/projects/${projectId}/chainage/${chainageId}/segment/${segmentId}/subsegment/${subsegmentId}`);
              }
            }}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          {!isEditing && (
            <button className="btn-secondary" onClick={handleEdit}>
              <Edit2 size={18} />
              Edit
            </button>
          )}

          <button className="btn-primary" onClick={goToReview}>
            <ImageIcon size={18} />
            Open Review
          </button>
        </div>
      </header>

      <div className="content partition-wrap">
        <div className="white-card">
          <div className="white-card-head">
            <div>
              <h3 className="white-title">Partition Details</h3>
              <p className="white-subtitle">
                {isEditing ? "Edit partition information" : "View partition information"}
              </p>
            </div>

            <div className="white-badges">
              <span className="badge">Created: {fmtCreated(partition.created_at)}</span>
              <span className="badge">Partition No: {displayValue(partition.partition_no, "—")}</span>
            </div>
          </div>

          {isEditing ? (
            <div className="edit-form">
              <div className="edit-grid">
                <div className="edit-item">
                  <label>Start Distance (m)</label>
                  <input
                    type="number"
                    value={editData.start_m}
                    onChange={(e) => {
                      const start = e.target.value;
                      const dist = editData.end_m !== "" && start !== ""
                        ? parseFloat((Number(editData.end_m) - Number(start)).toFixed(4))
                        : "";
                      setEditData({ ...editData, start_m: start, partition_m: dist });
                    }}
                  />
                </div>

                <div className="edit-item">
                  <label>End Distance (m)</label>
                  <input
                    type="number"
                    value={editData.end_m}
                    onChange={(e) => {
                      const end = e.target.value;
                      const dist = editData.start_m !== "" && end !== ""
                        ? parseFloat((Number(end) - Number(editData.start_m)).toFixed(4))
                        : "";
                      setEditData({ ...editData, end_m: end, partition_m: dist });
                    }}
                  />
                </div>

                <div className="edit-item">
                  <label>Partition Distance (m) — auto calculated</label>
                  <input
                    type="number"
                    value={editData.partition_m}
                    readOnly
                    disabled
                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                  />
                  {editData.partition_m !== "" && Number(editData.partition_m) <= 0 && (
                    <p style={{ color: '#e53e3e', fontSize: '13px', marginTop: '6px', fontWeight: 600 }}>
                      Partition distance cannot be zero or negative. End distance must be greater than start distance.
                    </p>
                  )}
                  {editData.partition_m !== "" && Number(editData.partition_m) > 5 && (
                    <p style={{ color: '#e53e3e', fontSize: '13px', marginTop: '6px', fontWeight: 600 }}>
                      Partition distance exceeds 5 m. Please re-enter the start and end distance.
                    </p>
                  )}
                </div>

              </div>

              <div className="folder-section">
                <h4>Folders</h4>

                <div className="folder-input-group">
                  <label>Image Folder</label>
                  <div className="folder-row">
                    <input
                      type="text"
                      value={editData.image_folder}
                      onChange={(e) => setEditData({ ...editData, image_folder: e.target.value })}
                      placeholder="No folder selected"
                    />
                    <button className="btn-secondary" onClick={browseImageFolder}>
                      Browse
                    </button>
                  </div>
                </div>

                <div className="folder-input-group">
                  <label>AI Output Folder</label>
                  <div className="folder-row">
                    <input
                      type="text"
                      value={editData.ai_folder}
                      onChange={(e) => setEditData({ ...editData, ai_folder: e.target.value })}
                      placeholder="No folder selected"
                    />
                    <button className="btn-secondary" onClick={browseAiFolder}>
                      Browse
                    </button>
                  </div>
                </div>
              </div>

              <div className="white-actions">
                <button className="btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                  <X size={18} />
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving || Number(editData.partition_m) > 5 || Number(editData.partition_m) <= 0}
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">Partition No.</div>
                  <div className="detail-value">{displayValue(partition.partition_no)}</div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Start Distance (m)</div>
                  <div className="detail-value">{fmtNum(partition.start_m)}</div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">End Distance (m)</div>
                  <div className="detail-value">{fmtNum(partition.end_m)}</div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">Partition Distance (m)</div>
                  <div className="detail-value">{fmtNum(partition.partition_m)}</div>
                </div>

                <div className="detail-item span-2">
                  <div className="detail-label">Partition Folder</div>
                  <div className="detail-value">
                    {partition.folder_path ? (
                      <span
                        className="path-link"
                        style={{ cursor: "pointer", color: "#FCA311", textDecoration: "underline" }}
                        onClick={() => handleOpenFolder(partition.folder_path)}
                      >
                        📁 {partition.folder_path}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div className="detail-item span-2">
                  <div className="detail-label">Image Folder</div>
                  <div className="detail-value">
                    {partition.image_folder ? (
                      <span
                        className="path-link"
                        style={{ cursor: "pointer", color: "#FCA311", textDecoration: "underline" }}
                        onClick={() => handleOpenFolder(partition.image_folder)}
                      >
                        📁 {partition.image_folder}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div className="detail-item span-2">
                  <div className="detail-label">AI Output Folder</div>
                  <div className="detail-value">
                    {partition.ai_folder ? (
                      <span
                        className="path-link"
                        style={{ cursor: "pointer", color: "#FCA311", textDecoration: "underline" }}
                        onClick={() => handleOpenFolder(partition.ai_folder)}
                      >
                        📁 {partition.ai_folder}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              {/* <div className="white-actions">
                <button className="btn-secondary" onClick={() => nav(-1)}>
                  <ArrowLeft size={18} />
                  Back to Partition
                </button>

                <button className="btn-secondary" onClick={handleEdit}>
                  <Edit2 size={18} />
                  Edit Details
                </button>

                <button className="btn-primary" onClick={goToReview}>
                  <ImageIcon size={18} />
                  Go to Review
                </button>
              </div> */}
            </>
          )}
        </div>
      </div>
    </>
  );
}