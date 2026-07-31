import type { ReactNode } from "react";

interface SheetProps {
  eyebrow: string;
  title: string;
  note?: string;
  children: ReactNode;
  id?: string;
}

/** A full architectural sheet — the unit every workspace is built from. */
export function Sheet({ eyebrow, title, note, children, id }: SheetProps) {
  return (
    <section className="sheet" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <header className="sheet-head">
        <div>
          <div className="sheet-eyebrow">{eyebrow}</div>
          <h2 className="sheet-title" id={id ? `${id}-title` : undefined}>
            {title}
          </h2>
        </div>
        {note && <div className="sheet-note">{note}</div>}
      </header>
      {children}
    </section>
  );
}
