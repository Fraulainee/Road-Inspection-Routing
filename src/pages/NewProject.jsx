import { useMemo, useState } from "react";
import roadBg from "./assets/road.jpg";

const leftFields = [
  { key: "bridge_id", label: "Bridge ID" },
  { key: "bridge_name", label: "Bridge Name" },
  { key: "road_name", label: "Road Name" },
  { key: "road_id", label: "Road ID" },
  { key: "section_id", label: "Section ID" },
  { key: "location", label: "Location" },
  { key: "region", label: "Region" },
  { key: "province", label: "Province" },
  { key: "c_district", label: "C District" },
  { key: "e_district", label: "E District" },
  { key: "municipality", label: "Municipality" },
  { key: "barangay", label: "Barangay" },
  { key: "river_name", label: "River Name" },
];

const rightFieldsTop = [
  { key: "type_of_bridge", label: "Type of Bridge" },
  { key: "superstructure", label: "Superstructure" },
  { key: "substructure", label: "Substructure" },
  { key: "foundation", label: "Foundation" },
  { key: "total_span", label: "Total No. of Span" },
  { key: "total_abutment", label: "Total No. of Abutment" },
  { key: "total_pier", label: "Total Number of Pier" },
];

export default function NewProject({ projectName, onCancel, onConfirm }) {
  const initial = useMemo(() => {
    const obj = {};
    [...leftFields, ...rightFieldsTop].forEach((f) => (obj[f.key] = ""));
    obj.date_of_field_inspection = "";
    obj.bridge_inspector = "";
    return obj;
  }, []);

  const [form, setForm] = useState(initial);
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h2>New Project</h2>
          <div className="stats-pills">
            <span className="stat-pill">{projectName || "Untitled Project"}</span>
          </div>
        </div>

        <div className="header-actions" >
          <button className="btn-secondary" onClick={onCancel}>
            Back
          </button>
          <button className="btn-primary" onClick={() => onConfirm?.(form)}>
            Confirm
          </button>
        </div>
      </header>

      <div className="content" style={{
            backgroundImage: `url(${roadBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}>
        <div className="np-form-card">
          <div className="np-grid">
            <div className="np-col">
              {leftFields.map((f) => (
                <div className="np-row" key={f.key}>
                  <label className="np-label">{f.label}</label>
                  <input
                    className="np-input"
                    value={form[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="np-col">
              {rightFieldsTop.map((f) => (
                <div className="np-row" key={f.key}>
                  <label className="np-label">{f.label}</label>
                  <input
                    className="np-input"
                    value={form[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              ))}

              <div className="np-row np-row-wide">
                <label className="np-label">Date of Field Inspection</label>
                <input
                  className="np-input"
                  type="date"
                  value={form.date_of_field_inspection}
                  onChange={(e) => setField("date_of_field_inspection", e.target.value)}
                />
              </div>

              <div className="np-row np-row-wide">
                <label className="np-label">Bridge Inspector</label>
                <input
                  className="np-input"
                  value={form.bridge_inspector}
                  onChange={(e) => setField("bridge_inspector", e.target.value)}
                />
              </div>

              <div className="np-bottom-actions">
                <button className="btn-secondary" onClick={onCancel}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={() => onConfirm?.(form)}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
