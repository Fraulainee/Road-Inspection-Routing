// electron/ipc/projects.js
const { getPool } = require("../db");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Helper function to create project folder
async function createProjectFolder(projectName) {
  try {
    // Get the Documents folder path
    const documentsPath = path.join(os.homedir(), "Documents");
    
    // Create Road Inspection folder if it doesn't exist
    const roadInspectionPath = path.join(documentsPath, "Road Inspection");
    if (!fs.existsSync(roadInspectionPath)) {
      fs.mkdirSync(roadInspectionPath, { recursive: true });
      console.log("Created Road Inspection folder:", roadInspectionPath);
    }
    
    // Sanitize project name for folder (remove invalid characters)
    const sanitizedName = projectName.replace(/[<>:"/\\|?*]/g, "_");
    
    // Create project folder
    const projectFolderPath = path.join(roadInspectionPath, sanitizedName);
    if (!fs.existsSync(projectFolderPath)) {
      fs.mkdirSync(projectFolderPath, { recursive: true });
      console.log("Created project folder:", projectFolderPath);
    }
    
    return projectFolderPath;
  } catch (error) {
    console.error("Error creating project folder:", error);
    throw new Error("Failed to create project folder: " + error.message);
  }
}

async function listProjects() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, road_name, road_id, section_id, section_length_m,
            region, c_district, surveyor_name, survey_date,
            folder_path, created_at
     FROM projects
     ORDER BY created_at DESC`
  );
  return rows;
}

async function createProject(projectData) {
  console.log("createProject called with:", projectData);
  console.log("Type:", typeof projectData);
  
  // Handle the data - it should be an object with a 'name' property
  let data = projectData;
  
  // If it's a plain string (legacy support), convert to object
  if (typeof projectData === 'string') {
    data = { name: projectData };
  }
  
  // Ensure we have an object
  if (!data || typeof data !== 'object') {
    throw new Error("Invalid project data format");
  }
  
  // Extract and validate the name
  const name = data.name;
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error("Project name is required.");
  }

  // ✅ Create the project folder FIRST
  const folderPath = await createProjectFolder(name.trim());

  const pool = getPool();
  
  // Insert project with all fields including folder_path
  const [result] = await pool.query(
    `INSERT INTO projects (
      name,
      folder_path,
      road_name,
      road_id,
      section_id,
      section_length_m,
      region,
      c_district,
      surveyor_name,
      survey_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      folderPath,
      data.road_name || null,
      data.road_id || null,
      data.section_id || null,
      data.section_length_m || null,
      data.region || null,
      data.c_district || null,
      data.surveyor_name || null,
      data.survey_date || null,
    ]
  );

  console.log("✅ Project created with folder:", folderPath);

  return { 
    id: result.insertId, 
    name: name.trim(),
    folder_path: folderPath,
    ...data
  };
}

async function updateProject(projectData) {
  console.log("updateProject called with:", projectData);
  
  if (!projectData || typeof projectData !== 'object') {
    throw new Error("Invalid project data format");
  }
  
  const id = projectData.id;
  if (!id) {
    throw new Error("Project ID is required for update");
  }

  const pool = getPool();
  
  await pool.query(
    `UPDATE projects SET
      road_name = ?,
      road_id = ?,
      section_id = ?,
      section_length_m = ?,
      region = ?,
      c_district = ?,
      surveyor_name = ?,
      survey_date = ?
    WHERE id = ?`,
    [
      projectData.road_name || null,
      projectData.road_id || null,
      projectData.section_id || null,
      projectData.section_length_m || null,
      projectData.region || null,
      projectData.c_district || null,
      projectData.surveyor_name || null,
      projectData.survey_date || null,
      id,
    ]
  );

  return { 
    id,
    ...projectData
  };
}

async function deleteProject(id) {
  const pool = getPool();
  
  // Get the folder path before deleting
  const [rows] = await pool.query(
    `SELECT folder_path FROM projects WHERE id = ?`,
    [id]
  );
  
  // Delete from database
  await pool.query(`DELETE FROM projects WHERE id = ?`, [id]);
  
  // ✅ OPTIONAL: Delete the folder too (uncomment if you want this)
  // if (rows.length > 0 && rows[0].folder_path) {
  //   try {
  //     fs.rmSync(rows[0].folder_path, { recursive: true, force: true });
  //     console.log("Deleted project folder:", rows[0].folder_path);
  //   } catch (error) {
  //     console.error("Error deleting folder:", error);
  //   }
  // }
  
  return true;
}

module.exports = {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
};