import { useState, useRef, useEffect } from "react";

interface MemorialSiteFormProps {
  nameQuestion: string;
  descriptionQuestion: string;
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}

const MemorialSiteForm = ({
  nameQuestion,
  descriptionQuestion,
  onSubmit,
  onCancel,
}: MemorialSiteFormProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const question = step === 1 ? nameQuestion : descriptionQuestion;
  const value = step === 1 ? name : description;
  const canNext = value.trim().length > 0;

  const handleNext = () => {
    if (step === 1) setStep(2);
    else onSubmit(name.trim(), description.trim());
  };

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
              onKeyDown={(e) => e.key === "Escape" && onCancel()}
              className="shape-name-input-field"
              dir="rtl"
            />
          ) : (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onCancel()}
              className="shape-description-input-field"
              rows={4}
              dir="rtl"
            />
          )}
        </div>
        <div className="shape-name-input-buttons">
          <button type="submit" className="shape-name-input-btn" disabled={!canNext}>
            {step === 1 ? "הבא" : "שמור"}
          </button>
          <button type="button" onClick={onCancel} className="shape-name-input-btn">
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
};

export default MemorialSiteForm;
