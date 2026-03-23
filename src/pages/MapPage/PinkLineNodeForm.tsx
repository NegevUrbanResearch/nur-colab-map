import { useState, useRef, useEffect } from "react";

interface PinkLineNodeFormProps {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}

const NAME_QUESTION = "מה השם של נקודת עניין הזו?";
const DESCRIPTION_QUESTION = "הסבר מה קרה כאן ב-7 באוקטובר ולמה הקו צריך לעבור כאן?";

const PinkLineNodeForm = ({ onSubmit, onCancel }: PinkLineNodeFormProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      onSubmit(name.trim() || "", description.trim() || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };

  const question = step === 1 ? NAME_QUESTION : DESCRIPTION_QUESTION;
  const value = step === 1 ? name : description;
  const canNext = value.trim().length > 0;

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
