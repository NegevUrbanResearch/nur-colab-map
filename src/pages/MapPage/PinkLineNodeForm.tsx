import { useState, useRef, useEffect } from "react";

interface PinkLineNodeFormProps {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
  mode?: "create" | "edit";
  initialName?: string;
  initialDescription?: string;
}

const NAME_QUESTION = "מה השם של נקודת עניין הזו?";
const DESCRIPTION_QUESTION =
  "הסבר מה קרה כאן ב-7 באוקטובר ולמה ציר המורשת צריך לעבור כאן?";

const PinkLineNodeForm = ({
  onSubmit,
  onCancel,
  mode = "create",
  initialName = "",
  initialDescription = "",
}: PinkLineNodeFormProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
    setStep(1);
  }, [initialName, initialDescription, mode]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step, mode]);

  const question = step === 1 ? NAME_QUESTION : DESCRIPTION_QUESTION;
  const value = step === 1 ? name : description;
  /** Edit: both name and description required (matches completing the two-step create flow). */
  const canSaveEdit = name.trim().length > 0 && description.trim().length > 0;
  const canNext = value.trim().length > 0;

  const handleNext = () => {
    if (mode === "edit") {
      if (!canSaveEdit) return;
      onSubmit(name.trim(), description.trim());
      return;
    }
    if (step === 1) {
      setStep(2);
    } else {
      onSubmit(name.trim() || "", description.trim() || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };

  if (mode === "edit") {
    return (
      <div className="shape-name-input-container">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSaveEdit) handleNext();
          }}
          className="shape-name-input-form"
        >
          <div className="shape-name-input-fields">
            <span className="shape-name-input-label" style={{ fontWeight: 600 }}>
              עריכת נקודת ציר מורשת
            </span>
            <label className="shape-name-input-label">{NAME_QUESTION}</label>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="shape-name-input-field"
              dir="rtl"
              autoFocus
            />
            <label className="shape-name-input-label">{DESCRIPTION_QUESTION}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              className="shape-description-input-field"
              rows={4}
              dir="rtl"
            />
          </div>
          <div className="shape-name-input-buttons">
            <button
              type="submit"
              className="shape-name-input-btn shape-name-input-btn-primary"
              disabled={!canSaveEdit}
            >
              שמור
            </button>
            <button type="button" onClick={onCancel} className="shape-name-input-btn shape-name-input-btn-secondary">
              ביטול
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="shape-name-input-container">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canNext) handleNext();
        }}
        className="shape-name-input-form"
      >
        <div className="shape-name-input-fields">
          <label className="shape-name-input-label">{question}</label>
          {step === 1 ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="shape-name-input-field"
              dir="rtl"
              autoFocus
            />
          ) : (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              className="shape-description-input-field"
              rows={4}
              dir="rtl"
              autoFocus
            />
          )}
        </div>
        <div className="shape-name-input-buttons">
          <button
            type="submit"
            className="shape-name-input-btn shape-name-input-btn-primary"
            disabled={!canNext}
          >
            {step === 1 ? "הבא" : "שמור"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="shape-name-input-btn shape-name-input-btn-secondary"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
};

export default PinkLineNodeForm;
