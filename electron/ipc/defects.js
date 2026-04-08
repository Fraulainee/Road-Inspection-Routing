// electron/ipc/defects.js
const { getPool } = require("../db");

async function createDefect(data) {
  const pool = getPool();
  const {
    partition_id,
    image_filename,
    pavement_type,
    lane_no,
    joint,
    item,
    length_m,
    width_m,
    depth_mm,
    area_m2,
    severity,
    remarks,
    annotations,
    meter_per_px,
    screenshot_path,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO partition_evaluations
      (partition_id, image_filename, pavement_type, lane_no, joint,
       item, length_m, width_m, depth_mm, area_m2, severity,
       remarks, annotations, meter_per_px, screenshot_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      partition_id || null,
      image_filename || null,
      pavement_type || null,
      lane_no || null,
      joint || null,
      item || null,
      length_m || null,
      width_m || null,
      depth_mm || null,
      area_m2 || null,
      severity || null,
      remarks || null,
      annotations ? JSON.stringify(annotations) : null,
      meter_per_px || null,
      screenshot_path || null,
    ]
  );

  return { id: result.insertId, ...data };
}

async function listDefects(partitionId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM partition_evaluations WHERE partition_id = ? ORDER BY created_at ASC`,
    [partitionId]
  );
  return rows;
}

async function deleteDefect(id) {
  const pool = getPool();
  await pool.query(`DELETE FROM partition_evaluations WHERE id = ?`, [id]);
  return { ok: true };
}

module.exports = { createDefect, listDefects, deleteDefect };
