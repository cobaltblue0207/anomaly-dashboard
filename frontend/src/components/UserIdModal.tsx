import { useState, useEffect } from "react";
import "../styles/modal.css";

interface UserIdModalProps {
  onSubmit: (userId: string) => void;
}

export function UserIdModal({ onSubmit }: UserIdModalProps) {
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  // Load last used user_id from localStorage on mount
  useEffect(() => {
    const lastUserId = localStorage.getItem("last_user_id");
    if (lastUserId) {
      setUserId(lastUserId);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId.trim()) {
      setError("User ID is required");
      return;
    }
    
    if (userId.trim().length < 2) {
      setError("User ID must be at least 2 characters");
      return;
    }
    
    // Save to localStorage for next time
    localStorage.setItem("last_user_id", userId.trim());
    
    onSubmit(userId.trim());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>Welcome to Dashboard</h2>
          <p>Please enter your User ID to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="userId">User ID *</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setError("");
              }}
              placeholder="Enter your user ID..."
              className="modal-input"
              autoFocus
            />
            {userId && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Last used: {userId}
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
          </div>
          
          <button type="submit" className="modal-submit-btn">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

