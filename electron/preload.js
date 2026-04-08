const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  selectImageFolder: () => ipcRenderer.invoke("select-folder"),
  selectOutputFolder: () => ipcRenderer.invoke("select-output-folder"),
  listImagesInFolder: (folderPath) =>
    ipcRenderer.invoke("list-images-in-folder", folderPath),
  
  dbPing: () => ipcRenderer.invoke("db:ping"),
  
  // Projects
  listProjects: () => ipcRenderer.invoke("projects:list"),
  createProject: (projectData) => ipcRenderer.invoke("projects:create", projectData),
  updateProject: (projectData) => ipcRenderer.invoke("projects:update", projectData),
  deleteProject: (id) => ipcRenderer.invoke("projects:delete", { id }),
  openProjectFolder: (folderPath) => ipcRenderer.invoke("open-project-folder", folderPath),
  
  // ✅ Chainages
  listChainages: (projectId) => ipcRenderer.invoke("chainages:list", { projectId }),
  createChainage: (chainageData) => ipcRenderer.invoke("chainages:create", chainageData),
  deleteChainage: (id) => ipcRenderer.invoke("chainages:delete", { id }),

  // ✅ Segments
  listSegments: (chainageId) => ipcRenderer.invoke("segments:list", { chainageId }),
  createSegment: ({ chainageId, name, segmentSubName, segmentStart, segmentEnd, length_m }) => ipcRenderer.invoke("segments:create", { chainageId, name, segmentSubName, segmentStart, segmentEnd, length_m }),
  updateSegment: (data) => ipcRenderer.invoke("segments:update", data),
  deleteSegment: (id) => ipcRenderer.invoke("segments:delete", { id }),

  // Subsegments
  listSubsegments: (segmentId) => ipcRenderer.invoke("subsegments:list", { segmentId }),
  createSubsegment: (subsegmentData) => ipcRenderer.invoke("subsegments:create", subsegmentData),
  updateSubsegment: (subsegmentData) => ipcRenderer.invoke("subsegments:update", subsegmentData),
  deleteSubsegment: (id) => ipcRenderer.invoke("subsegments:delete", { id }),

  // ✅ Partitions
  listPartitions: (subsegmentId) => ipcRenderer.invoke("partitions:list", { subsegmentId }),
  createPartition: (partitionData) => ipcRenderer.invoke("partitions:create", partitionData),
  updatePartition: (partitionData) => ipcRenderer.invoke("partitions:update", partitionData),
  deletePartition: (id) => ipcRenderer.invoke("partitions:delete", { id }),

  // Remarks lookup
  lookupRemark: (pavementType, item, severity) =>
    ipcRenderer.invoke("remarks:lookup", { pavementType, item, severity }),

  // Defects (partition_evaluations)
  createDefect: (data) => ipcRenderer.invoke("defects:create", data),
  listDefects: (partitionId) => ipcRenderer.invoke("defects:list", { partitionId }),
  deleteDefect: (id) => ipcRenderer.invoke("defects:delete", { id }),

  // Save screenshot bytes to disk
  saveImageBytes: (filename, bytes, folder) =>
    ipcRenderer.invoke("save-image-bytes", { filename, bytes, folder }),

  // Read a local file as base64 data URL (for displaying local images in renderer)
  readFileBase64: (filePath) =>
    ipcRenderer.invoke("read-file-base64", filePath),

  // Open a file with the OS default app
  openFile: (filePath) =>
    ipcRenderer.invoke("open-file", filePath),
});