import { useState, useRef, useEffect } from "react";

interface TestimonyFormProps {
  onSubmit: (name: string | null, description: string | null) => void;
  onCancel: () => void;
}

const NAME_QUESTION = "תנו שם לרשומה";
const TESTIMONY_QUESTION = "ספר/י מה קרה כאן";

const TestimonyForm = ({ onSubmit, onCancel }: TestimonyFormProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [testimony, setTestimony] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const question = step === 1 ? NAME_QUESTION : TESTIMONY_QUESTION;
  const value = step === 1 ? name : testimony;
  const canNext = value.trim().length > 0;

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      onSubmit(name.trim() || null, testimony.trim() || null);
    }
  };

  return (
    <div className="shape-name-input-container">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canNext) handleNext();
        }}
        className="testimony-form"
        dir="rtl"
      >
        <label className="shape-name-input-label">{question}</label>
        {step === 1 ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onCancel()}
            className="shape-name-input-field testimony-field"
            dir="rtl"
          />
        ) : (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={testimony}
            onChange={(e) => setTestimony(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onCancel()}
            className="shape-description-input-field testimony-field"
            rows={5}
            dir="rtl"
          />
        )}
        <div className="testimony-buttons">
          <button
            type="submit"
            className="shape-name-input-btn"
            disabled={!canNext}
          >
            {step === 1 ? "הבא" : "שמור"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="shape-name-input-btn"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
};

export default TestimonyForm;
