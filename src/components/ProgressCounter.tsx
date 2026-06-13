type ProgressCounterProps = {
  completed: number;
  total: number;
};

export function ProgressCounter({ completed, total }: ProgressCounterProps) {
  return (
    <span className="progress-counter">
      <span className="progress-counter-completed">{completed}</span>
      <span className="progress-counter-divider">/</span>
      <span className="progress-counter-total">{total}</span>
    </span>
  );
}
