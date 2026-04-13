const { app, BrowserWindow, ipcMain, dialog, protocol, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, ".env")
  : path.join(__dirname, "../.env");
require("dotenv").config({ path: envPath });
const { pingDB } = require("./db");
const projects = require("./ipc/projects");
const chainages = require("./ipc/chainages");  
const segments = require("./ipc/segments"); 
const subsegments = require("./ipc/subsegments");
const partitions = require("./ipc/partitions");
const remarks = require("./ipc/remarks");
const defects = require("./ipc/defects");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#14213D",
    titleBarStyle: "default",
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.on("did-finish-load", () => {
    win.webContents.focus();
  });

  win.on("focus", () => {
    win.webContents.focus();
  });
}

// Folder pickers
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Image Folder",
    buttonLabel: "Select Folder",
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("select-output-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select AI Output Folder",
    buttonLabel: "Select Folder",
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// List images
ipcMain.handle("list-images-in-folder", async (_event, folderPath) => {
  try {
    const exts = new Set([
      ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff",
    ]);

    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => exts.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    return files.map((name) => {
      const abs = path.join(folderPath, name);
      return {
        name,
        absPath: abs,
        url: `local://${encodeURIComponent(abs)}`,
      };
    });
  } catch (err) {
    console.error("list-images-in-folder error:", err);
    return [];
  }
});

// Open project folder in file explorer
ipcMain.handle("open-project-folder", async (_e, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { ok: false, error: "Folder does not exist: " + folderPath };
  }
  const result = await shell.openPath(folderPath);
  if (result) return { ok: false, error: result }; // shell.openPath returns "" on success, error string on failure
  return { ok: true };
});

// App lifecycle
app.whenReady().then(() => {
  protocol.registerFileProtocol("local", (request, callback) => {
    const url = request.url.replace("local://", "");
    callback({ path: decodeURIComponent(url) });
  });

  ipcMain.handle("db:ping", async () => {
    return await pingDB();
  });

  // Seed remarks lookup table on startup
  remarks.seedRemarksTable().catch((e) => console.error("Remarks seed error:", e));

  // Remarks lookup
  ipcMain.handle("remarks:lookup", async (_e, { pavementType, item, severity }) => {
    return await remarks.lookupRemark(pavementType, item, severity);
  });

  // Projects
  ipcMain.handle("projects:list", async () => {
    return await projects.listProjects();
  });

  ipcMain.handle("projects:create", async (_e, projectData) => {
    return await projects.createProject(projectData);
  });

  ipcMain.handle("projects:update", async (_e, projectData) => {
    return await projects.updateProject(projectData);
  });

  ipcMain.handle("projects:delete", async (_e, { id }) => {
    return await projects.deleteProject(id);
  });

  // ✅ Chainages
  ipcMain.handle("chainages:list", async (_e, { projectId }) => {
    return await chainages.listChainages(projectId);
  });

  ipcMain.handle("chainages:create", async (_e, chainageData) => {
    return await chainages.createChainage(chainageData);
  });

  ipcMain.handle("chainages:delete", async (_e, { id }) => {
    return await chainages.deleteChainage(id);
  });


  // Segments
  ipcMain.handle("segments:list", async (_e, { chainageId }) => {
    return await segments.listSegments(chainageId);
  });

  ipcMain.handle("segments:create", async (_e, { chainageId, name, segmentSubName, segmentStart, segmentEnd, length_m }) => {
    return await segments.createSegment({ chainageId, name, segmentSubName, segmentStart, segmentEnd, length_m });
  });

  ipcMain.handle("segments:update", async (_e, data) => {
    return await segments.updateSegment(data);
  });

  ipcMain.handle("segments:delete", async (_e, { id }) => {
    return await segments.deleteSegment(id);
  });

  // Subsegments
  ipcMain.handle("subsegments:list", async (_e, { segmentId }) => {
    return await subsegments.listSubsegments(segmentId);
  });

  ipcMain.handle("subsegments:create", async (_e, subsegmentData) => {
    return await subsegments.createSubsegment(subsegmentData);
  });

  ipcMain.handle("subsegments:update", async (_e, subsegmentData) => {
    return await subsegments.updateSubsegment(subsegmentData);
  });

  ipcMain.handle("subsegments:delete", async (_e, { id }) => {
    return await subsegments.deleteSubsegment(id);
  });

  // ✅ Partitions
  ipcMain.handle("partitions:list", async (_e, { subsegmentId }) => {
    return await partitions.listPartitions(subsegmentId);
  });

  ipcMain.handle("partitions:create", async (_e, partitionData) => {
    return await partitions.createPartition(partitionData);
  });

  ipcMain.handle("partitions:update", async (_e, partitionData) => {
    return await partitions.updatePartition(partitionData);
  });

  ipcMain.handle("partitions:delete", async (_e, { id }) => {
    return await partitions.deletePartition(id);
  });

  // Defects (partition_evaluations)
  ipcMain.handle("defects:create", async (_e, data) => defects.createDefect(data));
  ipcMain.handle("defects:list", async (_e, { partitionId }) => defects.listDefects(partitionId));
  ipcMain.handle("defects:delete", async (_e, { id }) => defects.deleteDefect(id));

  // Save image bytes to disk (creates folder if it doesn't exist)
  ipcMain.handle("save-image-bytes", async (_e, { filename, bytes, folder }) => {
    await fs.promises.mkdir(folder, { recursive: true });
    const outPath = path.join(folder, filename);
    await fs.promises.writeFile(outPath, Buffer.from(bytes));
    return outPath;
  });

  // Open a file with the OS default app
  ipcMain.handle("open-file", async (_e, filePath) => {
    const result = await shell.openPath(filePath);
    return result ? { ok: false, error: result } : { ok: true };
  });

  // Read a local file and return it as a base64 data URL
  ipcMain.handle("read-file-base64", async (_e, filePath) => {
    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "") || "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${data.toString("base64")}`;
  });


  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});