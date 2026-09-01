import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./SearchableGroupedSelect.module.css";

/**
 * An individual option keeps the machine value separate from the language a
 * person recognises. For document associations, `label` should be the human
 * reference (for example, `X3N-719` or `Cusco → Lima`) and `description`
 * should add its context.
 */
export interface SearchableGroupedSelectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly searchTerms?: readonly string[];
  readonly disabled?: boolean;
}

export interface SearchableGroupedSelectGroup {
  readonly id: string;
  readonly label: string;
  readonly options: readonly SearchableGroupedSelectOption[];
}

export interface SearchableGroupedSelectProps {
  /** Name persisted in the enclosing form through a hidden native input. */
  readonly name: string;
  readonly label: ReactNode;
  readonly groups: readonly SearchableGroupedSelectGroup[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly id?: string;
  readonly placeholder?: string;
  readonly help?: ReactNode;
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly emptyMessage?: ReactNode;
  readonly className?: string;
}

interface VisibleOption {
  readonly group: SearchableGroupedSelectGroup;
  readonly option: SearchableGroupedSelectOption;
  readonly optionId: string;
}

/**
 * Accent-insensitive matching lets someone find an association by the words
 * they know: a plate, driver, customer, route, or a technical code.
 */
export function normalizeSearchableGroupedSelectText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-PE")
    .trim();
}

export function filterSearchableGroupedSelectGroups(
  groups: readonly SearchableGroupedSelectGroup[],
  query: string,
): readonly SearchableGroupedSelectGroup[] {
  const normalizedQuery = normalizeSearchableGroupedSelectText(query);

  if (normalizedQuery === "") return groups;

  return groups.flatMap((group) => {
    const groupMatches = normalizeSearchableGroupedSelectText(group.label).includes(
      normalizedQuery,
    );
    const options = group.options.filter((option) => {
      if (groupMatches) return true;

      const text = [option.label, option.description, ...(option.searchTerms ?? [])]
        .filter((part): part is string => typeof part === "string")
        .join(" ");
      return normalizeSearchableGroupedSelectText(text).includes(normalizedQuery);
    });

    return options.length === 0 ? [] : [{ ...group, options }];
  });
}

function optionDomId(inputId: string, groupIndex: number, optionIndex: number): string {
  return `${inputId}-option-${groupIndex}-${optionIndex}`;
}

function classNames(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function SearchableGroupedSelect({
  name,
  label,
  groups,
  value,
  onChange,
  id,
  placeholder = "Buscar y seleccionar…",
  help,
  error,
  required = false,
  disabled = false,
  emptyMessage = "No se encontraron registros. Prueba con una placa, ruta, persona o cliente.",
  className,
}: SearchableGroupedSelectProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? `searchable-grouped-select-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string | null>(null);

  const filteredGroups = useMemo(
    () => filterSearchableGroupedSelectGroups(groups, query),
    [groups, query],
  );
  const allOptions = useMemo(
    () => groups.flatMap((group) => group.options.map((option) => ({ group, option }))),
    [groups],
  );
  const visibleOptions = useMemo<readonly VisibleOption[]>(
    () =>
      filteredGroups.flatMap((group, groupIndex) =>
        group.options.map((option, optionIndex) => ({
          group,
          option,
          optionId: optionDomId(inputId, groupIndex, optionIndex),
        })),
      ),
    [filteredGroups, inputId],
  );
  const selectedOption = useMemo(
    () => allOptions.find(({ option }) => option.value === value)?.option,
    [allOptions, value],
  );
  const activeOption = visibleOptions.find(({ option }) => option.value === activeValue) ?? null;
  const descriptionIds = [help === undefined ? null : helpId, error === undefined ? null : errorId]
    .filter((value): value is string => value !== null)
    .join(" ");

  useEffect(() => {
    if (!isOpen) return;

    const activeStillVisible = visibleOptions.some(({ option }) => option.value === activeValue);
    if (!activeStillVisible) {
      setActiveValue(visibleOptions.find(({ option }) => !option.disabled)?.option.value ?? null);
    }
  }, [activeValue, isOpen, visibleOptions]);

  const openSearch = useCallback(() => {
    if (disabled) return;

    setQuery("");
    setIsOpen(true);
    setActiveValue(
      allOptions.find(({ option }) => option.value === value && !option.disabled)?.option.value ??
        allOptions.find(({ option }) => !option.disabled)?.option.value ??
        null,
    );
  }, [allOptions, disabled, value]);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const selectOption = useCallback(
    (option: SearchableGroupedSelectOption) => {
      if (option.disabled) return;

      onChange(option.value);
      setActiveValue(option.value);
      closeSearch();
      inputRef.current?.focus();
    },
    [closeSearch, onChange],
  );

  const moveActiveOption = useCallback(
    (direction: 1 | -1) => {
      const selectableOptions = visibleOptions.filter(({ option }) => !option.disabled);
      if (selectableOptions.length === 0) return;

      const currentIndex = selectableOptions.findIndex(
        ({ option }) => option.value === activeValue,
      );
      const nextIndex =
        currentIndex < 0
          ? direction === 1
            ? 0
            : selectableOptions.length - 1
          : (currentIndex + direction + selectableOptions.length) % selectableOptions.length;
      setActiveValue(selectableOptions[nextIndex]?.option.value ?? null);
    },
    [activeValue, visibleOptions],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) openSearch();
      else moveActiveOption(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) openSearch();
      else moveActiveOption(-1);
      return;
    }

    if (event.key === "Home" && isOpen) {
      event.preventDefault();
      setActiveValue(visibleOptions.find(({ option }) => !option.disabled)?.option.value ?? null);
      return;
    }

    if (event.key === "End" && isOpen) {
      event.preventDefault();
      const reversed = [...visibleOptions].reverse();
      setActiveValue(reversed.find(({ option }) => !option.disabled)?.option.value ?? null);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      if (activeOption !== null) selectOption(activeOption.option);
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeSearch();
    }
  }

  return (
    <div className={classNames(styles.field, className)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      <div className={styles.control}>
        <div
          className={classNames(
            styles.inputWrap,
            error === undefined ? null : styles.inputWrapInvalid,
          )}
        >
          <input disabled={disabled} name={name} type="hidden" value={value} />
          <input
            aria-activedescendant={isOpen ? activeOption?.optionId : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-describedby={descriptionIds === "" ? undefined : descriptionIds}
            aria-errormessage={error === undefined ? undefined : errorId}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-invalid={error === undefined ? undefined : true}
            aria-required={required || undefined}
            autoComplete="off"
            className={styles.input}
            disabled={disabled}
            id={inputId}
            onBlur={closeSearch}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={openSearch}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            ref={inputRef}
            role="combobox"
            value={isOpen ? query : (selectedOption?.label ?? "")}
          />
          {value === "" ? null : (
            <button
              aria-label="Quitar registro asociado"
              className={styles.clear}
              disabled={disabled}
              onClick={() => onChange("")}
              type="button"
            >
              ×
            </button>
          )}
        </div>
        {isOpen ? (
          <ul
            aria-label="Resultados de búsqueda"
            className={styles.menu}
            id={listboxId}
            role="listbox"
          >
            {filteredGroups.length === 0 ? (
              <li className={styles.empty}>{emptyMessage}</li>
            ) : (
              filteredGroups.map((group, groupIndex) => {
                const groupLabelId = `${inputId}-group-${groupIndex}`;
                return (
                  <li
                    aria-labelledby={groupLabelId}
                    className={styles.group}
                    key={group.id}
                    role="group"
                  >
                    <span className={styles.groupLabel} id={groupLabelId}>
                      {group.label}
                    </span>
                    {group.options.map((option, optionIndex) => {
                      const optionId = optionDomId(inputId, groupIndex, optionIndex);
                      const isActive = activeOption?.optionId === optionId;
                      return (
                        <div
                          aria-disabled={option.disabled || undefined}
                          aria-selected={option.value === value}
                          className={classNames(
                            styles.option,
                            isActive ? styles.optionActive : null,
                            option.disabled ? styles.optionDisabled : null,
                          )}
                          id={optionId}
                          key={option.value}
                          onClick={() => selectOption(option)}
                          onMouseDown={(event) => event.preventDefault()}
                          role="option"
                        >
                          <span className={styles.optionLabel}>{option.label}</span>
                          {option.description === undefined ? null : (
                            <span className={styles.optionDescription}>{option.description}</span>
                          )}
                        </div>
                      );
                    })}
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
      <p aria-live="polite" className={styles.selection}>
        {selectedOption === undefined ? (
          "Aún no has seleccionado un registro."
        ) : (
          <>
            Seleccionado: <strong>{selectedOption.label}</strong>
            {selectedOption.description === undefined ? null : ` · ${selectedOption.description}`}
          </>
        )}
      </p>
      {help === undefined ? null : (
        <p className={styles.help} id={helpId}>
          {help}
        </p>
      )}
      {error === undefined ? null : (
        <p className={styles.error} id={errorId} role="alert">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      )}
    </div>
  );
}
