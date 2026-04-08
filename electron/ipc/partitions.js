// electron/ipc/partitions.js
const { getPool } = require("../db");
const fs = require("fs");
const path = require("path");

// Helper function to create partition folder
async function createPartitionFolder(subsegmentFolderPath, partitionNo) {
  try {
    if (!subsegmentFolderPath || !fs.existsSync(subsegmentFolderPath)) {
      throw new Error("Subsegment folder does not exist");
    }
    
    // Sanitize partition name for folder
    const sanitizedName = `Partition_${partitionNo}`;
    
    // Create partition folder inside subsegment folder
    const partitionFolderPath = path.join(subsegmentFolderPath, sanitizedName);
    if (!fs.existsSync(partitionFolderPath)) {
      fs.mkdirSync(partitionFolderPath, { recursive: true });
      console.log("Created partition folder:", partitionFolderPath);
    }
    
    return partitionFolderPath;
  } catch (error) {
    console.error("Error creating partition folder:", error);
    throw new Error("Failed to create partition folder: " + error.message);
  }
}

// List all partitions for a subsegment
async function listPartitions(subsegmentId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, subsegment_id, partition_no, folder_path,
            start_m, end_m, partition_m, distress_no, lane_no,
            item, length_m, width_m, depth_mm, area_m2,
            severity, joint, image_folder, ai_folder, created_at
     FROM partitions
     WHERE subsegment_id = ?
     ORDER BY partition_no ASC`,
    [subsegmentId]
  );
  return rows;
}

// Create a new partition
async function createPartition(partitionData) {
  console.log("createPartition called with:", partitionData);
  
  if (!partitionData || typeof partitionData !== 'object') {
    throw new Error("Invalid partition data format");
  }
  
  const {
    subsegmentId,
    partition_no,
    start_m,
    end_m,
    partition_m,
    distress_no,
    lane_no,
    item,
    length_m,
    width_m,
    depth_mm,
    area_m2,
    severity,
    joint,
    image_folder,
    ai_folder
  } = partitionData;
  
  if (!subsegmentId) {
    throw new Error("Subsegment ID is required");
  }

  const pool = getPool();
  
  // Get the subsegment folder path first
  const [subsegmentRows] = await pool.query(
    `SELECT folder_path FROM subsegments WHERE id = ?`,
    [subsegmentId]
  );
  
  if (subsegmentRows.length === 0) {
    throw new Error("Subsegment not found");
  }
  
  const subsegmentFolderPath = subsegmentRows[0].folder_path;
  
  // Auto-generate partition number if not provided
  let partitionNo = partition_no;
  if (!partitionNo) {
    const [countRows] = await pool.query(
      `SELECT COALESCE(MAX(partition_no), 0) + 1 as next_no
       FROM partitions
       WHERE subsegment_id = ?`,
      [subsegmentId]
    );
    partitionNo = countRows[0].next_no;
  }
  
  // Create the partition folder
  const partitionFolderPath = await createPartitionFolder(subsegmentFolderPath, partitionNo);
  
  // Insert partition into database
  const [result] = await pool.query(
    `INSERT INTO partitions (
      subsegment_id, partition_no, folder_path,
      start_m, end_m, partition_m, distress_no, lane_no,
      item, length_m, width_m, depth_mm, area_m2,
      severity, joint, image_folder, ai_folder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      subsegmentId,
      partitionNo,
      partitionFolderPath,
      start_m || null,
      end_m || null,
      partition_m || null,
      distress_no || null,
      lane_no || null,
      item || null,
      length_m || null,
      width_m || null,
      depth_mm || null,
      area_m2 || null,
      severity || null,
      joint || null,
      image_folder || null,
      ai_folder || null
    ]
  );

  console.log("✅ Partition created with folder:", partitionFolderPath);

  return {
    id: result.insertId,
    subsegment_id: subsegmentId,
    partition_no: partitionNo,
    folder_path: partitionFolderPath,
    start_m,
    end_m,
    partition_m,
    distress_no,
    lane_no,
    item,
    length_m,
    width_m,
    depth_mm,
    area_m2,
    severity,
    joint,
    image_folder,
    ai_folder,
    created_at: new Date()
  };
}

// Update a partition
async function updatePartition(partitionData) {
  const pool = getPool();

  const {
    id,
    start_m,
    end_m,
    partition_m,
    distress_no,
    lane_no,
    item,
    length_m,
    width_m,
    depth_mm,
    area_m2,
    severity,
    joint,
    image_folder,
    ai_folder
  } = partitionData;
  
  if (!id) {
    throw new Error("Partition ID is required for update");
  }
  
  await pool.query(
    `UPDATE partitions
     SET start_m = ?, end_m = ?, partition_m = ?,
         distress_no = ?, lane_no = ?, item = ?,
         length_m = ?, width_m = ?, depth_mm = ?,
         area_m2 = ?, severity = ?, joint = ?,
         image_folder = ?, ai_folder = ?
     WHERE id = ?`,
    [
      start_m || null,
      end_m || null,
      partition_m || null,
      distress_no || null,
      lane_no || null,
      item || null,
      length_m || null,
      width_m || null,
      depth_mm || null,
      area_m2 || null,
      severity || null,
      joint || null,
      image_folder || null,
      ai_folder || null,
      id
    ]
  );

  // Return updated row
  const [rows] = await pool.query(
    `SELECT id, subsegment_id, partition_no, folder_path,
            start_m, end_m, partition_m, distress_no, lane_no,
            item, length_m, width_m, depth_mm, area_m2,
            severity, joint, image_folder, ai_folder, created_at
     FROM partitions WHERE id = ?`,
    [id]
  );
  return rows[0];
}

// Delete a partition
async function deletePartition(id) {
  const pool = getPool();
  
  // Get the folder path before deleting
  const [rows] = await pool.query(
    `SELECT folder_path FROM partitions WHERE id = ?`,
    [id]
  );
  
  // Delete from database
  await pool.query(`DELETE FROM partitions WHERE id = ?`, [id]);
  
  // ✅ OPTIONAL: Delete the folder too (uncomment if you want this)
  // if (rows.length > 0 && rows[0].folder_path) {
  //   try {
  //     fs.rmSync(rows[0].folder_path, { recursive: true, force: true });
  //     console.log("Deleted partition folder:", rows[0].folder_path);
  //   } catch (error) {
  //     console.error("Error deleting folder:", error);
  //   }
  // }
  
  return true;
}

module.exports = {
  listPartitions,
  createPartition,
  updatePartition,
  deletePartition,
};