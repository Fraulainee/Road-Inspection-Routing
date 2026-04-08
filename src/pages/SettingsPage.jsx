export default function SettingsPage() {
  return (
    <>
      <header className="header">
        <h2>Settings</h2>
      </header>
      <div className="content">
        <div className="card">
          <h4>Application Settings</h4>
          <div className="setting-item">
            <label>
              <input type="checkbox" defaultChecked />
              Enable notifications
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" defaultChecked />
              Auto-save projects
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
