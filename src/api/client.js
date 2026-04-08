// src/api/client.js

// Detect if we're in Electron or Web
const isElectron = () => {
  return window.api !== undefined;
};

// Mock API for web browser (optional - you can make these real API calls later)
const webApi = {
  // Projects
  listProjects: async () => {
    console.warn("Web API not implemented - returning mock data");
    return [
      { id: 1, name: "Demo Project 1", created_at: new Date() },
      { id: 2, name: "Demo Project 2", created_at: new Date() },
    ];
  },
  createProject: async (projectData) => {
    console.warn("Web API not implemented - returning mock data");
    return { id: 3, name: projectData.name, ...projectData };
  },
  updateProject: async (projectData) => {
    console.warn("Web API not implemented");
    return projectData;
  },
  deleteProject: async (id) => {
    console.warn("Web API not implemented");
    return true;
  },
  openProjectFolder: async (folderPath) => {
    console.warn("Web API not implemented");
    return false;
  },
  
  // ✅ Chainages
  listChainages: async (projectId) => {
    console.warn("Web API not implemented - returning mock data");
    return [
      { id: 1, project_id: projectId, name: "K1512", created_at: new Date() },
      { id: 2, project_id: projectId, name: "K1514", created_at: new Date() },
    ];
  },
  createChainage: async (chainageData) => {
    console.warn("Web API not implemented - returning mock data");
    return { id: 3, ...chainageData, created_at: new Date() };
  },
  deleteChainage: async (id) => {
    console.warn("Web API not implemented");
    return true;
  },

  // ✅ Segments
  listSegments: async (projectId) => {
    console.warn("Web API not implemented - returning mock data");
    return [
      { id: 1, project_id: projectId, name: "Segment 1", created_at: new Date() },
      { id: 2, project_id: projectId, name: "Segment 2", created_at: new Date() },
    ];
  },
  createSegment: async (segmentData) => {
    console.warn("Web API not implemented - returning mock data");
    return { id: 3, ...segmentData, created_at: new Date() };
  },
  deleteSegment: async (id) => {
    console.warn("Web API not implemented");
    return true;
  },
  
  // Other
  dbPing: async () => {
    console.warn("Web API not implemented");
    return false;
  },
};

// Export the appropriate API based on environment
export const api = isElectron() ? window.api : webApi;

export { isElectron };