// electron/ipc/subsegments.js
const { getPool } = require("../db");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const FORM_DIR = path.join(__dirname, "..", "..", "Form");

const PYTHON_SCRIPT = {
  Asphalt: path.join(FORM_DIR, "asphalt.py"),
  Concrete: path.join(FORM_DIR, "concrete.py"),
  Gravel: path.join(FORM_DIR, "gravel.py"),
};

function runFormScript(pavementType, outputPath, segmentLength, projectInfo = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = PYTHON_SCRIPT[pavementType];
    if (!scriptPath) {
      // No script for this pavement type (e.g. "Other") — skip
      return resolve(null);
    }

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const args = [
      scriptPath,
      "--output", outputPath,
      "--segment_length", String(segmentLength || ""),
      "--region",   String(projectInfo.region   || ""),
      "--road_id",  String(projectInfo.road_id  || ""),
      "--road_name", String(projectInfo.road_name || ""),
      "--section_id", String(projectInfo.section_id || ""),
      "--district", String(projectInfo.c_district || ""),
      "--date",     String(projectInfo.survey_date || ""),
      "--rater",    String(projectInfo.surveyor_name || ""),
    ];

    const proc = spawn(pythonCmd, args);

    proc.stderr.on("data", (d) => console.error("[python]", d.toString()));

    proc.on("close", (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`Python script exited with code ${code}`));
    });

    proc.on("error", reject);
  });
}

// Helper function to create subsegment folder
async function createSubsegmentFolder(segmentFolderPath, subsegmentNo) {
  try {
    if (!segmentFolderPath || !fs.existsSync(segmentFolderPath)) {
      throw new Error("Segment folder does not exist");
    }
    
    // Sanitize subsegment name for folder
    const sanitizedName = `Subsegment_${subsegmentNo}`;
    
    // Create subsegment folder inside segment folder
    const subsegmentFolderPath = path.join(segmentFolderPath, sanitizedName);
    if (!fs.existsSync(subsegmentFolderPath)) {
      fs.mkdirSync(subsegmentFolderPath, { recursive: true });
      console.log("Created subsegment folder:", subsegmentFolderPath);
    }
    
    return subsegmentFolderPath;
  } catch (error) {
    console.error("Error creating subsegment folder:", error);
    throw new Error("Failed to create subsegment folder: " + error.message);
  }
}

// List all subsegments for a segment
async function listSubsegments(segmentId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, segment_id, subsegment_no, folder_path,
            subsegment_length_m, lanes, pavement_type, created_at
     FROM subsegments
     WHERE segment_id = ?
     ORDER BY subsegment_no ASC`,
    [segmentId]
  );
  return rows;
}

// Create a new subsegment
async function createSubsegment(subsegmentData) {
  console.log("createSubsegment called with:", subsegmentData);
  
  if (!subsegmentData || typeof subsegmentData !== 'object') {
    throw new Error("Invalid subsegment data format");
  }
  
  const { segmentId, subsegment_no, subsegment_length_m, lanes, pavement_type } = subsegmentData;
  
  if (!segmentId) {
    throw new Error("Segment ID is required");
  }

  const pool = getPool();
  
  // Get the segment folder path first
  const [segmentRows] = await pool.query(
    `SELECT folder_path FROM segments WHERE id = ?`,
    [segmentId]
  );
  
  if (segmentRows.length === 0) {
    throw new Error("Segment not found");
  }
  
  const segmentFolderPath = segmentRows[0].folder_path;

  // Get project info by joining segment → chainage → project
  const [projectRows] = await pool.query(
    `SELECT p.region, p.road_id, p.road_name, p.section_id, p.c_district,
            p.survey_date, p.surveyor_name
     FROM segments s
     JOIN chainages c ON s.chainage_id = c.id
     JOIN projects p ON c.project_id = p.id
     WHERE s.id = ?`,
    [segmentId]
  );
  const projectInfo = projectRows[0] || {};

  // Auto-generate subsegment number if not provided
  let subsegmentNo = subsegment_no;
  if (!subsegmentNo) {
    const [countRows] = await pool.query(
      `SELECT COALESCE(MAX(subsegment_no), 0) + 1 as next_no
       FROM subsegments
       WHERE segment_id = ?`,
      [segmentId]
    );
    subsegmentNo = countRows[0].next_no;
  }
  
  // Create the subsegment folder
  const subsegmentFolderPath = await createSubsegmentFolder(segmentFolderPath, subsegmentNo);

  // Run the appropriate Python script to generate the Excel inspection form
  const excelFileName = `Subsegment_${subsegmentNo}_${pavement_type || "form"}.xlsx`;
  const excelFilePath = path.join(subsegmentFolderPath, excelFileName);
  try {
    await runFormScript(pavement_type, excelFilePath, subsegment_length_m, projectInfo);
    console.log("✅ Excel form created:", excelFilePath);
  } catch (e) {
    console.error("⚠️ Excel form creation failed (subsegment still saved):", e.message);
  }

  // Insert subsegment into database
  const [result] = await pool.query(
    `INSERT INTO subsegments (segment_id, subsegment_no, folder_path, subsegment_length_m, lanes, pavement_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      segmentId, 
      subsegmentNo, 
      subsegmentFolderPath,
      subsegment_length_m || null,
      lanes || null,
      pavement_type || null
    ]
  );

  console.log("✅ Subsegment created with folder:", subsegmentFolderPath);

  return {
    id: result.insertId,
    segment_id: segmentId,
    subsegment_no: subsegmentNo,
    folder_path: subsegmentFolderPath,
    subsegment_length_m,
    lanes,
    pavement_type,
    created_at: new Date()
  };
}

// Update a subsegment
async function updateSubsegment(subsegmentData) {
  const pool = getPool();
  
  const { id, subsegment_length_m, lanes, pavement_type } = subsegmentData;
  
  if (!id) {
    throw new Error("Subsegment ID is required for update");
  }
  
  await pool.query(
    `UPDATE subsegments 
     SET subsegment_length_m = ?, lanes = ?, pavement_type = ?
     WHERE id = ?`,
    [subsegment_length_m || null, lanes || null, pavement_type || null, id]
  );

  // Return updated row
  const [rows] = await pool.query(
    `SELECT id, segment_id, subsegment_no, folder_path,
            subsegment_length_m, lanes, pavement_type, created_at
     FROM subsegments WHERE id = ?`,
    [id]
  );
  return rows[0];
}

// Delete a subsegment
async function deleteSubsegment(id) {
  const pool = getPool();
  
  // Get the folder path before deleting
  const [_rows] = await pool.query(
    `SELECT folder_path FROM subsegments WHERE id = ?`,
    [id]
  );
  
  // Delete from database
  await pool.query(`DELETE FROM subsegments WHERE id = ?`, [id]);
  
  // ✅ OPTIONAL: Delete the folder too (uncomment if you want this)
  // if (rows.length > 0 && rows[0].folder_path) {
  //   try {
  //     fs.rmSync(rows[0].folder_path, { recursive: true, force: true });
  //     console.log("Deleted subsegment folder:", rows[0].folder_path);
  //   } catch (error) {
  //     console.error("Error deleting folder:", error);
  //   }
  // }
  
  return true;
}

module.exports = {
  listSubsegments,
  createSubsegment,
  updateSubsegment,
  deleteSubsegment,
};