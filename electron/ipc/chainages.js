// electron/ipc/chainages.js
const { getPool } = require("../db");
const fs = require("fs");
const path = require("path");

// Helper function to create chainage folder
async function createChainageFolder(projectFolderPath, chainageName) {
  try {
    if (!projectFolderPath || !fs.existsSync(projectFolderPath)) {
      throw new Error("Project folder does not exist");
    }
    
    // Sanitize chainage name for folder (remove invalid characters)
    const sanitizedName = chainageName.replace(/[<>:"/\\|?*]/g, "_");
    
    // Create chainage folder inside project folder
    const chainageFolderPath = path.join(projectFolderPath, sanitizedName);
    if (!fs.existsSync(chainageFolderPath)) {
      fs.mkdirSync(chainageFolderPath, { recursive: true });
      console.log("Created chainage folder:", chainageFolderPath);
    }
    
    return chainageFolderPath;
  } catch (error) {
    console.error("Error creating chainage folder:", error);
    throw new Error("Failed to create chainage folder: " + error.message);
  }
}

// List all chainages for a project
async function listChainages(projectId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, project_id, name, folder_path, created_at
    FROM chainages
    WHERE project_id = ?
    ORDER BY created_at DESC`,
    [projectId]
  );
  return rows;
}

// Create a new chainage
async function createChainage(chainageData) {
  console.log("createChainage called with:", chainageData);
  
  if (!chainageData || typeof chainageData !== 'object') {
    throw new Error("Invalid chainage data format");
  }
  
  const { projectId, name } = chainageData;
  
  if (!projectId) {
    throw new Error("Project ID is required");
  }
  
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error("Chainage name is required");
  }

  const pool = getPool();
  
  // Get the project folder path first
  const [projectRows] = await pool.query(
    `SELECT folder_path FROM projects WHERE id = ?`,
    [projectId]
  );
  
  if (projectRows.length === 0) {
    throw new Error("Project not found");
  }
  
  const projectFolderPath = projectRows[0].folder_path;
  
  // Create the chainage folder
  const chainageFolderPath = await createChainageFolder(projectFolderPath, name.trim());
  
  // Insert chainage into database
  const [result] = await pool.query(
    `INSERT INTO chainages (project_id, name, folder_path)
    VALUES (?, ?, ?)`,
    [projectId, name.trim(), chainageFolderPath]
  );

  console.log("✅ Chainage created with folder:", chainageFolderPath);

  return {
    id: result.insertId,
    project_id: projectId,
    name: name.trim(),
    folder_path: chainageFolderPath,
    created_at: new Date()
  };
}

// Delete a chainage
async function deleteChainage(id) {
  const pool = getPool();
  
  // Get the folder path before deleting
  const [rows] = await pool.query(
    `SELECT folder_path FROM chainages WHERE id = ?`,
    [id]
  );
  
  // Delete from database
  await pool.query(`DELETE FROM chainages WHERE id = ?`, [id]);
  
  // ✅ OPTIONAL: Delete the folder too (uncomment if you want this)
  // if (rows.length > 0 && rows[0].folder_path) {
  //   try {
  //     fs.rmSync(rows[0].folder_path, { recursive: true, force: true });
  //     console.log("Deleted chainage folder:", rows[0].folder_path);
  //   } catch (error) {
  //     console.error("Error deleting folder:", error);
  //   }
  // }
  
  return true;
}

module.exports = {
  listChainages,
  createChainage,
  deleteChainage,
};