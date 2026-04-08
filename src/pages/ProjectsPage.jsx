import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, isElectron } from "../api/client";
import { RefreshCcw } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const emptyProject = {
  roadId: "",
  sectionId: "",
  roadName: "",
  sectionLengthM: "",
  district: "",
  surveyorName: "",
  region: "",
  surveyDate: "",
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProject, setNewProject] = useState(emptyProject);
  const [creating, setCreating] = useState(false);

  const [editProject, setEditProject] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  function openEditProject(project) {
    setEditProject({
      id: project.id,
      roadName: project.road_name || "",
      roadId: project.road_id || "",
      sectionId: project.section_id || "",
      sectionLengthM: project.section_length_m ?? "",
      district: project.c_district || "",
      surveyorName: project.surveyor_name || "",
      region: project.region || "",
      surveyDate: project.survey_date ? new Date(project.survey_date) : null,
    });
  }

  function closeEditProject() { setEditProject(null); setEditSaving(false); }

  async function handleSaveProject() {
    if (!editProject.roadName.trim()) { alert("Road Name is required."); return; }
    setEditSaving(true);
    try {
      await api.updateProject({
        id: editProject.id,
        name: editProject.roadName.trim(),
        road_id: editProject.roadId.trim() || null,
        section_id: editProject.sectionId.trim() || null,
        road_name: editProject.roadName.trim(),
        section_length_m: editProject.sectionLengthM ? Number(editProject.sectionLengthM) : null,
        c_district: editProject.district.trim() || null,
        surveyor_name: editProject.surveyorName.trim() || null,
        region: editProject.region.trim() || null,
        survey_date: editProject.surveyDate || null,
      });
      closeEditProject();
      await refreshProjects();
    } catch (e) {
      alert(e?.message || "Failed to update project.");
    } finally {
      setEditSaving(false);
    }
  }

  function setNP(field, val) {
    setNewProject((prev) => ({ ...prev, [field]: val }));
  }

  async function refreshProjects() {
    setLoading(true);
    setError("");
    try {
      const data = await api.listProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  const total = projects.length;
  const active = useMemo(() => projects.length, [projects]);

  function handleEnterProject(id) {
    navigate(`/projects/${id}`);
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

  async function handleDeleteProject(id) {
    const ok = confirm("Delete this project? This will also delete its chainages/segments/etc.");
    if (!ok) return;
    try {
      await api.deleteProject(id);
      if (selectedRowId === id) setSelectedRowId(null);
      await refreshProjects();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to delete project.");
    }
  }

  async function handleCreateProject() {
    const roadName = newProject.roadName.trim();
    if (!roadName) {
      alert("Road Name is required.");
      return;
    }

    setCreating(true);
    try {
      await api.createProject({
        name: roadName,
        road_id: newProject.roadId.trim() || null,
        section_id: newProject.sectionId.trim() || null,
        road_name: roadName,
        section_length_m: newProject.sectionLengthM ? Number(newProject.sectionLengthM) : null,
        c_district: newProject.district.trim() || null,
        surveyor_name: newProject.surveyorName.trim() || null,
        region: newProject.region.trim() || null,
        survey_date: newProject.surveyDate || null,
      });

      setShowNewProjectModal(false);
      setNewProject(emptyProject);
      await refreshProjects();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    if (creating) return;
    setShowNewProjectModal(false);
    setNewProject(emptyProject);
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
          <h2>Projects</h2>
          <div className="stats-pills">
            <span className="stat-pill">Total: {total}</span>
            <span className="stat-pill">Active: {active}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={refreshProjects} disabled={loading}>
            {loading ? "Refreshing..." : <RefreshCcw size={18} />}
            Refresh
          </button>
          <button className="btn-new-project" onClick={() => setShowNewProjectModal(true)}>
            + New Project
          </button>
        </div>
      </header>

      <div className="content">
        {error && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Database Error</h4>
            <div style={{ color: "var(--light-gray)" }}>{error}</div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={refreshProjects}>Retry</button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="projects-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Road Name</th>
                <th>Road ID</th>
                <th>Section ID</th>
                <th>Region</th>
                <th>District</th>
                <th>File Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 18 }}>Loading...</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 18 }}>No projects yet.</td></tr>
              ) : (
                projects.map((project, index) => (
                  <tr
                    key={project.id}
                    className={selectedRowId === project.id ? "row-selected" : ""}
                    onClick={() => setSelectedRowId(project.id)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span>{project.road_name || project.name}</span>
                        {project.folder_path && isElectron() && (
                          <span
                            className="folder-path"
                            onClick={(e) => { e.stopPropagation(); handleOpenFolder(project.folder_path); }}
                          >
                            📁 {project.folder_path}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{project.road_id || "—"}</td>
                    <td>{project.section_id || "—"}</td>
                    <td>{project.region || "—"}</td>
                    <td>{project.c_district || "—"}</td>
                    <td>{fmtCreated(project.created_at || project.created)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-enter"
                          onClick={(e) => { e.stopPropagation(); handleEnterProject(project.id); }}
                        >
                          Enter
                        </button>
                        {project.folder_path && isElectron() && (
                          <button
                            className="btn-folder"
                            onClick={(e) => { e.stopPropagation(); handleOpenFolder(project.folder_path); }}
                            title="Open folder"
                          >
                            📁 Open
                          </button>
                        )}
                        <button
                          className="btn-edit"
                          onClick={(e) => { e.stopPropagation(); openEditProject(project); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-delete"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
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

      {/* Edit Project Modal */}
      {editProject && (
        <div className="modal-overlay" onClick={closeEditProject}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Project</h3>

            <div className="modal-form-grid">
              {/* LEFT COLUMN */}
              <div className="modal-col">
                <div className="modal-field">
                  <label>Road ID</label>
                  <input
                    type="text"
                    placeholder="e.g., R-001"
                    value={editProject.roadId}
                    onChange={(e) => setEditProject((p) => ({ ...p, roadId: e.target.value }))}
                    disabled={editSaving}
                  />
                </div>
                <div className="modal-field">
                  <label>Road Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g., National Highway"
                    value={editProject.roadName}
                    onChange={(e) => setEditProject((p) => ({ ...p, roadName: e.target.value }))}
                    disabled={editSaving}
                    autoFocus
                  />
                </div>
                <div className="modal-field">
                  <label>District</label>
                  <input
                    type="text"
                    placeholder="e.g., 1st District"
                    value={editProject.district}
                    onChange={(e) => setEditProject((p) => ({ ...p, district: e.target.value }))}
                    disabled={editSaving}
                  />
                </div>
                <div className="modal-field">
                  <label>Region</label>
                  <input
                    type="text"
                    placeholder="e.g., Region III"
                    value={editProject.region}
                    onChange={(e) => setEditProject((p) => ({ ...p, region: e.target.value }))}
                    disabled={editSaving}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="modal-col">
                <div className="modal-field">
                  <label>Section ID</label>
                  <input
                    type="text"
                    placeholder="e.g., S-001"
                    value={editProject.sectionId}
                    onChange={(e) => setEditProject((p) => ({ ...p, sectionId: e.target.value }))}
                    disabled={editSaving}
                  />
                </div>
                <div className="modal-field">
                  <label>Section Length</label>
                  <div className="input-with-suffix">
                    <input
                      type="number"
                      placeholder="0"
                      value={editProject.sectionLengthM}
                      onChange={(e) => setEditProject((p) => ({ ...p, sectionLengthM: e.target.value }))}
                      disabled={editSaving}
                    />
                    <span className="input-suffix-label">meters</span>
                  </div>
                </div>
                <div className="modal-field">
                  <label>Surveyor's Name</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={editProject.surveyorName}
                    onChange={(e) => setEditProject((p) => ({ ...p, surveyorName: e.target.value }))}
                    disabled={editSaving}
                  />
                </div>
                <div className="modal-field">
                  <label>Survey Date</label>
                  <DatePicker
                    selected={editProject.surveyDate}
                    onChange={(date) => setEditProject((p) => ({ ...p, surveyDate: date }))}
                    dateFormat="MM/dd/yyyy"
                    placeholderText="Select date..."
                    disabled={editSaving}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    className="datepicker-input"
                    wrapperClassName="datepicker-wrapper"
                    popperPlacement="bottom-start"
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={closeEditProject} disabled={editSaving}>
                Cancel
              </button>
              <button className="btn-modal-confirm" onClick={handleSaveProject} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>+ New Project</h3>

            <div className="modal-form-grid">
              {/* LEFT COLUMN */}
              <div className="modal-col">
                <div className="modal-field">
                  <label>Road ID</label>
                  <input
                    type="text"
                    placeholder="e.g., R-001"
                    value={newProject.roadId}
                    onChange={(e) => setNP("roadId", e.target.value)}
                    disabled={creating}
                  />
                </div>
                <div className="modal-field">
                  <label>Road Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g., National Highway"
                    value={newProject.roadName}
                    onChange={(e) => setNP("roadName", e.target.value)}
                    disabled={creating}
                    autoFocus
                  />
                </div>
                <div className="modal-field">
                  <label>District</label>
                  <input
                    type="text"
                    placeholder="e.g., 1st District"
                    value={newProject.district}
                    onChange={(e) => setNP("district", e.target.value)}
                    disabled={creating}
                  />
                </div>
                <div className="modal-field">
                  <label>Region</label>
                  <input
                    type="text"
                    placeholder="e.g., Region III"
                    value={newProject.region}
                    onChange={(e) => setNP("region", e.target.value)}
                    disabled={creating}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="modal-col">
                <div className="modal-field">
                  <label>Section ID</label>
                  <input
                    type="text"
                    placeholder="e.g., S-001"
                    value={newProject.sectionId}
                    onChange={(e) => setNP("sectionId", e.target.value)}
                    disabled={creating}
                  />
                </div>
                <div className="modal-field">
                  <label>Section Length</label>
                  <div className="input-with-suffix">
                    <input
                      type="number"
                      placeholder="0"
                      value={newProject.sectionLengthM}
                      onChange={(e) => setNP("sectionLengthM", e.target.value)}
                      disabled={creating}
                    />
                    <span className="input-suffix-label">meters</span>
                  </div>
                </div>
                <div className="modal-field">
                  <label>Surveyor's Name</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={newProject.surveyorName}
                    onChange={(e) => setNP("surveyorName", e.target.value)}
                    disabled={creating}
                  />
                </div>
                <div className="modal-field">
                  <label>Survey Date</label>
                  <DatePicker
                    selected={newProject.surveyDate ? new Date(newProject.surveyDate) : null}
                    onChange={(date) =>
                      setNP("surveyDate", date ? date.toISOString().split("T")[0] : "")
                    }
                    dateFormat="MM/dd/yyyy"
                    placeholderText="Select date..."
                    disabled={creating}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    className="datepicker-input"
                    wrapperClassName="datepicker-wrapper"
                    popperPlacement="bottom-start"
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={closeModal} disabled={creating}>
                Cancel
              </button>
              <button className="btn-modal-confirm" onClick={handleCreateProject} disabled={creating}>
                {creating ? "Creating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}