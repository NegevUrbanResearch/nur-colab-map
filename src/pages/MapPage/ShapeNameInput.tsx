import { useState, useEffect, useRef } from "react";

interface ShapeNameInputProps {
  onSubmit: (name: string | null, description: string | null) => void;
  onCancel: () => void;
}

const ShapeNameInput = ({ onSubmit, onCancel }: ShapeNameInputProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameValue = name.trim() || null;
    const descriptionValue = description.trim() || null;
    
    if (nameValue || descriptionValue) {
      onSubmit(nameValue, descriptionValue);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="shape-name-input-container">
      <form onSubmit={handleSubmit} className="shape-name-input-form">
        <div className="shape-name-input-fields">
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Name (optional)"
            className="shape-name-input-field"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Description (optional)"
            className="shape-description-input-field"
            rows={3}
          />
        </div>
        <div className="shape-name-input-buttons">
          <button type="submit" className="shape-name-input-btn">
            Save
          </button>
          <button type="button" onClick={onCancel} className="shape-name-input-btn">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ShapeNameInput;
