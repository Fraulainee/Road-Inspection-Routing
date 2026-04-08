import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ZoomIn, ZoomOut, Save, X, Pencil, Ruler, Undo2, Trash2, Hand } from "lucide-react";

// Items grouped by pavement type — names must match the remarks_lookup table exactly
const PAVEMENT_ITEMS = {
  Asphalt: [
    "Longitudinal Cracking",
    "Crocodile Cracking",
    "Transverse Cracking",
    "Edge Break",
    "Patches",
    "Potholes",
    "Wearing Surface",
    "Rutting – Positive Direction (Outer)",
    "Rutting – Positive Direction (Inner)",
    "Rutting – Negative Direction",
    "Surface Failure",
    "Others",
  ],
  Concrete: [
    "Longitudinal Cracking",
    "Multiple Cracking",
    "Transverse Cracking",
    "Joint Faulting",
    "Joint Spalling",
    "Joint Sealant Deterioration",
    "Shattered Slab",
    "Wearing Surface",
    "Others",
  ],
  Gravel: [
    "Gravel Thickness",
    "Gravel Quality",
    "Crown Shape",
    "Roadside Drainage",
    "Others",
  ],
};

// Severity options per item — matches severity_levels in remarks_lookup
const ITEM_SEVERITY = {
  "Longitudinal Cracking":                ["Narrow", "Wide"],
  "Crocodile Cracking":                   ["Narrow", "Wide"],
  "Transverse Cracking":                  ["Narrow", "Wide"],
  "Edge Break":                           ["Slight", "Moderate", "Large"],
  "Patches":                              ["Slight", "Moderate", "Large"],
  "Potholes":                             ["Slight", "Moderate", "Large"],
  "Wearing Surface":                      ["Minor", "Severe"],
  "Rutting – Positive Direction (Outer)": ["Depth in mm"],
  "Rutting – Positive Direction (Inner)": ["Depth in mm"],
  "Rutting – Negative Direction":         ["Depth in mm"],
  "Surface Failure":                      ["Number"],
  "Multiple Cracking":                    ["Minor", "Severe"],
  "Joint Faulting":                       ["Measured in mm"],
  "Joint Spalling":                       ["Measured in mm"],
  "Joint Sealant Deterioration":          ["Measured in length"],
  "Shattered Slab":                       ["Count"],
  "Gravel Thickness":                     ["1", "2", "3", "4"],
  "Gravel Quality":                       ["1", "2", "3", "4"],
  "Crown Shape":                          ["1", "2", "3", "4"],
  "Roadside Drainage":                    ["1", "2", "3", "4"],
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function segDist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function polylineDistance(points) {
  if (!points || points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += segDist(points[i - 1], points[i]);
  }
  return sum;
}

function isElectron() {
  return typeof window !== "undefined" && !!window.api;
}

export default function EvaluationPage() {
  const nav = useNavigate();
  const { state } = useLocation();

  const original = state?.original || "";
  const annotated = state?.annotated || "";
  const filename = state?.filename || "evaluation";
  const partitionFolder = state?.partitionFolder || "";
  const partitionId = state?.partitionId || null;

  function goBack() {
    // Return to ReviewPage preserving the image index the user was on
    nav("/review", {
      state: { ...state, startIndex: state?.index ?? 0 },
      replace: true,
    });
  }

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState("annotate"); // annotate | measure | idle
  const [measureTarget, setMeasureTarget] = useState("length"); // length | width

  const [form, setForm] = useState({
    pavement_type: state?.pavementType || "",
    laneNo: "1",
    item: "",
    length: "",
    width: "",
    depth: "N/A",
    area: "N/A",
    severity: "",
    joint: "",
    remarks: "",
    meterPerPx: "0.0008",
  });

  // Multi-point measurement state (image px coords)
  const [measurePts, setMeasurePts] = useState([]);

  // Bounding box state (image natural px coords)
  const [boxes, setBoxes] = useState([]);       // completed boxes [{x1,y1,x2,y2}]
  const [drawingBox, setDrawingBox] = useState(null); // box being drawn right now

  // Image sizing (set onLoad)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const panDragRef = useRef(null); // { mouseX, mouseY, panX, panY } while panning

  // Wheel zoom — non-passive so we can preventDefault
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((prevZoom) => {
        const newZoom = Math.min(8, Math.max(0.5, prevZoom * factor));
        setPan((p) => ({
          x: cx - (cx - p.x) * (newZoom / prevZoom),
          y: cy - (cy - p.y) * (newZoom / prevZoom),
        }));
        return newZoom;
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Global mouse move/up for drag-to-pan (works even if mouse leaves the element)
  useEffect(() => {
    const handleMove = (e) => {
      if (!panDragRef.current) return;
      const dx = e.clientX - panDragRef.current.mouseX;
      const dy = e.clientY - panDragRef.current.mouseY;
      setPan({ x: panDragRef.current.panX + dx, y: panDragRef.current.panY + dy });
    };
    const handleUp = () => { panDragRef.current = null; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const viewUrl = useMemo(() => original || annotated, [annotated, original]);

  function setField(k, v) {
    setForm((p) => {
      const updated = { ...p, [k]: v };
      if (k === "pavement_type") { updated.item = ""; updated.severity = ""; }
      if (k === "item")          { updated.severity = ""; }
      if (k === "length" || k === "width") {
        const l = parseFloat(k === "length" ? v : p.length);
        const w = parseFloat(k === "width" ? v : p.width);
        updated.area = l > 0 && w > 0 ? parseFloat((l * w).toFixed(4)).toString() : "N/A";
      }
      return updated;
    });
  }

  // ✅ Combined save function: saves screenshot AND form data
  async function onSaveDefect() {
    const img = imgRef.current;
    if (!img || !imgSize.w || !imgSize.h) {
      alert("Image not ready yet.");
      return;
    }

    // Create canvas screenshot
    const canvas = document.createElement("canvas");
    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      alert("Canvas not supported.");
      return;
    }

    // Draw base image
    ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);

    // Draw bounding boxes
    ctx.setLineDash([]);
    ctx.lineWidth = 6;
    for (const box of boxes) {
      const x = Math.min(box.x1, box.x2);
      const y = Math.min(box.y1, box.y2);
      const w = Math.abs(box.x2 - box.x1);
      const h = Math.abs(box.y2 - box.y1);
      ctx.strokeStyle = "rgba(220, 38, 38, 1)";
      ctx.strokeRect(x, y, w, h);
    }

    // Draw polyline (measurement line)
    if (measurePts.length >= 2) {
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(252,163,17,0.95)";
      ctx.beginPath();
      ctx.moveTo(measurePts[0].x, measurePts[0].y);
      for (let i = 1; i < measurePts.length; i++) {
        ctx.lineTo(measurePts[i].x, measurePts[i].y);
      }
      ctx.stroke();
    }

    // Draw points
    for (const p of measurePts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(252,163,17,0.95)";
      ctx.stroke();
    }

    // Draw info box in bottom-left corner
    const boxX = 10;
    const boxY = imgSize.h - 80;
    const boxW = 300;
    const boxH = 65;

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Text styling
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";

    // Length
    const lengthText = `Length (m): ${form.length || "—"}`;
    ctx.fillText(lengthText, boxX + 15, boxY + 25);

    // Width
    const widthText = `Width (m): ${form.width || "—"}`;
    ctx.fillText(widthText, boxX + 15, boxY + 50);

    // Export PNG
    canvas.toBlob(async (blob) => {
      if (!blob) {
        alert("Failed to create screenshot.");
        return;
      }

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const outName = `${filename}_eval_${ts}.png`;

      // Electron: Save screenshot + insert DB record
      if (isElectron()) {
        try {
          // Save screenshot into item subfolder inside partition folder
          let screenshotPath = null;
          if (partitionFolder && window.api?.saveImageBytes) {
            const itemName = (form.item || "Uncategorized").replace(/[/\\:*?"<>|]/g, "-");
            const saveFolder = `${partitionFolder}/${itemName}`;
            const arrayBuffer = await blob.arrayBuffer();
            screenshotPath = await window.api.saveImageBytes(
              outName,
              Array.from(new Uint8Array(arrayBuffer)),
              saveFolder
            );
          }

          // Insert defect record
          await window.api.createDefect({
            partition_id: partitionId,
            image_filename: filename,
            pavement_type: form.pavement_type,
            lane_no: form.laneNo ? Number(form.laneNo) : null,
            joint: form.joint || null,
            item: form.item || null,
            length_m: form.length ? Number(form.length) : null,
            width_m: form.width ? Number(form.width) : null,
            depth_mm: form.depth && form.depth !== "N/A" ? Number(form.depth) : null,
            area_m2: form.area && form.area !== "N/A" ? Number(form.area) : null,
            severity: form.severity || null,
            remarks: form.remarks || null,
            annotations: boxes.length > 0 ? boxes : null,
            meter_per_px: form.meterPerPx ? Number(form.meterPerPx) : null,
            screenshot_path: screenshotPath,
          });

          alert("Defect saved successfully!");
          loadDefects();
          return;
        } catch (error) {
          console.error("Error saving defect:", error);
          alert("Error saving: " + error.message);
          return;
        }
      }

      // Web fallback: download screenshot only
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert("Screenshot downloaded!");
    }, "image/png");
  }

  function resetMeasure() {
    setMeasurePts([]);
  }

  function undoMeasure() {
    setMeasurePts((prev) => prev.slice(0, -1));
  }

  function resetBoxes() {
    setBoxes([]);
    setDrawingBox(null);
  }

  function undoBox() {
    setBoxes((prev) => prev.slice(0, -1));
  }

  function onMouseDown(e) {
    if (mode === "annotate") {
      e.preventDefault();
      const p = getImagePixelFromClick(e);
      if (!p) return;
      setDrawingBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else if (mode === "idle" && e.button === 0) {
      panDragRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
    }
  }

  function onMouseMove(e) {
    if (mode !== "annotate" || !drawingBox) return;
    const p = getImagePixelFromClick(e);
    if (!p) return;
    setDrawingBox((prev) => (prev ? { ...prev, x2: p.x, y2: p.y } : null));
  }

  function onMouseUp(e) {
    if (mode !== "annotate" || !drawingBox) return;
    const p = getImagePixelFromClick(e);
    const final = p ? { ...drawingBox, x2: p.x, y2: p.y } : drawingBox;
    if (Math.abs(final.x2 - final.x1) > 5 || Math.abs(final.y2 - final.y1) > 5) {
      setBoxes((prev) => [...prev, final]);
    }
    setDrawingBox(null);
  }

  // Convert click -> image pixel coordinates (natural coords)
  function getImagePixelFromClick(e) {
    const img = imgRef.current;
    if (!img) return null;
    if (!imgSize.w || !imgSize.h) return null;

    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const xDisp = e.clientX - rect.left;
    const yDisp = e.clientY - rect.top;

    const x = clamp((xDisp / rect.width) * imgSize.w, 0, imgSize.w);
    const y = clamp((yDisp / rect.height) * imgSize.h, 0, imgSize.h);
    return { x, y };
  }

  function onImageClick(e) {
    if (mode !== "measure") return;
    const p = getImagePixelFromClick(e);
    if (!p) return;
    setMeasurePts((prev) => [...prev, p]);
  }

  const totalPx = useMemo(() => polylineDistance(measurePts), [measurePts]);

  const meterPerPxNum = useMemo(() => {
    const n = Number(form.meterPerPx);
    return Number.isFinite(n) ? n : NaN;
  }, [form.meterPerPx]);

  const totalM = useMemo(() => {
    if (!Number.isFinite(meterPerPxNum)) return NaN;
    return totalPx * meterPerPxNum;
  }, [totalPx, meterPerPxNum]);

  const [lookupNote, setLookupNote] = useState(null);
  const [defectList, setDefectList] = useState([]);

  async function loadDefects() {
    if (!isElectron() || !partitionId) return;
    try {
      const rows = await window.api.listDefects(partitionId);
      setDefectList(rows || []);
    } catch (e) {
      console.error("Failed to load defects:", e);
    }
  }

  useEffect(() => { loadDefects(); }, [partitionId]);

  async function deleteDefectRow(id) {
    if (!window.confirm("Delete this evaluation record?")) return;
    try {
      await window.api.deleteDefect(id);
      loadDefects();
    } catch (e) {
      alert("Failed to delete: " + e.message);
    }
  }

  // Update Notes box once pavement type + item + severity are all selected
  useEffect(() => {
    if (!isElectron() || !form.pavement_type || !form.item || !form.severity) {
      setLookupNote(null);
      return;
    }
    window.api.lookupRemark(form.pavement_type, form.item, form.severity)
      .then((result) => setLookupNote(result || null))
      .catch((e) => { console.error("Remark lookup error:", e); setLookupNote(null); });
  }, [form.pavement_type, form.item, form.severity]);

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h2>Evaluation</h2>
          <div className="stats-pills">
            <span className="stat-pill">{filename}</span>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-secondary" onClick={goBack}>
            Back
          </button>
        </div>
      </header>

      <div className="content eval-page">
      <div className="eval-wrap">
        {/* LEFT: Image + tools */}
        <div className="eval-left">
          <div className="eval-image-card">
            <div className="eval-topbar">
              <div className="eval-zoom">
                <button
                  className="icon-btn"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
                >
                  <ZoomOut size={18} />
                </button>
              </div>
            </div>

            <div ref={canvasRef} className={`eval-canvas ${mode === "measure" ? "measure-mode" : mode === "annotate" ? "annotate-mode" : mode === "idle" ? "idle-mode" : ""}`}>
              {viewUrl ? (
                <div
                  onClick={onImageClick}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  className="eval-image-wrapper"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
                >
                  <img
                    ref={imgRef}
                    src={viewUrl}
                    alt="Evaluation"
                    className="eval-img"
                    draggable={false}
                    onLoad={(e) => {
                      const im = e.currentTarget;
                      setImgSize({ w: im.naturalWidth || 0, h: im.naturalHeight || 0 });
                    }}
                  />

                  {/* overlay (boxes + polyline + points) */}
                  <svg className="eval-overlay"
                    viewBox={`0 0 ${imgSize.w || 1} ${imgSize.h || 1}`}
                    preserveAspectRatio="none"
                  >
                    {/* Completed bounding boxes */}
                    {boxes.map((box, i) => (
                      <rect
                        key={i}
                        x={Math.min(box.x1, box.x2)}
                        y={Math.min(box.y1, box.y2)}
                        width={Math.abs(box.x2 - box.x1)}
                        height={Math.abs(box.y2 - box.y1)}
                        fill="none"
                        stroke="rgba(220,38,38,1)"
                        strokeWidth="6"
                      />
                    ))}

                    {/* Live preview while drawing */}
                    {drawingBox && (
                      <rect
                        x={Math.min(drawingBox.x1, drawingBox.x2)}
                        y={Math.min(drawingBox.y1, drawingBox.y2)}
                        width={Math.abs(drawingBox.x2 - drawingBox.x1)}
                        height={Math.abs(drawingBox.y2 - drawingBox.y1)}
                        fill="none"
                        stroke="rgba(220,38,38,0.7)"
                        strokeWidth="6"
                      />
                    )}

                    {measurePts.length >= 2 && (
                      <polyline
                        points={measurePts.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="rgba(252,163,17,0.95)"
                        strokeWidth="6"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {measurePts.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="white"
                        stroke="rgba(252,163,17,0.95)"
                        strokeWidth="3"
                      />
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="review-empty">No image</div>
              )}

              <div className="eval-measure-readout">
                <div>
                  <b>Measuring:</b>{" "}
                  <span style={{ color: "#FCA311", fontWeight: 700 }}>
                    {measureTarget === "length" ? "Length" : "Width"}
                  </span>
                </div>
                <div>
                  <b>Length (m):</b> {form.length || "—"}
                </div>
                <div>
                  <b>Width (m):</b> {form.width || "—"}
                </div>
                {/* <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                  <b>Measure points:</b> {measurePts.length}
                </div> */}
              </div>
            </div>

            <div className="eval-tools">

              {/* Pan */}
              <div className="tool-card">
                <span className="tool-card-label">Mode</span>
                <div className="tool-card-btns">
                  <button
                    className={mode === "idle" ? "tool-btn tool-btn-pan active" : "tool-btn tool-btn-pan"}
                    onClick={() => setMode("idle")}
                    title="Drag to pan the image"
                  >
                    <Hand size={16} />
                    Pan
                  </button>
                </div>
              </div>

              {/* Annotate */}
              <div className="tool-card">
                <span className="tool-card-label">Annotate</span>
                <div className="tool-card-btns">
                  <button
                    className={mode === "annotate" ? "tool-btn active" : "tool-btn"}
                    onClick={() => { setMode("annotate"); resetMeasure(); }}
                  >
                    <Pencil size={16} />
                    Draw Box
                  </button>
                  <button
                    className="tool-btn ghost"
                    onClick={undoBox}
                    disabled={boxes.length === 0}
                    title="Undo last box"
                  >
                    <Undo2 size={16} />
                    Undo
                  </button>
                  <button
                    className="tool-btn ghost"
                    onClick={resetBoxes}
                    disabled={boxes.length === 0 && !drawingBox}
                    title="Clear all boxes"
                  >
                    <Trash2 size={16} />
                    Clear
                  </button>
                </div>
              </div>

              {/* Measure */}
              <div className="tool-card">
                <span className="tool-card-label">Measure</span>
                <div className="tool-card-btns">
                  <button
                    className={mode === "measure" ? "tool-btn active" : "tool-btn"}
                    onClick={() => setMode("measure")}
                  >
                    <Ruler size={16} />
                    Measure
                  </button>
                  <button
                    className={measureTarget === "length" ? "tool-btn active" : "tool-btn ghost"}
                    onClick={() => setMeasureTarget("length")}
                    title="Measure Length"
                  >
                    Length
                  </button>
                  <button
                    className={measureTarget === "width" ? "tool-btn active" : "tool-btn ghost"}
                    onClick={() => setMeasureTarget("width")}
                    title="Measure Width"
                  >
                    Width
                  </button>
                  <button
                    className="tool-btn ghost"
                    onClick={undoMeasure}
                    disabled={measurePts.length === 0}
                    title="Undo last point"
                  >
                    <Undo2 size={16} />
                    Undo
                  </button>
                  <button
                    className="tool-btn ghost"
                    onClick={resetMeasure}
                    disabled={measurePts.length === 0}
                    title="Clear measurement"
                  >
                    <Trash2 size={16} />
                    Clear
                  </button>
                </div>
              </div>

              {/* Scale */}
              <div className="tool-card">
                <span className="tool-card-label">Scale</span>
                <div className="tool-card-btns" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                  <div className="meter-row">
                    <label>Meter/px:</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="meter-input"
                      value={form.meterPerPx}
                      onChange={(e) => setField("meterPerPx", e.target.value)}
                    />
                  </div>
                  <div className="meter-totals" style={{ alignItems: "flex-start", marginTop: 0 }}>
                    <div className="eval-total-label eval-total-big">
                      Total: {totalPx.toFixed(1)} px
                    </div>
                    <div className="eval-total-label eval-total-big eval-total-highlight">
                      Total: {Number.isFinite(totalM) ? totalM.toFixed(3) : "—"} m
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT: Form */}
        <div className="eval-right">
          <div className="eval-form-card">
            <div className="eval-form-grid">

              <div className="frow">
                <label>Pavement Type</label>
                <select value={form.pavement_type} onChange={(e) => setField("pavement_type", e.target.value)}>
                  <option value="">— Select type —</option>
                  <option value="Asphalt">Asphalt</option>
                  <option value="Concrete">Concrete</option>
                  <option value="Gravel">Gravel</option>
                </select>
              </div>

              <div className="frow">
                <label>Lane No.</label>
                <select value={form.laneNo} onChange={(e) => setField("laneNo", e.target.value)}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="frow">
                <label>Joint</label>
                <input
                  value={form.joint}
                  onChange={(e) => setField("joint", e.target.value)}
                  placeholder="Enter joint description..."
                />
              </div>

              <div className="frow">
                <label>Item</label>
                {!form.pavement_type && (
                  <p style={{ fontSize: 12, color: "#e57373", marginBottom: 4 }}>
                    Select a pavement type first to filter items
                  </p>
                )}
                <select value={form.item} onChange={(e) => setField("item", e.target.value)}>
                  <option value="">— Select item —</option>
                  {(form.pavement_type
                    ? PAVEMENT_ITEMS[form.pavement_type]
                    : Object.values(PAVEMENT_ITEMS).flat()
                  ).map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>

              <div className="frow">
                <label>Length (m)</label>
                <input
                  type="number"
                  value={form.length}
                  onChange={(e) => setField("length", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="frow">
                <label>Width (m)</label>
                <input
                  type="number"
                  value={form.width}
                  onChange={(e) => setField("width", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="frow">
                <label>Depth (m)</label>
                <input
                  value={form.depth}
                  onChange={(e) => setField("depth", e.target.value)}
                  placeholder="N/A"
                />
              </div>

              <div className="frow">
                <label>Area (m²)</label>
                <input value={form.area} readOnly className="eval-input-readonly" tabIndex={-1} />
              </div>

              <div className="frow">
                <label>Severity</label>
                <select value={form.severity} onChange={(e) => setField("severity", e.target.value)}>
                  <option value="">— Select severity —</option>
                  {(ITEM_SEVERITY[form.item] || []).map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>

              <div className="frow">
                <label>Remarks</label>
                <input
                  value={form.remarks}
                  onChange={(e) => setField("remarks", e.target.value)}
                  placeholder="Add remarks..."
                />
              </div>

              <div className="eval-notes">
                <div className="eval-notes-title">Notes</div>
                <div className="eval-notes-body">
                  {lookupNote ? (
                    <>
                      <p>{lookupNote.severity_guide}</p>
                      {lookupNote.measurement_method && (
                        <p><b>Measurement:</b> {lookupNote.measurement_method}</p>
                      )}
                    </>
                  ) : (
                    <>
                      {/* <p><b>Slight:</b> Surface distress covers &lt;10% of section area</p>
                      <p><b>Moderate:</b> Surface distress covers 10–30% of section area</p>
                      <p><b>Large / Wide:</b> Surface distress covers &gt;30% of section area</p>
                      <p><b>Narrow:</b> Crack width &lt;5 mm &nbsp;|&nbsp; <b>Wide:</b> crack width ≥5 mm</p> */}
                    </>
                  )}
                </div>
              </div>

              <div className="eval-actions">
                <button className="btn-secondary" onClick={goBack}>
                  <X size={18} />
                  Exit
                </button>
                <button className="btn-primary" onClick={onSaveDefect}>
                  <Save size={18} />
                  Save
                </button>
              </div>

            </div>
          </div>

          {/* Saved evaluations — right column, below the form */}
          <div className="eval-saved-panel">
            <div className="eval-saved-header">
              <span className="eval-saved-title">Saved Evaluations</span>
              <span className="eval-saved-count">{defectList.length} record{defectList.length !== 1 ? "s" : ""}</span>
            </div>
            {defectList.length === 0 ? (
              <div className="eval-saved-empty">No evaluations saved yet.</div>
            ) : (
              <div className="eval-saved-table-wrap">
                <table className="eval-saved-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Image</th>
                      <th>Item</th>
                      <th>Severity</th>
                      <th>L (m)</th>
                      <th>W (m)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {defectList.map((d, i) => (
                      <tr key={d.id}>
                        <td className="eval-saved-num">#{i + 1}</td>
                        <td className="eval-saved-file">{d.image_filename || "—"}</td>
                        <td className="eval-saved-bold">{d.item || "—"}</td>
                        <td>{d.severity || "—"}</td>
                        <td>{d.length_m ?? "—"}</td>
                        <td>{d.width_m ?? "—"}</td>
                        <td>
                          <button
                            className="defect-delete-btn"
                            onClick={() => deleteDefectRow(d.id)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>{/* end eval-right */}
      </div>{/* end eval-wrap */}
      </div>{/* end eval-page */}
    </>
  );
}