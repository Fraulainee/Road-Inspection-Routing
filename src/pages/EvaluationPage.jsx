import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ZoomIn, ZoomOut, Save, X, Pencil, Ruler, Undo2, Trash2 } from "lucide-react";

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
  "Others":                               ["Slight", "Moderate", "Severe"],
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
  const partitionNo = state?.partitionNo ?? "";
  const subsegmentId = state?.subsegmentId ?? "";
  const segmentId = state?.segmentId ?? "";
  const chainageId = state?.chainageId ?? "";
  const projectId = state?.projectId ?? "";

  function goBack() {
    // Return to ReviewPage preserving the image index the user was on
    nav("/review", {
      state: { ...state, startIndex: state?.index ?? 0 },
      replace: true,
    });
  }

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState("idle"); // annotate | measure | idle
  const measureTarget = "length";
  const [dotSize, setDotSize] = useState(4);
  const dotBorder = Math.max(1, Math.round(dotSize * 0.25));

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
    meterPerPx: "0.008862",
    itemOther: "",
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
  const draggedRef = useRef(false); // true if mouse moved enough to count as a drag

  // Zoom toward a canvas-relative point (cx, cy)
  function zoomToward(cx, cy, factor) {
    setZoom((prevZoom) => {
      const newZoom = Math.min(100, Math.max(0.5, prevZoom * factor));
      setPan((p) => ({
        x: cx + (p.x - cx) * (newZoom / prevZoom),
        y: cy + (p.y - cy) * (newZoom / prevZoom),
      }));
      return newZoom;
    });
  }

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
      zoomToward(cx, cy, factor);
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
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) draggedRef.current = true;
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
      if (k === "pavement_type") { updated.item = ""; updated.severity = ""; updated.itemOther = ""; }
      if (k === "item")          { updated.severity = ""; if (v !== "Others") updated.itemOther = ""; }
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

    const resolvedItem = form.item === "Others" ? (form.itemOther || "Others") : form.item;

    // --- Resolve metadata names via API ---
    const clean = (s) => String(s || "").replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "_");

    let projectName  = projectId  ? `Project${projectId}`  : "Project";
    let chainageName = chainageId ? `C${chainageId}`        : "Chainage";
    let segmentName  = segmentId  ? `S${segmentId}`         : "Segment";
    let subsegName   = subsegmentId ? `SS${subsegmentId}`   : "Subsegment";

    if (isElectron()) {
      try {
        const projects = await window.api.listProjects();
        const proj = projects?.find((p) => String(p.id) === String(projectId));
        // real field is road_name; fall back to name for web mock
        if (proj) projectName = proj.road_name || proj.name || projectName;
      } catch { /* ignore */ }

      try {
        const chainages = await window.api.listChainages(Number(projectId));
        const ch = chainages?.find((c) => String(c.id) === String(chainageId));
        if (ch?.name) chainageName = ch.name;
      } catch { /* ignore */ }

      try {
        const segments = await window.api.listSegments(Number(chainageId));
        const seg = segments?.find((s) => String(s.id) === String(segmentId));
        // segmentStart is the primary label (e.g. "K1512 + (000)")
        if (seg) segmentName = seg.segmentStart || seg.name || `S${segmentId}`;
      } catch { /* ignore */ }

      try {
        const subs = await window.api.listSubsegments(Number(segmentId));
        const sub = subs?.find((s) => String(s.id) === String(subsegmentId));
        // subsegment_no is the human-readable number
        if (sub) subsegName = `SS${sub.subsegment_no ?? subsegmentId}`;
      } catch { /* ignore */ }
    }

    // partition_no comes directly from navigation state (set in PartitionPage)
    const parLabel = partitionNo !== "" ? `Part${partitionNo}` : `Part${partitionId || "?"}`;

    // --- Build filename ---
    const outName = [
      clean(projectName),
      clean(chainageName),
      clean(segmentName),
      clean(subsegName),
      clean(parLabel),
      clean(form.pavement_type),
      clean(resolvedItem),
      form.length || "0",
      form.width  || "0",
    ].join("_") + ".png";

    // --- Build canvas with header + image + footer ---
    const headerH = Math.round(imgSize.h * 0.055);
    const footerH = Math.round(imgSize.h * 0.075);

    const canvas = document.createElement("canvas");
    canvas.width  = imgSize.w;
    canvas.height = headerH + imgSize.h + footerH;
    const ctx = canvas.getContext("2d");
    if (!ctx) { alert("Canvas not supported."); return; }

    // Header background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, imgSize.w, headerH);

    // Header text
    const hFont = Math.max(12, Math.round(headerH * 0.38));
    ctx.font = `bold ${hFont}px Arial`;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const headerText = `${projectName}  |  ${chainageName}  |  ${segmentName}  |  ${subsegName}  |  ${parLabel}  |  ${form.pavement_type || "—"}  |  ${resolvedItem || "—"}  |  L: ${form.length || "—"} m  |  W: ${form.width || "—"} m`;
    ctx.fillText(headerText, Math.round(imgSize.w * 0.01), headerH / 2);

    // Base image
    ctx.drawImage(img, 0, headerH, imgSize.w, imgSize.h);

    // Bounding boxes (offset y by headerH)
    ctx.setLineDash([]);
    ctx.lineWidth = 6;
    for (const box of boxes) {
      const x = Math.min(box.x1, box.x2);
      const y = Math.min(box.y1, box.y2) + headerH;
      const w = Math.abs(box.x2 - box.x1);
      const h = Math.abs(box.y2 - box.y1);
      ctx.strokeStyle = "rgba(220, 38, 38, 1)";
      ctx.strokeRect(x, y, w, h);
    }

    // Polyline (offset y by headerH)
    if (measurePts.length >= 2) {
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(252,163,17,0.95)";
      ctx.beginPath();
      ctx.moveTo(measurePts[0].x, measurePts[0].y + headerH);
      for (let i = 1; i < measurePts.length; i++) {
        ctx.lineTo(measurePts[i].x, measurePts[i].y + headerH);
      }
      ctx.stroke();
    }

    // Dots (offset y by headerH)
    for (const p of measurePts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y + headerH, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = dotBorder;
      ctx.strokeStyle = "rgba(252,163,17,0.95)";
      ctx.stroke();
    }

    // Footer background
    const footerY = headerH + imgSize.h;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, footerY, imgSize.w, footerH);

    // Footer 3-column data
    const colW = imgSize.w / 3;
    const fLabelFont = Math.max(11, Math.round(footerH * 0.28));
    const fValueFont = Math.max(13, Math.round(footerH * 0.40));
    const labelY = footerY + footerH * 0.3;
    const valueY = footerY + footerH * 0.72;

    const footerCols = [
      { label: "Length (m)", value: form.length || "—" },
      { label: "Width (m)",  value: form.width  || "—" },
      { label: "Area (m²)",  value: form.area !== "N/A" ? form.area : "—" },
    ];

    footerCols.forEach(({ label, value }, i) => {
      const cx = colW * i + colW / 2;
      // divider line between columns
      if (i > 0) {
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colW * i, footerY + footerH * 0.15);
        ctx.lineTo(colW * i, footerY + footerH * 0.85);
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${fLabelFont}px Arial`;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillText(label, cx, labelY);
      ctx.font = `bold ${fValueFont}px Arial`;
      ctx.fillStyle = "#d97706";
      ctx.fillText(value, cx, valueY);
    });

    // Export PNG
    canvas.toBlob(async (blob) => {
      if (!blob) {
        alert("Failed to create screenshot.");
        return;
      }

      // Electron: Save screenshot + insert DB record
      if (isElectron()) {
        try {
          let screenshotPath = null;
          if (partitionFolder && window.api?.saveImageBytes) {
            const itemName = (resolvedItem || "Uncategorized").replace(/[/\\:*?"<>|]/g, "-");
            const saveFolder = `${partitionFolder}/${itemName}`;
            const arrayBuffer = await blob.arrayBuffer();
            screenshotPath = await window.api.saveImageBytes(
              outName,
              Array.from(new Uint8Array(arrayBuffer)),
              saveFolder
            );
          }

          await window.api.createDefect({
            partition_id: partitionId,
            image_filename: filename,
            pavement_type: form.pavement_type,
            lane_no: form.laneNo ? Number(form.laneNo) : null,
            joint: form.joint || null,
            item: resolvedItem || null,
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
    if (e.button !== 0) return;
    e.preventDefault(); // always stop native browser image drag
    draggedRef.current = false;
    if (mode === "annotate") {
      const p = getImagePixelFromClick(e);
      if (!p) return;
      setDrawingBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else {
      // Hold to pan in measure and idle modes
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
    if (draggedRef.current) return; // was a drag-to-pan, not a point click
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
                  onClick={() => {
                    const el = canvasRef.current;
                    const r = el?.getBoundingClientRect();
                    zoomToward(r ? r.width / 2 : 0, r ? r.height / 2 : 0, 1.25);
                  }}
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => {
                    const el = canvasRef.current;
                    const r = el?.getBoundingClientRect();
                    zoomToward(r ? r.width / 2 : 0, r ? r.height / 2 : 0, 1 / 1.25);
                  }}
                >
                  <ZoomOut size={18} />
                </button>
              </div>
            </div>

            <div ref={canvasRef} className={`eval-canvas ${mode === "measure" ? "measure-mode" : mode === "annotate" ? "annotate-mode" : mode === "idle" ? "idle-mode" : ""}`}
              onClick={onImageClick}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
            >
              {viewUrl ? (
                <div
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
                      const w = im.naturalWidth || 0;
                      const h = im.naturalHeight || 0;
                      setImgSize({ w, h });
                      // Center image in canvas via initial pan
                      const canvas = canvasRef.current;
                      if (canvas) {
                        setPan({
                          x: Math.max(0, (canvas.clientWidth - w) / 2),
                          y: Math.max(0, (canvas.clientHeight - h) / 2),
                        });
                      }
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
                        strokeWidth={6 / zoom}
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
                        strokeWidth={6 / zoom}
                      />
                    )}

                    {measurePts.length >= 2 && (
                      <polyline
                        points={measurePts.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="rgba(252,163,17,0.95)"
                        strokeWidth={6 / zoom}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {measurePts.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={dotSize / zoom}
                        fill="white"
                        stroke="rgba(252,163,17,0.95)"
                        strokeWidth={dotBorder / zoom}
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

              {/* Annotate */}
              <div className="tool-card">
                <span className="tool-card-label">Annotate</span>
                <div className="tool-card-btns">
                  <button
                    className={mode === "annotate" ? "tool-btn active" : "tool-btn"}
                    onClick={() => { setMode((m) => m === "annotate" ? "idle" : "annotate"); resetMeasure(); }}
                  >
                    <Pencil size={16} />
                    Annotate
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
                    onClick={() => setMode((m) => m === "measure" ? "idle" : "measure")}
                  >
                    <Ruler size={16} />
                    Measure
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
                  <div className="meter-row" style={{ marginTop: 4 }}>
                    <label>Dot size: {dotSize}px</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={dotSize}
                      onChange={(e) => setDotSize(Number(e.target.value))}
                      style={{ width: 90 }}
                    />
                  </div>
                </div>
              </div>

              {/* Scale */}
              <div className="tool-card" style={{ gridColumn: 2 }}>
                <span className="tool-card-label">Scale</span>
                <div className="tool-card-btns" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
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
                  <div className="eval-total-label eval-total-big eval-total-highlight" style={{ marginLeft: 8, whiteSpace: "nowrap" }}>
                    Total: {Number.isFinite(totalM) ? totalM.toFixed(3) : "—"} m
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
                {form.item === "Others" && (
                  <input
                    style={{ marginTop: 6 }}
                    value={form.itemOther}
                    onChange={(e) => setField("itemOther", e.target.value)}
                    placeholder="Specify item type..."
                  />
                )}
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