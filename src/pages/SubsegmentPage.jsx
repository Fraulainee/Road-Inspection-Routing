import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RefreshCcw, ChevronRight, ChevronDown } from 'lucide-react';


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

function ScreenshotThumb({ path: filePath }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!filePath || !isElectron()) return;
    window.api.readFileBase64(filePath).then(setSrc).catch(() => {});
  }, [filePath]);

  if (!src) return <span>—</span>;
  return (
    <img
      src={src}
      alt="screenshot"
      onClick={() => isElectron() && window.api.openFile(filePath)}
      style={{ width: 180, height: 120, objectFit: "cover", borderRadius: 6, display: "block", cursor: "zoom-in" }}
      title="Click to open full image"
    />
  );
}

export default function SubsegmentPage() {
  const { projectId, chainageId, segmentId, subsegmentId } = useParams();
  const navigate = useNavigate();
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedDefectKey, setSelectedDefectKey] = useState(null);

  const tableWrapRef = useRef(null);
  const topScrollRef = useRef(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setTableScrollWidth(el.scrollWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function syncFromTop() {
    if (tableWrapRef.current && topScrollRef.current)
      tableWrapRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  }
  function syncFromBottom() {
    if (tableWrapRef.current && topScrollRef.current)
      topScrollRef.current.scrollLeft = tableWrapRef.current.scrollLeft;
  }

  const [pavementType, setPavementType] = useState("");
  const [partitions, setPartitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [projectName, setProjectName] = useState("");
  const [chainageName, setChainageName] = useState("");
  const [segmentName, setSegmentName] = useState("");
  const [subsegmentNo, setSubsegmentNo] = useState("");

  const [imageFolder, setImageFolder] = useState("");
  const [aiFolder, setAiFolder] = useState("");

  const [expandedPartitions, setExpandedPartitions] = useState(new Set());
  const [partitionDefects, setPartitionDefects] = useState({});

  async function handleDeleteDefect(defectId, partitionId) {
    const ok = confirm("Delete this evaluation?");
    if (!ok) return;
    if (!isElectron()) return;
    try {
      await window.api.deleteDefect(defectId);
      setPartitionDefects((prev) => ({
        ...prev,
        [partitionId]: (prev[partitionId] || []).filter((d) => d.id !== defectId),
      }));
    } catch (e) {
      alert(e?.message || "Failed to delete evaluation.");
    }
  }

  async function toggleExpand(partitionId) {
    setExpandedPartitions((prev) => {
      const next = new Set(prev);
      if (next.has(partitionId)) {
        next.delete(partitionId);
      } else {
        next.add(partitionId);
        if (!partitionDefects[partitionId] && isElectron()) {
          window.api.listDefects(partitionId).then((defects) => {
            setPartitionDefects((d) => ({ ...d, [partitionId]: defects || [] }));
          }).catch(() => {
            setPartitionDefects((d) => ({ ...d, [partitionId]: [] }));
          });
        }
      }
      return next;
    });
  }

  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState({
    partitionNo: "",
    start: "",
    end: "",
    partition: "",
  });
  const [creating, setCreating] = useState(false);

  // Load partitions
  async function refreshPartitions() {
    setError("");

    if (!isElectron()) {
      // Web fallback - sample data
      setPartitions([
        {
          id: 1,
          partition_no: 1,
          start_m: 0,
          end_m: 5,
          partition_m: 5,
          distress_no: 1,
          lane_no: 1,
          item: "Longitudinal Cracking",
          length_m: 0.75,
          width_m: 0.001,
          depth_mm: null,
          area_m2: null,
          severity: "Narrow",
          created_at: new Date(),
        },
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

      const subsegments = await window.api.listSubsegments(Number(segmentId));
      const foundSub = subsegments.find((s) => String(s.id) === String(subsegmentId));
      if (foundSub) setSubsegmentNo(foundSub.subsegment_no ?? subsegmentId);

      const data = await window.api.listPartitions(Number(subsegmentId));
      const list = Array.isArray(data) ? data : [];
      setPartitions(list);
      // Auto-expand all partitions and load their defects
      setExpandedPartitions(new Set(list.map((p) => p.id)));
      list.forEach((p) => {
        window.api.listDefects(p.id).then((defects) => {
          setPartitionDefects((d) => ({ ...d, [p.id]: defects || [] }));
        }).catch(() => {
          setPartitionDefects((d) => ({ ...d, [p.id]: [] }));
        });
      });
    } catch (e) {
      console.error("Error loading partitions:", e);
      setError(e?.message || "Failed to load partitions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshPartitions();
  }, [subsegmentId]);

  // Load the current subsegment's pavement_type
  useEffect(() => {
    if (!isElectron()) return;
    window.api.listSubsegments(Number(segmentId))
      .then((data) => {
        const sub = Array.isArray(data) ? data.find((s) => String(s.id) === String(subsegmentId)) : null;
        if (sub) setPavementType(sub.pavement_type || "");
      })
      .catch((e) => console.error("Failed to load subsegment info:", e));
  }, [segmentId, subsegmentId]);

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

  // Delete partition
  async function handleDelete(id) {
    const ok = confirm("Delete this partition?");
    if (!ok) return;

    if (!isElectron()) {
      setPartitions((prev) => prev.filter((p) => p.id !== id));
      if (selectedRowId === id) setSelectedRowId(null);
      return;
    }

    try {
      await window.api.deletePartition(id);
      if (selectedRowId === id) setSelectedRowId(null);
      await refreshPartitions();
    } catch (e) {
      console.error("Delete failed:", e);
      alert(e?.message || "Failed to delete partition.");
    }
  }

  // Enter partition
  function handleEnter(id) {
    const partition = partitions.find((p) => p.id === id);
    if (!partition) return;

    navigate(
      `/projects/${projectId}/chainage/${chainageId}/segment/${segmentId}/subsegment/${subsegmentId}/partition/${id}`,
      {
        state: {
          partition,
          imageFolder: partition.image_folder || imageFolder,
          aiFolder: partition.ai_folder || aiFolder,
          pavementType,
        },
      }
    );
  }

  // Create partitions 1 through N (batch)
  async function createPartition() {
    const count = Number(draft.partitionNo);
    const start = Number(draft.start);
    const end = Number(draft.end);
    const partitionDist = parseFloat((end - start).toFixed(4));

    if (!Number.isFinite(count) || count < 1 || !Number.isInteger(count)) {
      alert("Please enter a valid number of partitions (whole number ≥ 1)");
      return;
    }
    if (!Number.isFinite(start)) {
      alert("Please enter a valid start distance");
      return;
    }
    if (!Number.isFinite(end)) {
      alert("Please enter a valid end distance");
      return;
    }
    if (partitionDist <= 0) {
      alert("Partition distance cannot be zero or negative. End distance must be greater than start distance.");
      return;
    }
    if (partitionDist > 5) {
      alert("Partition distance (end − start) cannot exceed 5 m. Please re-enter the distances.");
      return;
    }

    // Web fallback
    if (!isElectron()) {
      const base = partitions.length ? Math.max(...partitions.map((x) => x.id)) + 1 : 1;
      const newRows = Array.from({ length: count }, (_, i) => ({
        id: base + i,
        partition_no: i + 1,
        start_m: start,
        end_m: end,
        partition_m: partitionDist,
        distress_no: null, lane_no: null, item: null,
        length_m: null, width_m: null, depth_mm: null,
        area_m2: null, severity: null,
        image_folder: imageFolder || null,
        ai_folder: aiFolder || null,
        created_at: new Date(),
      }));
      setPartitions((prev) => [...prev, ...newRows]);
      setDraft({ partitionNo: "", start: "", end: "", partition: "" });
      setShowModal(false);
      return;
    }

    setCreating(true);
    try {
      for (let i = 1; i <= count; i++) {
        await window.api.createPartition({
          subsegmentId: Number(subsegmentId),
          partition_no: i,
          start_m: start,
          end_m: end,
          partition_m: partitionDist,
          image_folder: imageFolder || null,
          ai_folder: aiFolder || null,
        });
      }
      setDraft({ partitionNo: "", start: "", end: "", partition: "" });
      setShowModal(false);
      await refreshPartitions();
    } catch (e) {
      console.error("Create failed:", e);
      alert(e?.message || "Failed to create partition.");
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    if (creating) return;
    setShowModal(false);
    setDraft({ partitionNo: "", start: "", end: "", partition: "" });
  }

  async function chooseImageFolder() {
    if (!isElectron()) {
      alert("Folder selection is only available in the desktop app");
      return;
    }
    const selected = await window.api.selectImageFolder();
    if (selected) setImageFolder(selected);
  }

  async function chooseAiFolder() {
    if (!isElectron()) {
      alert("Folder selection is only available in the desktop app");
      return;
    }
    const selected = await window.api.selectOutputFolder();
    if (selected) setAiFolder(selected);
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
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-item">
              <span className="breadcrumb-label">Subsegment</span>
              <span className="breadcrumb-value">{subsegmentNo || `#${subsegmentId}`}</span>
            </span>
          </div>
          <div className="stats-pills">
            <span className="stat-pill">Partitions: {partitions.length}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() =>
              navigate(`/projects/${projectId}/chainage/${chainageId}/segment/${segmentId}`)
            }
          >
            Back to Subsegment
          </button>

          <button className="btn-secondary" onClick={refreshPartitions} disabled={loading}>
            {loading ? "Refreshing..." : <RefreshCcw size={18} />}
            Refresh
          </button>

          <button className="btn-new-project" onClick={() => setShowModal(true)}>
            + New Partition
          </button>
        </div>
      </header>

      <div className="content">
        {error && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Error</h4>
            <div style={{ color: "var(--light-gray)" }}>{error}</div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={refreshPartitions}>
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="table-scroll-wrapper">
          {/* Sticky top scrollbar */}
          <div ref={topScrollRef} onScroll={syncFromTop} className="table-top-scrollbar">
            <div style={{ width: tableScrollWidth, height: 1 }} />
          </div>

          <div className="table-container" ref={tableWrapRef} onScroll={syncFromBottom} style={{ overflowX: "auto", borderRadius: "0 0 12px 12px" }}>
          <table className="projects-table">
            <thead>
              <tr>
                <th>Partition No.</th>
                <th>Start (m)</th>
                <th>End (m)</th>
                <th>Partition (m)</th>
                <th>Distress No.</th>
                <th>Lane No.</th>
                <th>Joint</th>
                <th>Item</th>
                <th>Length (m)</th>
                <th>Width (m)</th>
                <th>Depth (mm)</th>
                <th>Area (m²)</th>
                <th>Severity</th>
                <th>File Created</th>
                <th>Screenshot</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} style={{ padding: 18 }}>
                    Loading partitions...
                  </td>
                </tr>
              ) : partitions.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ padding: 18 }}>
                    No partitions yet. Click "+ New Partition".
                  </td>
                </tr>
              ) : (
                partitions.flatMap((r) => {
                  const isExpanded = expandedPartitions.has(r.id);
                  const defects = partitionDefects[r.id] || [];

                  const partitionRow = (
                    <tr
                      key={r.id}
                      className={selectedRowId === r.id ? "row-selected" : ""}
                      onClick={() => setSelectedRowId(r.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleExpand(r.id); }}
                            style={{ cursor: "pointer", color: "var(--accent)", display: "flex", alignItems: "center" }}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                          {r.partition_no}
                        </div>
                      </td>
                      <td>{r.start_m}</td>
                      <td>{r.end_m}</td>
                      <td>{r.partition_m}</td>
                      <td>{r.distress_no || ""}</td>
                      <td>{r.lane_no || ""}</td>
                      <td>{r.joint || ""}</td>
                      <td>{r.item || ""}</td>
                      <td>{r.length_m || ""}</td>
                      <td>{r.width_m || ""}</td>
                      <td>{r.depth_mm || "N/A"}</td>
                      <td>{r.area_m2 || ""}</td>
                      <td>{r.severity || ""}</td>
                      <td>{fmtCreated(r.created_at)}</td>
                      <td></td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-enter"
                            onClick={(e) => { e.stopPropagation(); handleEnter(r.id); }}
                          >
                            Enter
                          </button>
                          {r.folder_path && isElectron() && (
                            <button
                              className="btn-folder"
                              onClick={(e) => { e.stopPropagation(); handleOpenFolder(r.folder_path); }}
                              title="Open folder"
                            >
                              📁 Open
                            </button>
                          )}
                          <button
                            className="btn-delete"
                            onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );

                  if (!isExpanded) return [partitionRow];

                  const defectRows = defects.length === 0 ? [
                    <tr key={`${r.id}-empty`} className="partition-defect-empty-row">
                      <td colSpan={16}>No evaluations recorded for this partition.</td>
                    </tr>
                  ] : defects.map((d, idx) => (
                    <tr
                      key={`${r.id}-defect-${d.id}`}
                      className={`partition-defect-row${selectedDefectKey === `${r.id}-${d.id}` ? " defect-row-selected" : ""}`}
                      onClick={() => setSelectedDefectKey(prev => prev === `${r.id}-${d.id}` ? null : `${r.id}-${d.id}`)}
                    >
                      <td className="partition-defect-index">#{idx + 1}</td>
                      <td colSpan={3}></td>
                      <td>{/* distress no */}</td>
                      <td>{d.lane_no || "—"}</td>
                      <td>{d.joint || "—"}</td>
                      <td>{d.item || "—"}</td>
                      <td>{d.length_m ?? "—"}</td>
                      <td>{d.width_m ?? "—"}</td>
                      <td>{d.depth_mm ?? "—"}</td>
                      <td>{d.area_m2 ?? "—"}</td>
                      <td>{d.severity || "—"}</td>
                      <td>{d.remarks || "—"}</td>
                      <td><ScreenshotThumb path={d.screenshot_path} /></td>
                      <td>
                        <button
                          className="btn-delete"
                          onClick={(e) => { e.stopPropagation(); handleDeleteDefect(d.id, r.id); }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ));

                  return [partitionRow, ...defectRows];
                })
              )}
            </tbody>
          </table>
          </div>{/* table-container */}
        </div>{/* table-scroll-wrapper */}
      </div>{/* content */}

      {/* New Partition Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Partition</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              A folder will be created inside the subsegment folder
            </p>

            <div className="modal-field">
              <label>No. of Partitions</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="e.g., 3 → creates partitions 1, 2, 3"
                value={draft.partitionNo}
                onChange={(e) => {
                  const v = Math.floor(Math.abs(Number(e.target.value)));
                  setDraft((p) => ({ ...p, partitionNo: v || "" }));
                }}
                autoFocus
                disabled={creating}
              />
              <p className="modal-hint">Starts at 1 — entering 3 creates partitions 1, 2 and 3</p>
            </div>
            <div className="modal-field">
              <label>Start Distance (m)</label>
              <input
                type="number"
                placeholder="e.g., 0"
                value={draft.start}
                onChange={(e) => setDraft((p) => ({ ...p, start: e.target.value }))}
                disabled={creating}
              />
            </div>
            <div className="modal-field">
              <label>End Distance (m)</label>
              <input
                type="number"
                placeholder="e.g., 10"
                value={draft.end}
                onChange={(e) => setDraft((p) => ({ ...p, end: e.target.value }))}
                disabled={creating}
              />
            </div>
            <div className="modal-field">
              <label>Partition Distance (m) — auto calculated</label>
              <input
                className="modal-input-calculated"
                type="number"
                placeholder="—"
                value={
                  draft.end !== "" && draft.start !== ""
                    ? parseFloat((Number(draft.end) - Number(draft.start)).toFixed(4))
                    : ""
                }
                readOnly
                disabled
              />
            </div>
            {draft.end !== "" && draft.start !== "" && (Number(draft.end) - Number(draft.start)) <= 0 && (
              <p style={{ color: '#e53e3e', fontSize: '13px', marginTop: '6px', fontWeight: 600 }}>
                Partition distance cannot be zero or negative. End distance must be greater than start distance.
              </p>
            )}
            {draft.end !== "" && draft.start !== "" && (Number(draft.end) - Number(draft.start)) > 5 && (
              <p style={{ color: '#e53e3e', fontSize: '13px', marginTop: '6px', fontWeight: 600 }}>
                Partition distance exceeds 5 m. Please re-enter the start and end distance.
              </p>
            )}

            <hr className="modal-divider" />

            <div className="modal-section">
              <label className="modal-label">Target Image Folder</label>
              <div className="folder-row">
                <input
                  className="folder-input"
                  type="text"
                  value={imageFolder}
                  readOnly
                  placeholder="Select image folder..."
                />
                <button
                  type="button"
                  className="btn-secondary btn-browse"
                  onClick={chooseImageFolder}
                  disabled={creating}
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="modal-section">
              <label className="modal-label">Target AI Output Folder (Optional)</label>
              <div className="folder-row">
                <input
                  className="folder-input"
                  type="text"
                  value={aiFolder}
                  readOnly
                  placeholder="Select AI output folder..."
                />
                <button
                  type="button"
                  className="btn-secondary btn-browse"
                  onClick={chooseAiFolder}
                  disabled={creating}
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeModal} disabled={creating}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={createPartition}
                disabled={creating || (draft.end !== "" && draft.start !== "" && ((Number(draft.end) - Number(draft.start)) > 5 || (Number(draft.end) - Number(draft.start)) <= 0))}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '12px 0' }} />
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              All distances in meters (m) | Partition distance is auto-calculated | Max partition distance allowed: <strong>5 m</strong>
            </p>
          </div>
        </div>
      )}

    </>
  );
}