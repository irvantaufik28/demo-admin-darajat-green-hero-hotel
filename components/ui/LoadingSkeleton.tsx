type Props = {
  variant?: "table" | "dashboard" | "detail" | "form" | "cards" | "inline";
  rows?: number;
};

function Block({ width }: { width?: string }) {
  return <span className="loading-skeleton__block" style={{ width }} aria-hidden="true" />;
}

export function LoadingSkeleton({ variant = "table", rows = 5 }: Props) {
  return (
    <div className={`loading-skeleton loading-skeleton--${variant}`} role="status" aria-label="Memuat data">
      <span className="loading-skeleton__sr-only">Memuat data...</span>
      {variant === "inline" && <Block width="100%" />}
      {variant === "dashboard" && (
        <>
          <div className="loading-skeleton__cards">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="loading-skeleton__panel" key={index}><Block width="55%" /><Block width="35%" /></div>
            ))}
          </div>
          <div className="loading-skeleton__columns">
            <div className="loading-skeleton__panel"><Block width="38%" /><LoadingSkeleton rows={5} /></div>
            <div className="loading-skeleton__panel"><Block width="48%" /><LoadingSkeleton rows={5} /></div>
          </div>
        </>
      )}
      {variant === "cards" && (
        <div className="loading-skeleton__cards">
          {Array.from({ length: rows }, (_, index) => (
            <div className="loading-skeleton__panel" key={index}><Block width="65%" /><Block width="40%" /><Block width="80%" /></div>
          ))}
        </div>
      )}
      {variant === "detail" && (
        <>
          <div className="loading-skeleton__panel"><Block width="32%" /><Block width="55%" /></div>
          <div className="loading-skeleton__columns">
            <div className="loading-skeleton__panel"><Block width="40%" /><LoadingSkeleton rows={4} /></div>
            <div className="loading-skeleton__panel"><Block width="55%" /><LoadingSkeleton rows={4} /></div>
          </div>
        </>
      )}
      {variant === "form" && (
        <div className="loading-skeleton__panel loading-skeleton__form">
          {Array.from({ length: rows }, (_, index) => <Block key={index} width={index % 3 === 0 ? "75%" : "100%"} />)}
        </div>
      )}
      {variant === "table" && (
        <div className="loading-skeleton__table">
          {Array.from({ length: rows }, (_, index) => (
            <div className="loading-skeleton__row" key={index}>
              <Block width="70%" /><Block width="90%" /><Block width="55%" /><Block width="78%" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
