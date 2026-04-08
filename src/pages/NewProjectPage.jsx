import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../api/client";  // ✅ Import the API wrapper
import NewProject from "./NewProject"; 

export default function NewProjectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);

  // Get the project info passed from ProjectsPage
  const projectId = location.state?.projectId;
  const projectName = location.state?.projectName || "Untitled Project";

  // If no projectId, redirect back to projects
  if (!projectId) {
    navigate("/projects");
    return null;
  }

  return (
    <NewProject
      projectName={projectName}
      onCancel={() => navigate("/projects")}
      onConfirm={async (formData) => {
        console.log("Saving project details...");
        console.log("Project ID:", projectId);
        console.log("Project Name:", projectName);
        console.log("Form data:", formData);

        setSaving(true);
        
        try {
          // ✅ Update the project with all the form data
          await api.updateProject({ 
            id: projectId,
            ...formData
          });
          
          alert("Project details saved successfully!");
          navigate("/projects");
        } catch (error) {
          console.error("Error saving project:", error);
          alert("Failed to save project: " + (error.message || "Unknown error"));
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}