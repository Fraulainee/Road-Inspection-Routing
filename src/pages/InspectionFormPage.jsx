import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCcw, X, ChevronDown, ChevronRight, Download } from "lucide-react";

function isElectron() {
  return typeof window !== "undefined" && !!window.api;
}

function makePartition(p) {
  return {
    id: p.id,
    subsegment_id: p.subsegment_id,
    partition_no: p.partition_no,
    start_m: p.start_m ?? "",
    end_m: p.end_m ?? "",
    partition_m: p.partition_m ?? "",
    distress_no: p.distress_no ?? "",
    lane_no: p.lane_no ?? "",
    item: p.item ?? "",
    length_m: p.length_m ?? "",
    width_m: p.width_m ?? "",
    depth_mm: p.depth_mm ?? "",
    area_m2: p.area_m2 ?? "",
    severity: p.severity ?? "",
    joint: p.joint ?? "",
    defects: [],
  };
}

function makeDefect(d) {
  return {
    id: d.id,
    image_filename: d.image_filename ?? "",
    screenshot_path: d.screenshot_path ?? "",
    lane_no: d.lane_no ?? "",
    joint: d.joint ?? "",
    item: d.item ?? "",
    severity: d.severity ?? "",
    length_m: d.length_m ?? "",
    width_m: d.width_m ?? "",
    depth_mm: d.depth_mm ?? "",
    area_m2: d.area_m2 ?? "",
    remarks: d.remarks ?? "",
  };
}

function makeSubsegment(s) {
  return {
    id: s.id,
    segment_id: s.segment_id,
    subsegment_no: s.subsegment_no ?? "",
    subsegment_length_m: s.subsegment_length_m ?? "",
    lanes: s.lanes ?? "",
    pavement_type: s.pavement_type ?? "",
    partitions: [],
  };
}

const TOTAL_COLS = 11;

export default function InspectionFormPage() {
  const navigate = useNavigate();
  const { projectId, chainageId, segmentId } = useParams();

  const [segments, setSegments] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [chainageName, setChainageName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSegment,    setFilterSegment]    = useState("");
  const [filterSubsegment, setFilterSubsegment] = useState("");
  const [filterPartition,  setFilterPartition]  = useState("");
  const [filterLaneNo,     setFilterLaneNo]     = useState("");
  const [filterJoint,      setFilterJoint]      = useState("");
  const [filterItem,       setFilterItem]       = useState("");
  const [filterSeverity,   setFilterSeverity]   = useState("");
  const [expandedSubsegments, setExpandedSubsegments] = useState(new Set());
  const [expandedPartitions, setExpandedPartitions] = useState(new Set());
  const [selectedDefectKey, setSelectedDefectKey] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const hasAnyFilter = filterSegment || filterSubsegment ||
    filterPartition || filterLaneNo || filterJoint || filterItem || filterSeverity;

  function clearAllFilters() {
    setFilterSegment(""); setFilterSubsegment(""); setFilterPartition("");
    setFilterLaneNo(""); setFilterJoint(""); setFilterItem(""); setFilterSeverity("");
  }

  function downloadCSV() {
    const headers = [
      "Segment Name", "Segment Start", "Segment End", "Segment Length (m)",
      "Subsegment No.", "Subsegment Length (m)", "Lanes", "Pavement Type",
      "Partition No.", "Partition Start (m)", "Partition End (m)", "Partition Distance (m)", "Distress No.",
      "#", "Lane No.", "Joint", "Item", "Severity",
      "Length (m)", "Width (m)", "Depth (mm)", "Area (m²)", "Remarks", "Image Path",
    ];

    const esc = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const makeHyperlink = (filePath, displayName) => {
      if (!filePath) return "";
      const normalized = filePath.replace(/\\/g, "/");
      return `=HYPERLINK("file:///${normalized}","${displayName || filePath.split(/[\\/]/).pop()}")`;
    };

    const sanitize = (s) => String(s ?? "").replace(/[^a-zA-Z0-9_\-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

    const rows = [headers.map(esc).join(",")];

    for (const seg of filteredSegments) {
      for (const sub of seg.subsegments) {
        for (const part of sub.partitions) {
          const defects = part.defects || [];
          const segCols = [seg.name, seg.segmentStart, seg.segmentEnd, seg.length_m];
          const subCols = [sub.subsegment_no, sub.subsegment_length_m, sub.lanes, sub.pavement_type];
          const partCols = [part.partition_no, part.start_m, part.end_m, part.partition_m, part.distress_no];

          if (defects.length === 0) {
            rows.push([...segCols, ...subCols, ...partCols, "", "", "", "", "", "", "", "", "", "", ""].map(esc).join(","));
          } else {
            defects.forEach((d, i) => {
              const imageLinkCell = makeHyperlink(d.screenshot_path, d.image_filename);
              rows.push([
                ...segCols.map(esc), ...subCols.map(esc), ...partCols.map(esc),
                esc(i + 1), esc(d.lane_no), esc(d.joint), esc(d.item), esc(d.severity),
                esc(d.length_m), esc(d.width_m), esc(d.depth_mm), esc(d.area_m2), esc(d.remarks),
                imageLinkCell,
              ].join(","));
            });
          }
        }
      }
    }

    const date = new Date().toISOString().slice(0, 10);
    const segName  = sanitize(filteredSegments[0]?.name ?? `seg${segmentId}`);
    const subNos   = filteredSegments[0]?.subsegments.map((s) => s.subsegment_no).join("-") ?? "";
    const subPart  = subNos ? `_${sanitize(subNos)}` : "";
    const filename = `roadinspection_${sanitize(projectName)}_${sanitize(chainageName)}_${segName}${subPart}_${date}.csv`;

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }


  function toggleSubsegment(subId) {
    setExpandedSubsegments((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  }

  function togglePartition(partId) {
    setExpandedPartitions((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  }

  async function loadData() {
    setLoading(true);
    setError("");

    if (!isElectron()) {
      setProjectName("DemoProject");
      setChainageName("K1512");
      setSegments([
        {
          id: 1,
          name: "K1512-01",
          segmentStart: "K1512 + (000)",
          segmentEnd: "K1512 + (135)",
          length_m: 135,
          subsegments: [
            {
              ...makeSubsegment({ id: 1, segment_id: 1, subsegment_no: 1, subsegment_length_m: 135, lanes: 4, pavement_type: "Concrete" }),
              partitions: [
                { ...makePartition({ id: 1, subsegment_id: 1, partition_no: 1, start_m: 0, end_m: 5, partition_m: 5 }), defects: [] },
              ],
            },
          ],
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const [allProjects, allChainages, allSegments] = await Promise.all([
        window.api.listProjects(),
        window.api.listChainages(Number(projectId)),
        window.api.listSegments(Number(chainageId)),
      ]);
      const proj = allProjects.find((p) => String(p.id) === String(projectId));
      const ch   = allChainages.find((c) => String(c.id) === String(chainageId));
      setProjectName(proj?.name ?? `project${projectId}`);
      setChainageName(ch?.name  ?? `chainage${chainageId}`);
      const matchedSegments = allSegments.filter((s) => String(s.id) === String(segmentId));

      const segmentsWithData = await Promise.all(
        matchedSegments.map(async (seg) => {
          const subsegments = await window.api.listSubsegments(seg.id);

          const subsegmentsWithPartitions = await Promise.all(
            subsegments.map(async (sub) => {
              const partitions = await window.api.listPartitions(sub.id);

              const partitionsWithDefects = await Promise.all(
                (partitions || []).map(async (p) => {
                  const defects = await window.api.listDefects(p.id);
                  return {
                    ...makePartition(p),
                    defects: (defects || []).map(makeDefect),
                  };
                })
              );

              return {
                ...makeSubsegment(sub),
                partitions: partitionsWithDefects,
              };
            })
          );

          return { ...seg, subsegments: subsegmentsWithPartitions };
        })
      );

      setSegments(segmentsWithData);
      // Auto-expand all subsegments and partitions
      const allSubIds = segmentsWithData.flatMap((seg) => seg.subsegments.map((s) => s.id));
      setExpandedSubsegments(new Set(allSubIds));
      const allPartitionIds = segmentsWithData.flatMap((seg) =>
        seg.subsegments.flatMap((sub) => sub.partitions.map((p) => p.id))
      );
      setExpandedPartitions(new Set(allPartitionIds));
    } catch (e) {
      console.error("Load error:", e);
      setError(e?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [chainageId, segmentId]);

  const filteredSegments = useMemo(() => {
    if (!hasAnyFilter) return segments;
    const fSeg     = filterSegment.toLowerCase().trim();
    const fSub     = filterSubsegment.toLowerCase().trim();
    const fPart    = filterPartition.toLowerCase().trim();
    const fLane    = filterLaneNo.toLowerCase().trim();
    const fJoint   = filterJoint.toLowerCase().trim();
    const fItem    = filterItem.toLowerCase().trim();
    const fSev     = filterSeverity.toLowerCase().trim();

    const inc = (val, f) => !f || String(val ?? "").toLowerCase().includes(f);

    return segments.map((seg) => {
      // Segment filter
      const segMatches = inc(seg.name, fSeg) || inc(seg.segmentStart, fSeg) || inc(seg.segmentEnd, fSeg);
      if (fSeg && !segMatches) return null;

      const filteredSubs = seg.subsegments.map((sub) => {
        // Subsegment filter
        if (fSub && !inc(sub.subsegment_no, fSub)) return null;

        const filteredParts = sub.partitions.reduce((acc, part) => {
          // Partition filter
          if (fPart && !inc(part.partition_no, fPart)) return acc;

          const filteredDefects = (part.defects || []).filter((d) => {
            if (!inc(d.lane_no,  fLane))  return false;
            if (!inc(d.joint,    fJoint)) return false;
            if (!inc(d.item,     fItem))  return false;
            if (!inc(d.severity, fSev))   return false;
            return true;
          });

          const hasDefectFilter = fLane || fJoint || fItem || fSev;
          if (hasDefectFilter) {
            if (filteredDefects.length > 0) acc.push({ ...part, defects: filteredDefects });
          } else {
            acc.push(part);
          }
          return acc;
        }, []);

        if (filteredParts.length > 0 || (!fPart && !fLane && !fJoint && !fItem && !fSev)) {
          return {
            ...sub,
            partitions: filteredParts.length > 0 ? filteredParts : sub.partitions,
          };
        }
        return null;
      }).filter(Boolean);

      const filteredSubsClean = filteredSubs.filter(Boolean);
      if (filteredSubsClean.length > 0) {
        return { ...seg, subsegments: filteredSubsClean };
      }
      if (!fSeg && !fSub && !fPart && !fLane && !fJoint && !fItem && !fSev) {
        return seg;
      }
      return null;
    }).filter(Boolean);
  }, [segments, filterSegment, filterSubsegment, filterPartition,
      filterLaneNo, filterJoint, filterItem, filterSeverity, hasAnyFilter]);

  function buildRows() {
    const rows = [];

    for (const seg of filteredSegments) {
      const totalSubs = seg.subsegments.length;
      const totalParts = seg.subsegments.reduce((n, s) => n + s.partitions.length, 0);
      const totalDefects = seg.subsegments.reduce(
        (n, s) => n + s.partitions.reduce((m, p) => m + (p.defects?.length || 0), 0), 0
      );

      // Segment header
      rows.push(
        <tr key={`seg-${seg.id}`}>
          <td colSpan={TOTAL_COLS} className="inspection-group-segment">
            <div className="igroup-seg-inner">
              <div className="igroup-seg-title">
                <span className="igroup-badge seg-badge">SEGMENT</span>
                <span className="igroup-name">{seg.name || `Segment ${seg.id}`}</span>
                {seg.segmentSubName && (
                  <span className="igroup-subname">{seg.segmentSubName}</span>
                )}
              </div>
              <div className="igroup-fields">
                {seg.segmentStart && (
                  <span className="igroup-field">
                    <span className="igroup-label">Start</span>
                    <span className="igroup-value">{seg.segmentStart}</span>
                  </span>
                )}
                {seg.segmentEnd && (
                  <span className="igroup-field">
                    <span className="igroup-label">End</span>
                    <span className="igroup-value">{seg.segmentEnd}</span>
                  </span>
                )}
                {seg.length_m != null && (
                  <span className="igroup-field">
                    <span className="igroup-label">Length</span>
                    <span className="igroup-value">{seg.length_m} m</span>
                  </span>
                )}
                <span className="igroup-field">
                  <span className="igroup-label">Subsegments</span>
                  <span className="igroup-value">{totalSubs}</span>
                </span>
                <span className="igroup-field">
                  <span className="igroup-label">Partitions</span>
                  <span className="igroup-value">{totalParts}</span>
                </span>
                <span className="igroup-field">
                  <span className="igroup-label">Evaluations</span>
                  <span className="igroup-value">{totalDefects}</span>
                </span>
              </div>
            </div>
          </td>
        </tr>
      );

      for (const sub of seg.subsegments) {
        const subDefects = sub.partitions.reduce((n, p) => n + (p.defects?.length || 0), 0);

        // Subsegment header
        const isSubExpanded = expandedSubsegments.has(sub.id);
        rows.push(
          <tr key={`sub-${sub.id}`} className="inspection-group-subsegment-row" onClick={() => toggleSubsegment(sub.id)} style={{ cursor: "pointer" }}>
            <td colSpan={TOTAL_COLS} className="inspection-group-subsegment">
              <div className="igroup-sub-inner">
                <div className="igroup-sub-title">
                  <span className="igroup-subseg-chevron">
                    {isSubExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="igroup-badge sub-badge">SUBSEGMENT</span>
                  <span className="igroup-name">#{sub.subsegment_no}</span>
                </div>
                <div className="igroup-fields">
                  {sub.subsegment_length_m !== "" && (
                    <span className="igroup-field sub-field">
                      <span className="igroup-label">Length</span>
                      <span className="igroup-value">{sub.subsegment_length_m} m</span>
                    </span>
                  )}
                  {sub.lanes !== "" && (
                    <span className="igroup-field sub-field">
                      <span className="igroup-label">Lanes</span>
                      <span className="igroup-value">{sub.lanes}</span>
                    </span>
                  )}
                  {sub.pavement_type && (
                    <span className="igroup-field sub-field">
                      <span className="igroup-label">Pavement</span>
                      <span className="igroup-value">{sub.pavement_type}</span>
                    </span>
                  )}
                  <span className="igroup-field sub-field">
                    <span className="igroup-label">Partitions</span>
                    <span className="igroup-value">{sub.partitions.length}</span>
                  </span>
                  <span className="igroup-field sub-field">
                    <span className="igroup-label">Evaluations</span>
                    <span className="igroup-value">{subDefects}</span>
                  </span>
                </div>
              </div>
            </td>
          </tr>
        );

        if (!isSubExpanded) continue;

        if (sub.partitions.length === 0) {
          rows.push(
            <tr key={`sub-${sub.id}-empty`}>
              <td colSpan={TOTAL_COLS} className="inspection-td inspection-td-empty">No partitions</td>
            </tr>
          );
          continue;
        }

        for (const part of sub.partitions) {
          const defects = part.defects || [];
          const isExpanded = hasAnyFilter
            ? defects.length > 0
            : expandedPartitions.has(part.id);

          // Partition toggle row
          rows.push(
            <tr
              key={`part-${part.id}`}
              className={`inspection-partition-toggle${defects.length > 0 ? " has-defects" : ""}`}
              onClick={() => defects.length > 0 && togglePartition(part.id)}
            >
              <td colSpan={TOTAL_COLS}>
                <div className="igroup-part-inner">
                  <div className="igroup-part-left">
                    <span className="inspection-partition-chevron">
                      {defects.length > 0
                        ? isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        : <span style={{ display: "inline-block", width: 14 }} />}
                    </span>
                    <span className="igroup-badge part-badge">PARTITION</span>
                    <span className="igroup-part-no">#{part.partition_no}</span>
                  </div>
                  <div className="igroup-fields">
                    {part.start_m !== "" && part.end_m !== "" && (
                      <span className="igroup-field part-field">
                        <span className="igroup-label">Range</span>
                        <span className="igroup-value">{part.start_m}m → {part.end_m}m</span>
                      </span>
                    )}
                    {part.partition_m !== "" && (
                      <span className="igroup-field part-field">
                        <span className="igroup-label">Distance</span>
                        <span className="igroup-value">{part.partition_m} m</span>
                      </span>
                    )}
                    {part.distress_no !== "" && (
                      <span className="igroup-field part-field">
                        <span className="igroup-label">Distress No.</span>
                        <span className="igroup-value">{part.distress_no}</span>
                      </span>
                    )}
                  </div>
                  <span className="inspection-partition-badge">
                    {defects.length === 0
                      ? "No evaluations"
                      : `${defects.length} evaluation${defects.length > 1 ? "s" : ""} — click to ${isExpanded ? "collapse" : "expand"}`}
                  </span>
                </div>
              </td>
            </tr>
          );

          // Defect rows
          if (isExpanded && defects.length > 0) {
            // Per-partition column header
            rows.push(
              <tr key={`part-${part.id}-header`} className="inspection-defect-header">
                <th className="inspection-th inspection-th-defect">#</th>
                <th className="inspection-th inspection-th-defect">Lane No.</th>
                <th className="inspection-th inspection-th-defect">Joint</th>
                <th className="inspection-th inspection-th-defect">Item</th>
                <th className="inspection-th inspection-th-defect">Severity</th>
                <th className="inspection-th inspection-th-defect">Length (m)</th>
                <th className="inspection-th inspection-th-defect">Width (m)</th>
                <th className="inspection-th inspection-th-defect">Depth (mm)</th>
                <th className="inspection-th inspection-th-defect">Area (m²)</th>
                <th className="inspection-th inspection-th-defect">Image</th>
                <th className="inspection-th inspection-th-defect">Remarks</th>
              </tr>
            );

            defects.forEach((defect, idx) => {
              const defectKey = `${part.id}-${defect.id}-${idx}`;
              rows.push(
                <tr
                  key={`defect-${defect.id}-${idx}`}
                  className={`inspection-defect-row${selectedDefectKey === defectKey ? " is-selected" : ""}`}
                  onClick={() => setSelectedDefectKey(prev => prev === defectKey ? null : defectKey)}
                >
                  <td className="inspection-td inspection-td-defect inspection-defect-index">#{idx + 1}</td>
                  <td className="inspection-td inspection-td-defect">{defect.lane_no !== "" ? defect.lane_no : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.joint || "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.item || "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.severity || "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.length_m !== "" ? defect.length_m : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.width_m !== "" ? defect.width_m : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.depth_mm !== "" ? defect.depth_mm : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.area_m2 !== "" ? defect.area_m2 : "—"}</td>
                  <td className="inspection-td inspection-td-defect inspection-td-image">
                    {defect.screenshot_path ? (
                      <img
                        className="inspection-defect-thumb"
                        src={`local://${encodeURIComponent(defect.screenshot_path)}`}
                        alt={defect.image_filename}
                        onClick={(e) => { e.stopPropagation(); setLightboxSrc(`local://${encodeURIComponent(defect.screenshot_path)}`); }}
                      />
                    ) : (
                      defect.image_filename || "—"
                    )}
                  </td>
                  <td className="inspection-td inspection-td-defect">{defect.remarks || "—"}</td>
                </tr>
              );
            });
          }
        }
      }
    }

    return rows;
  }

  return (
    <>
    <div className="inspection-page">
      {/* Top bar */}
      <div className="inspection-topbar">
        <div className="inspection-topbar-left">
          <div>
            <div className="inspection-title">Inspection Form</div>
            <div className="inspection-subtitle">Chainage {chainageId} — Project {projectId}</div>
          </div>
        </div>

        <div className="inspection-topbar-right">
          <button className="inspection-btn" onClick={() => navigate(`/projects/${projectId}/chainage/${chainageId}`)}>
            <ArrowLeft size={16} /> Back to Chainage
          </button>
          <button className="inspection-btn inspection-btn-download" onClick={downloadCSV} disabled={loading || segments.length === 0} title="Download CSV">
            <Download size={15} /> CSV
          </button>
          <button className="inspection-btn" onClick={loadData}>
            <RefreshCcw size={15} />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="inspection-filterbar">
        <div className="ifilter-label">FILTER</div>
        <div className="ifilter-grid">
          {[
            { label: "SEGMENT",    value: filterSegment,    set: setFilterSegment,    placeholder: "e.g. K1512" },
            { label: "SUBSEGMENT", value: filterSubsegment, set: setFilterSubsegment, placeholder: "e.g. 1" },
            { label: "PARTITION",  value: filterPartition,  set: setFilterPartition,  placeholder: "e.g. 1" },
            { label: "LANE NO.",   value: filterLaneNo,     set: setFilterLaneNo,     placeholder: "e.g. 1" },
            { label: "JOINT",      value: filterJoint,      set: setFilterJoint,      placeholder: "e.g. Joint 1" },
            { label: "ITEM",       value: filterItem,       set: setFilterItem,       placeholder: "e.g. Potholes" },
            { label: "SEVERITY",   value: filterSeverity,   set: setFilterSeverity,   placeholder: "e.g. Slight" },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label} className="ifilter-col">
              <div className="ifilter-col-label">{label}</div>
              <input
                className="ifilter-input"
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            </div>
          ))}
        </div>
        {hasAnyFilter && (
          <button className="inspection-filter-clear" onClick={clearAllFilters}>
            <X size={13} /> Clear all
          </button>
        )}
      </div>

      <div className="inspection-body">
        {error && (
          <div className="inspection-error">
            ⚠ {error}
            <button className="inspection-btn" onClick={loadData}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="inspection-loading">Loading inspection data…</div>
        ) : filteredSegments.length === 0 ? (
          <div className="inspection-empty">
            {hasAnyFilter ? "No results match the active filters." : "No data available"}
          </div>
        ) : (
          <div className="inspection-table-container">
            <table className="inspection-table">
              <tbody>
                {buildRows()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {lightboxSrc && (
      <div className="inspection-lightbox" onClick={() => setLightboxSrc(null)}>
        <img
          className="inspection-lightbox-img"
          src={lightboxSrc}
          alt="Screenshot"
          onClick={(e) => e.stopPropagation()}
        />
        <button className="inspection-lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
      </div>
    )}
    </>
  );
}
