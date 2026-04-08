import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

export default function ReviewPage() {
  const nav = useNavigate();
  const { state } = useLocation();

  const imageFolder = state?.imageFolder || "";
  const aiFolder = state?.aiFolder || "";
  const pavementType = state?.pavementType || "";
  const partitionId = state?.partitionId || null;
  const partitionFolder = state?.partitionFolder || "";

  const [images, setImages] = useState([]);
  const [aiImages, setAiImages] = useState([]);
  const [idx, setIdx] = useState(state?.startIndex ?? 0);

  const [zoomLeft, setZoomLeft] = useState(1);
  const [zoomRight, setZoomRight] = useState(1);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!imageFolder) return;
      const list = await window.api.listImagesInFolder(imageFolder);
      const aiList = aiFolder ? await window.api.listImagesInFolder(aiFolder) : [];

      if (!mounted) return;
      setImages(list);
      setAiImages(aiList);
      setZoomLeft(1);
      setZoomRight(1);
    }

    load();
    return () => (mounted = false);
  }, [imageFolder, aiFolder]);

  const current = images[idx];
  const originalUrl = current?.url || "";
  // Match AI image by index first (handles _annotated / different filename suffixes),
  // fall back to exact filename match
  const aiUrl = aiImages[idx]?.url || "";

  function prev() {
    setIdx((p) => Math.max(0, p - 1));
    setZoomLeft(1);
    setZoomRight(1);
  }
  function next() {
    setIdx((p) => Math.min(images.length - 1, p + 1));
    setZoomLeft(1);
    setZoomRight(1);
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h2>Review page</h2>
          <div className="stats-pills">
            <span className="stat-pill">
              {images.length ? `Image ${idx + 1} / ${images.length}` : "No images"}
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-secondary" onClick={() => nav(-1)}>
            Back
          </button>
        </div>
      </header>

      <div className="content review-wrap">
        <div className="review-panels">
          {/* LEFT: original image folder */}
          <div className="review-panel">
            <div className="review-panel-label">
              Image Folder
              <span className="review-panel-sub">
                {imageFolder ? imageFolder.split(/[\\/]/).pop() : "none"} · {images.length} img{images.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="review-topbar">
              <div className="review-zooms">
                <button className="icon-btn" onClick={() => setZoomLeft((z) => Math.min(3, +(z + 0.2).toFixed(2)))}>
                  <ZoomIn size={18} />
                </button>
                <button className="icon-btn" onClick={() => setZoomLeft((z) => Math.max(1, +(z - 0.2).toFixed(2)))}>
                  <ZoomOut size={18} />
                </button>
              </div>
            </div>

            <div className="review-canvas">
              {originalUrl ? (
                <img
                  src={originalUrl}
                  alt="Original"
                  style={{ transform: `scale(${zoomLeft})` }}
                  className="review-img"
                />
              ) : (
                <div className="review-empty">No image</div>
              )}
            </div>
          </div>

          {/* RIGHT: AI output folder */}
          <div className="review-panel">
            <div className="review-panel-label">
              AI Folder
              <span className="review-panel-sub">
                {aiFolder ? aiFolder.split(/[\\/]/).pop() : "none"} · {aiImages.length} img{aiImages.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="review-topbar">
              <div className="review-zooms">
                <button className="icon-btn" onClick={() => setZoomRight((z) => Math.min(3, +(z + 0.2).toFixed(2)))}>
                  <ZoomIn size={18} />
                </button>
                <button className="icon-btn" onClick={() => setZoomRight((z) => Math.max(1, +(z - 0.2).toFixed(2)))}>
                  <ZoomOut size={18} />
                </button>
              </div>
            </div>

            <div className="review-canvas">
              {aiUrl ? (
                <img
                  src={aiUrl}
                  alt="AI Output"
                  style={{ transform: `scale(${zoomRight})` }}
                  className="review-img"
                />
              ) : (
                <div className="review-empty">No AI image</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="review-bottom">
          <button className="icon-btn big" onClick={prev} disabled={idx <= 0}>
            <ChevronLeft size={22} />
          </button>

          <div className="review-bottom-label">
            {current?.name || "—"}
          </div>

          <button className="icon-btn big" onClick={next} disabled={idx >= images.length - 1}>
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="review-actions">
          <button className="btn-secondary" onClick={() => nav(-1)}>
            Back to Partition
          </button>
          <button
            className="btn-primary"
            onClick={() =>
                nav("/evaluate", {
                state: {
                    original: originalUrl,
                    annotated: aiUrl,
                    filename: current?.name,
                    index: idx,
                    total: images.length,
                    imageFolder,
                    aiFolder,
                    partitionFolder,
                    pavementType,
                    partitionId,
                },
                })
            }
            >
            Add Defect
            </button>
        </div>
      </div>
    </>
  );
}
