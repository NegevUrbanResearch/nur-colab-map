type PinkRouteFetchingBannerVariant = "route" | "submit";

const LABELS: Record<PinkRouteFetchingBannerVariant, { text: string; aria: string }> = {
  route: { text: "טוען מסלול…", aria: "טוען מסלול" },
  submit: { text: "שומר במסד הנתונים…", aria: "שומר במסד הנתונים" },
};

interface PinkRouteFetchingBannerProps {
  variant: PinkRouteFetchingBannerVariant;
}

const PinkRouteFetchingBanner = ({ variant }: PinkRouteFetchingBannerProps) => {
  const { text, aria } = LABELS[variant];
  return (
    <div
      className="shape-name-input-container pink-route-fetch-container"
      role="status"
      aria-live="polite"
      aria-label={aria}
    >
      <div className="shape-name-input-form pink-route-fetch-inner">
        <span className="pink-route-fetch-spinner" aria-hidden />
        <span className="pink-route-fetch-label" dir="rtl">
          {text}
        </span>
      </div>
    </div>
  );
};

export default PinkRouteFetchingBanner;
