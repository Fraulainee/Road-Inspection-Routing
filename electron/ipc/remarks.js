// electron/ipc/remarks.js
const { getPool } = require("../db");

// One row per severity level – matches remarks_lookup DB schema:
// id | pavement_type | item | rocond_scale | severity_levels | severity_guide | measurement_method | created_at
const SEED_DATA = [
  // ─── ASPHALT ───────────────────────────────────────────────────────────────
  ["Asphalt", "Longitudinal Cracking", null, "Narrow", "Fine cracks with small width (generally hairline to small width per crack scale). No spalling or breakup.", "Measured per 100m"],
  ["Asphalt", "Longitudinal Cracking", null, "Wide", "Visible open cracks with larger width, may allow water ingress and minor edge deterioration. Measured per 100m, assumed 0.5m affected width.", "Measured per 100m"],
  ["Asphalt", "Crocodile Cracking", null, "Narrow", "Interconnected cracks forming pattern but tight, no breakup.", "Measured per 100m"],
  ["Asphalt", "Crocodile Cracking", null, "Wide", "Open interconnected cracks with breakup, possible loose pieces; structural fatigue indication. Width recorded (0.5m–lane width).", "Measured per 100m"],
  ["Asphalt", "Transverse Cracking", null, "Narrow", "Fine cracks across lane, minimal separation.", "Measured per 100m"],
  ["Asphalt", "Transverse Cracking", null, "Wide", "Open cracks across lane, noticeable gap, possible edge spalling. Measured per 100m, 0.5m nominal width.", "Measured per 100m"],
  ["Asphalt", "Edge Break", null, "Slight", "Minor edge fretting or small loss of material along pavement edge.", "Measured per 100m"],
  ["Asphalt", "Edge Break", null, "Moderate", "Noticeable edge loss, some deformation.", "Measured per 100m"],
  ["Asphalt", "Edge Break", null, "Large", "Severe edge failure, major material loss, deformation or drop-off.", "Measured per 100m"],
  ["Asphalt", "Patches", null, "Slight", "Patch flush with surface, good bonding.", "Measured per 100m"],
  ["Asphalt", "Patches", null, "Moderate", "Slight unevenness, minor settlement.", "Measured per 100m"],
  ["Asphalt", "Patches", null, "Large", "Poor condition patch, uneven, cracked, or failing. Only permanent repairs recorded.", "Measured per 100m"],
  ["Asphalt", "Potholes", null, "Slight", "Small potholes, shallow, limited number.", "Counted as equivalent 0.25 m² units per 100m"],
  ["Asphalt", "Potholes", null, "Moderate", "Medium-sized potholes affecting ride quality.", "Counted as equivalent 0.25 m² units per 100m"],
  ["Asphalt", "Potholes", null, "Large", "Deep or widespread potholes, possible base failure.", "Counted as equivalent 0.25 m² units per 100m"],
  ["Asphalt", "Wearing Surface", null, "Minor", "Surface texture loss, slight raveling or bleeding but structurally intact.", "Measured per 100m by width (0.5m to lane width)"],
  ["Asphalt", "Wearing Surface", null, "Severe", "Extensive raveling, flushing, polishing, or aggregate loss affecting skid resistance.", "Measured per 100m by width (0.5m to lane width)"],
  ["Asphalt", "Rutting – Positive Direction (Outer)", null, "Depth in mm", "Measured every 10m over first 50m gauging length (outer & inner wheel paths). Severity based on measured rut depth using straightedge and wedge.", "Measured in mm"],
  ["Asphalt", "Rutting – Positive Direction (Inner)", null, "Depth in mm", "Same method as above (50m gauging length). Outer lanes normally assessed unless widening condition dictates otherwise.", "Measured in mm"],
  ["Asphalt", "Rutting – Negative Direction", null, "Depth in mm", "Same measurement method; recorded in mm. Compare across 5 points within 50m gauging length.", "Measured in mm"],
  ["Asphalt", "Surface Failure", null, "Number", "Count number of failures equivalent to 0.25 m² each per 100m. Includes localized surface breakdown not yet classified as pothole.", "Count per 100m"],

  // ─── CONCRETE ──────────────────────────────────────────────────────────────
  ["Concrete", "Longitudinal Cracking", null, "Narrow", "Fine crack, small width, tight, no significant spalling.", "Measured per 100m, 0.5m nominal width"],
  ["Concrete", "Longitudinal Cracking", null, "Wide", "Open crack with visible separation, possible minor edge deterioration.", "Measured per 100m, 0.5m nominal width"],
  ["Concrete", "Multiple Cracking", null, "Minor", "Several cracks within slab but slab remains intact.", "Measured per 100m by lane width"],
  ["Concrete", "Multiple Cracking", null, "Severe", "Extensive cracking pattern, slab integrity compromised but not shattered.", "Measured per 100m by lane width"],
  ["Concrete", "Transverse Cracking", null, "Narrow", "Tight transverse crack across slab with minimal separation.", "Measured per 100m"],
  ["Concrete", "Transverse Cracking", null, "Wide", "Open transverse crack with visible gap or slight spalling.", "Measured per 100m"],
  ["Concrete", "Joint Faulting", null, "Measured in mm", "Vertical displacement between adjacent slabs measured in millimeters using straightedge and wedge.", "Measured over first 10 slabs (1 lane only)"],
  ["Concrete", "Joint Spalling", null, "Measured in mm", "Breakage or chipping along joint edges. Record width (mm) and length (m).", "Measured over first 10 slabs"],
  ["Concrete", "Joint Sealant Deterioration", null, "Measured in length", "Missing, cracked, hardened, or ineffective sealant allowing water infiltration.", "Measured over first 10 slabs"],
  ["Concrete", "Shattered Slab", null, "Count", "Slab broken into multiple pieces with structural failure.", "Measured per 100m"],
  ["Concrete", "Wearing Surface", null, "Minor", "Minor surface deterioration.", "Measured per 100m by lane width"],
  ["Concrete", "Wearing Surface", null, "Severe", "Severe surface deterioration affecting ride quality.", "Measured per 100m by lane width"],

  // ─── GRAVEL ────────────────────────────────────────────────────────────────
  ["Gravel", "Gravel Thickness", "1", null, "Adequate gravel thickness, no subgrade exposure.", "Rated every 100m over whole segment"],
  ["Gravel", "Gravel Thickness", "2", null, "Slight thinning, minor weak spots.", "Rated every 100m over whole segment"],
  ["Gravel", "Gravel Thickness", "3", null, "Thin gravel layer, occasional subgrade exposure.", "Rated every 100m over whole segment"],
  ["Gravel", "Gravel Thickness", "4", null, "Gravel mostly lost, widespread subgrade exposure.", "Rated every 100m over whole segment"],
  ["Gravel", "Gravel Quality", "1", null, "Well-graded, stable, properly bound surface.", "Rated every 100m over whole segment"],
  ["Gravel", "Gravel Quality", "2", null, "Slight segregation or loose particles.", "Rated every 100m over whole segment"],
  ["Gravel", "Gravel Quality", "3", null, "Noticeable loose or unstable material.", "Rated every 100m over whole segment"],
  ["Gravel", "Gravel Quality", "4", null, "Poor gradation, excessive fines or oversized stones causing instability.", "Rated every 100m over whole segment"],
  ["Gravel", "Crown Shape", "1", null, "Proper camber, effective drainage.", "Rated every 100m over whole segment"],
  ["Gravel", "Crown Shape", "2", null, "Slight flattening but still drains.", "Rated every 100m over whole segment"],
  ["Gravel", "Crown Shape", "3", null, "Reduced crown, minor ponding observed.", "Rated every 100m over whole segment"],
  ["Gravel", "Crown Shape", "4", null, "No crown or reverse crown, severe drainage problem.", "Rated every 100m over whole segment"],
  ["Gravel", "Roadside Drainage", "1", null, "Drains clear and functional.", "Rated every 100m over whole segment"],
  ["Gravel", "Roadside Drainage", "2", null, "Minor obstruction but functional.", "Rated every 100m over whole segment"],
  ["Gravel", "Roadside Drainage", "3", null, "Partial blockage, reduced flow.", "Rated every 100m over whole segment"],
  ["Gravel", "Roadside Drainage", "4", null, "Blocked or non-functional drains affecting roadway.", "Rated every 100m over whole segment"],
];

// Create table and seed if empty – runs once on app start
async function seedRemarksTable() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS remarks (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      pavement_type      VARCHAR(50)  NOT NULL,
      item               VARCHAR(150) NOT NULL,
      rocond_scale       VARCHAR(50)  NULL,
      severity_levels    VARCHAR(255) NULL,
      severity_guide     TEXT         NULL,
      measurement_method TEXT         NULL,
      created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lookup (pavement_type, item(50))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[{ cnt }]] = await pool.query("SELECT COUNT(*) AS cnt FROM remarks");
  if (Number(cnt) > 0) {
    console.log("Remarks table already seeded.");
    return;
  }

  await pool.query(
    `INSERT INTO remarks (pavement_type, item, rocond_scale, severity_levels, severity_guide, measurement_method) VALUES ?`,
    [SEED_DATA]
  );
  console.log(`✅ Remarks table seeded with ${SEED_DATA.length} rows.`);
}

// Lookup by pavement_type + item + severity
// Asphalt/Concrete → matches severity_levels column
// Gravel           → matches rocond_scale column
async function lookupRemark(pavementType, item, severity) {
  if (!pavementType || !item || !severity) return null;
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT severity_guide, measurement_method
     FROM remarks
     WHERE pavement_type = ? AND item = ?
       AND (severity_levels = ? OR rocond_scale = ?)
     LIMIT 1`,
    [pavementType, item, severity, severity]
  );

  return rows[0] || null;
}

module.exports = { seedRemarksTable, lookupRemark };
