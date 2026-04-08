import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCcw, Search, X, ChevronDown, ChevronRight, Download } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPavement, setFilterPavement] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [expandedPartitions, setExpandedPartitions] = useState(new Set());

  const hasAnyFilter = searchTerm.trim() || filterPavement || filterItem || filterSeverity;

  function clearAllFilters() {
    setSearchTerm("");
    setFilterPavement("");
    setFilterItem("");
    setFilterSeverity("");
  }

  function downloadCSV() {
    const headers = [
      "Segment Name", "Segment Start", "Segment End", "Segment Length (m)",
      "Subsegment No.", "Subsegment Length (m)", "Lanes", "Pavement Type",
      "Partition No.", "Partition Start (m)", "Partition End (m)", "Partition Distance (m)", "Distress No.",
      "#", "Image", "Lane No.", "Joint", "Item", "Severity",
      "Length (m)", "Width (m)", "Depth (mm)", "Area (m²)", "Remarks",
    ];

    const esc = (v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

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
              rows.push([
                ...segCols, ...subCols, ...partCols,
                i + 1, d.image_filename, d.lane_no, d.joint, d.item, d.severity,
                d.length_m, d.width_m, d.depth_mm, d.area_m2, d.remarks,
              ].map(esc).join(","));
            });
          }
        }
      }
    }

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inspection_segment${segmentId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Derive dropdown options from loaded data
  const pavementOptions = useMemo(() => {
    const s = new Set();
    segments.forEach(seg => seg.subsegments?.forEach(sub => { if (sub.pavement_type) s.add(sub.pavement_type); }));
    return [...s].sort();
  }, [segments]);

  const itemOptions = useMemo(() => {
    const s = new Set();
    segments.forEach(seg => seg.subsegments?.forEach(sub => {
      if (filterPavement && sub.pavement_type !== filterPavement) return;
      sub.partitions?.forEach(part => part.defects?.forEach(d => { if (d.item) s.add(d.item); }));
    }));
    return [...s].sort();
  }, [segments, filterPavement]);

  const severityOptions = useMemo(() => {
    const s = new Set();
    segments.forEach(seg => seg.subsegments?.forEach(sub => {
      if (filterPavement && sub.pavement_type !== filterPavement) return;
      sub.partitions?.forEach(part => part.defects?.forEach(d => {
        if (filterItem && d.item !== filterItem) return;
        if (d.severity) s.add(d.severity);
      }));
    }));
    return [...s].sort();
  }, [segments, filterPavement, filterItem]);

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
      const allSegments = await window.api.listSegments(Number(chainageId));
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
      // Auto-expand all partitions
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
    const term = searchTerm.toLowerCase().trim();

    return segments.map((seg) => {
      const segMatches = !term || seg.name?.toLowerCase().includes(term);

      const filteredSubs = seg.subsegments.map((sub) => {
        // Pavement filter is an exact match at the subsegment level
        if (filterPavement && sub.pavement_type !== filterPavement) return null;

        const subMatches = !term || (
          String(sub.subsegment_no).includes(term) ||
          sub.pavement_type?.toLowerCase().includes(term)
        );

        const filteredParts = sub.partitions.reduce((acc, part) => {
          const partTextMatches = !term || (
            String(part.partition_no).includes(term) ||
            part.item?.toLowerCase().includes(term) ||
            part.severity?.toLowerCase().includes(term) ||
            String(part.lane_no).toLowerCase().includes(term) ||
            part.joint?.toLowerCase().includes(term)
          );

          const filteredDefects = (part.defects || []).filter((d) => {
            if (filterItem && d.item !== filterItem) return false;
            if (filterSeverity && d.severity !== filterSeverity) return false;
            if (!term) return true;
            return (
              d.image_filename?.toLowerCase().includes(term) ||
              d.item?.toLowerCase().includes(term) ||
              d.severity?.toLowerCase().includes(term) ||
              d.remarks?.toLowerCase().includes(term) ||
              String(d.lane_no).toLowerCase().includes(term) ||
              d.joint?.toLowerCase().includes(term)
            );
          });

          const hasDropdownFilter = filterItem || filterSeverity;
          if (hasDropdownFilter) {
            if (filteredDefects.length > 0) acc.push({ ...part, defects: filteredDefects });
          } else if (partTextMatches || filteredDefects.length > 0) {
            acc.push({
              ...part,
              defects: filteredDefects.length > 0 ? filteredDefects : partTextMatches ? part.defects : [],
            });
          }
          return acc;
        }, []);

        if (subMatches || filteredParts.length > 0) {
          const noDefectFilter = !filterItem && !filterSeverity;
          return {
            ...sub,
            partitions: filteredParts.length > 0 ? filteredParts : (subMatches && noDefectFilter ? sub.partitions : []),
          };
        }
        return null;
      }).filter(Boolean);

      if (segMatches || filteredSubs.length > 0) {
        const noDropdownFilter = !filterPavement && !filterItem && !filterSeverity;
        return {
          ...seg,
          subsegments: filteredSubs.length > 0 ? filteredSubs : (segMatches && noDropdownFilter ? seg.subsegments : []),
        };
      }
      return null;
    }).filter(Boolean);
  }, [segments, searchTerm, filterPavement, filterItem, filterSeverity, hasAnyFilter]);

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
        rows.push(
          <tr key={`sub-${sub.id}`}>
            <td colSpan={TOTAL_COLS} className="inspection-group-subsegment">
              <div className="igroup-sub-inner">
                <div className="igroup-sub-title">
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
          if (isExpanded) {
            // Per-partition column header
            rows.push(
              <tr key={`part-${part.id}-header`} className="inspection-defect-header">
                <th className="inspection-th inspection-th-defect">#</th>
                <th className="inspection-th inspection-th-defect">Image</th>
                <th className="inspection-th inspection-th-defect">Lane No.</th>
                <th className="inspection-th inspection-th-defect">Joint</th>
                <th className="inspection-th inspection-th-defect">Item</th>
                <th className="inspection-th inspection-th-defect">Severity</th>
                <th className="inspection-th inspection-th-defect">Length (m)</th>
                <th className="inspection-th inspection-th-defect">Width (m)</th>
                <th className="inspection-th inspection-th-defect">Depth (mm)</th>
                <th className="inspection-th inspection-th-defect">Area (m²)</th>
                <th className="inspection-th inspection-th-defect">Remarks</th>
              </tr>
            );

            defects.forEach((defect, idx) => {
              rows.push(
                <tr key={`defect-${defect.id}-${idx}`} className="inspection-defect-row">
                  <td className="inspection-td inspection-td-defect inspection-defect-index">#{idx + 1}</td>
                  <td className="inspection-td inspection-td-defect">{defect.image_filename || "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.lane_no !== "" ? defect.lane_no : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.joint || "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.item || "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.severity || "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.length_m !== "" ? defect.length_m : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.width_m !== "" ? defect.width_m : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.depth_mm !== "" ? defect.depth_mm : "—"}</td>
                  <td className="inspection-td inspection-td-defect">{defect.area_m2 !== "" ? defect.area_m2 : "—"}</td>
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
    <div className="inspection-page">
      {/* Top bar */}
      <div className="inspection-topbar">
        <div className="inspection-topbar-left">
          <button className="inspection-btn" onClick={() => navigate(`/projects/${projectId}/chainage/${chainageId}`)}>
            <ArrowLeft size={16} /> Back to Chainage
          </button>
          <div>
            <div className="inspection-title">Inspection Form</div>
            <div className="inspection-subtitle">Chainage {chainageId} — Project {projectId}</div>
          </div>
        </div>

        <div className="inspection-topbar-right">
          <div className="inspection-search-wrapper">
            <Search size={16} className="inspection-search-icon" />
            <input
              type="text"
              placeholder="Search segment, partition, item, lane, joint, image..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="inspection-search-input"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="inspection-search-clear">
                <X size={16} />
              </button>
            )}
          </div>
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
        <div className="inspection-filters">
          <select
            className="inspection-filter-select"
            value={filterPavement}
            onChange={(e) => { setFilterPavement(e.target.value); setFilterItem(""); setFilterSeverity(""); }}
          >
            <option value="">All Pavement Types</option>
            {pavementOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            className="inspection-filter-select"
            value={filterItem}
            onChange={(e) => { setFilterItem(e.target.value); setFilterSeverity(""); }}
            disabled={itemOptions.length === 0}
          >
            <option value="">All Items</option>
            {itemOptions.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>

          <select
            className="inspection-filter-select"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            disabled={severityOptions.length === 0}
          >
            <option value="">All Severities</option>
            {severityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {hasAnyFilter && (
            <button className="inspection-filter-clear" onClick={clearAllFilters}>
              <X size={13} /> Clear all
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasAnyFilter && (
          <div className="inspection-active-chips">
            {filterPavement && (
              <span className="inspection-chip">
                Pavement: <strong>{filterPavement}</strong>
                <button onClick={() => { setFilterPavement(""); setFilterItem(""); setFilterSeverity(""); }}><X size={11} /></button>
              </span>
            )}
            {filterItem && (
              <span className="inspection-chip">
                Item: <strong>{filterItem}</strong>
                <button onClick={() => { setFilterItem(""); setFilterSeverity(""); }}><X size={11} /></button>
              </span>
            )}
            {filterSeverity && (
              <span className="inspection-chip">
                Severity: <strong>{filterSeverity}</strong>
                <button onClick={() => setFilterSeverity("")}><X size={11} /></button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inspection-chip">
                Search: <strong>"{searchTerm}"</strong>
                <button onClick={() => setSearchTerm("")}><X size={11} /></button>
              </span>
            )}
          </div>
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
  );
}
