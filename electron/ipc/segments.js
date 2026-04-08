// electron/ipc/segments.js
const path = require("path");
const fs = require("fs");
const { getPool } = require("../db"); // adjust to your db helper

function safeFolderName(name) {
  return String(name)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function listSegments(chainageId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, chainage_id, name, segmentSubName, folder_path, 
            segmentStart, segmentEnd, length_m, 
            created_at, updated_at
     FROM segments
     WHERE chainage_id = ?
     ORDER BY created_at DESC`,
    [chainageId]
  );
  return rows;
}

async function createSegment({ chainageId, name, segmentSubName, segmentStart, segmentEnd, length_m }) {
  console.log("segments.createSegment chainageId =", chainageId);
  const pool = getPool();

  // 1) get chainage folder path
  const [chainRows] = await pool.query(
    `SELECT folder_path FROM chainages WHERE id = ?`,
    [chainageId]
  );
  if (!chainRows.length || !chainRows[0].folder_path) {
    throw new Error("Chainage folder_path not found. Cannot create segment folder.");
  }

  const chainageFolder = chainRows[0].folder_path;

  // 2) create segment folder inside chainage folder
  const folderName = safeFolderName(name);
  const segmentFolder = path.join(chainageFolder, folderName);
  fs.mkdirSync(segmentFolder, { recursive: true });

  // 3) insert db record with ALL fields
  const [result] = await pool.query(
    `INSERT INTO segments (chainage_id, name, segmentSubName, folder_path, segmentStart, segmentEnd, length_m)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [chainageId, name, segmentSubName || null, segmentFolder, segmentStart || null, segmentEnd || null, length_m || null]
  );

  // 4) return inserted row with ALL columns
  const [rows] = await pool.query(
    `SELECT id, chainage_id, name, segmentSubName, folder_path,
            segmentStart, segmentEnd, length_m,
            created_at, updated_at
     FROM segments WHERE id = ?`,
    [result.insertId]
  );
  return rows[0];
}

async function updateSegment({ id, segmentStart, segmentEnd, length_m }) {
  const pool = getPool();
  
  await pool.query(
    `UPDATE segments 
     SET segmentStart = ?, segmentEnd = ?, length_m = ?
     WHERE id = ?`,
    [segmentStart || null, segmentEnd || null, length_m || null, id]
  );

  // Return updated row
  const [rows] = await pool.query(
    `SELECT id, chainage_id, name, segmentSubName, folder_path,
            segmentStart, segmentEnd, length_m,
            created_at, updated_at
     FROM segments WHERE id = ?`,
    [id]
  );
  return rows[0];
}

async function deleteSegment(id) {
  const pool = getPool();

  await pool.query(`DELETE FROM segments WHERE id = ?`, [id]);

  // optional: remove folder from disk too (careful!):
  // const [rows] = await pool.query(`SELECT folder_path FROM segments WHERE id = ?`, [id]);
  // if (rows?.[0]?.folder_path) fs.rmSync(rows[0].folder_path, { recursive: true, force: true });

  return { ok: true };
}

module.exports = { listSegments, createSegment, updateSegment, deleteSegment };