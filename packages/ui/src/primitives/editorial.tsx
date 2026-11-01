import { useId, type ReactNode } from "react";

export interface EditorialHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

export function EditorialHeader({ title, description, children }: EditorialHeaderProps) {
  return (
    <header className="editorial-header">
      <h1 className="editorial-header__title">{title}</h1>
      {description && <p className="editorial-header__description">{description}</p>}
      {children}
    </header>
  );
}

export interface EditorialMetadataItem {
  label: string;
  value: ReactNode;
  emphasis?: "primary";
}
export interface EditorialMetadataProps {
  id?: string;
  title: ReactNode;
  items: readonly EditorialMetadataItem[];
  note?: ReactNode;
}

export function EditorialMetadata({ id, title, items, note }: EditorialMetadataProps) {
  const generatedId = useId();
  const headingId = `${id || generatedId}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="editorial-metadata">
      <h2 id={headingId}>{title}</h2>
      <dl>
        {items.map((item) => (
          <div key={item.label} data-emphasis={item.emphasis}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="editorial-metadata__note">{note}</p>}
    </section>
  );
}

export interface EditorialSectionHeadingProps {
  title: ReactNode;
  /** Decorative ordinal such as "01"; hidden from assistive technology. */
  index?: ReactNode;
  lead?: ReactNode;
  id?: string;
}

export function EditorialSectionHeading({ title, index, lead, id }: EditorialSectionHeadingProps) {
  return (
    <div className="editorial-section__head">
      {index && (
        <span className="editorial-section__index" aria-hidden="true">
          {index}
        </span>
      )}
      <h2 id={id}>{title}</h2>
      {lead && <p className="editorial-section__lead">{lead}</p>}
    </div>
  );
}
