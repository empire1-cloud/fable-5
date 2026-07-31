interface ChipProps {
  children: string;
  accent?: boolean;
  warn?: boolean;
}

export function Chip({ children, accent, warn }: ChipProps) {
  return <span className={`chip${accent ? " chip--accent" : ""}${warn ? " chip--warn" : ""}`}>{children}</span>;
}

export function ChipRow({ items, accent }: { items: string[]; accent?: boolean }) {
  return (
    <div className="chips">
      {items.map((item) => (
        <Chip key={item} accent={accent}>
          {item}
        </Chip>
      ))}
    </div>
  );
}
