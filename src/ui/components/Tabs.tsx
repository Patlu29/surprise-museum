import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

interface TabsProps<T extends string> {
  label: string;
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Prefix for the ids that connect tabs and panels. Panels use `${idPrefix}-panel-${id}`. */
  idPrefix: string;
  /** When one panel serves every tab, its id. Overrides the per-tab panel ids. */
  panelId?: string;
}

/** Tab list with automatic activation, arrow keys and roving tabindex (design spec 5.3). */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
  panelId,
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    onChange(tab.id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={panelId ?? `${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={['tabs__tab', selected && 'is-selected'].filter(Boolean).join(' ')}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
