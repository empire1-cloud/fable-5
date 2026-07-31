interface RuleProps {
  label: string;
  note?: string;
}

/** A labeled horizontal divider that names a layer, e.g. "L0 · ONTOLOGY". */
export function Rule({ label, note }: RuleProps) {
  return (
    <div className="rule">
      <span className="rule-label">{label}</span>
      <span className="rule-line" />
      {note && <span className="rule-note">{note}</span>}
    </div>
  );
}
