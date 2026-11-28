import Link from "next/link";
import { groupCatalogue } from "@/lib/amenities";
import {
  SORT_LABELS,
  activeChips,
  boundLabel,
  browseHref,
  cityName,
  defaultSort,
  filterTitle,
  localityName,
  valuesOf,
  type FilterDef,
  type FilterSchema,
  type Places,
} from "@/lib/listing-filters";
import { label } from "@/lib/listing-labels";

type Props = { path: string; schema: FilterSchema; places: Places; query: URLSearchParams; problems: Record<string, string> };

/**
 * The filter panel and sort control (Story 3.5): one plain GET form, so it works without JavaScript. It carries no cursor, so applying it
 * always starts at the first page. The inputs are uncontrolled; the form is keyed by the query so a link navigation resets them.
 */
export function FilterPanel({ path, schema, places, query, problems }: Props) {
  const chips = activeChips(query, schema, places);
  const sort = query.get("sort") ?? defaultSort(query);
  const sorts = schema.sorts.filter((id) => SORT_LABELS[id] && (id !== "relevance" || defaultSort(query) === "relevance"));
  const params = new Set(schema.filters.flatMap((filter) => filter.params));
  // What has no control here (preferences, the page size) is carried along unchanged.
  const carried = [...query].filter(([name]) => name === "limit" || (name.startsWith(schema.preferencePrefix) && params.has(name.slice(schema.preferencePrefix.length))));
  const refused = Object.keys(problems).some((name) => params.has(name));

  return (
    <>
      <form key={query.toString()} action={path} method="get" className="card filter-form" aria-label="Filter and sort listings">
        {carried.map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="filter-sort">
          <div className="field">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={sort}>
              {sorts.map((id) => (
                <option key={id} value={id}>
                  {SORT_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="secondary-button">
            Sort
          </button>
        </div>
        <details open={refused} data-testid="filter-panel">
          <summary className="filter-toggle">{chips.length > 0 ? `Filters (${chips.length} active)` : "Filters"}</summary>
          <div className="filter-grid">
            {schema.filters.map((filter) => (
              <Control key={filter.id} filter={filter} places={places} query={query} problems={problems} />
            ))}
          </div>
          <p className="filter-actions">
            <button type="submit" className="primary-button">
              Apply filters
            </button>
            <Link href={path} className="text-link">
              Clear all filters
            </Link>
          </p>
        </details>
      </form>
      {chips.length > 0 && (
        <section aria-label="Active filters" className="filter-active" data-testid="active-filters">
          <ul>
            {chips.map((chip) => (
              <li key={chip.key}>
                <Link href={browseHref(path, chip.query)} className="filter-chip">
                  <span className="sr-only">Remove </span>
                  {chip.text}
                  <span aria-hidden="true"> ×</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={path} className="text-link">
            Clear all
          </Link>
        </section>
      )}
    </>
  );
}

function Box({ name, value, text, checked }: { name: string; value: string; text: string; checked: boolean }) {
  return (
    <label className="radio-option">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} />
      <span>{text}</span>
    </label>
  );
}

/** What a filter applies to, when not to every Listing. */
function appliesTo(filter: FilterDef): string | null {
  if (filter.purposes.length > 0) return `For ${filter.purposes.join(" and ")} listings only.`;
  if (filter.subtypes.length > 0) return `Only for: ${filter.subtypes.map((id) => label(id).toLowerCase()).join(", ")}.`;
  return null;
}

function Control({ filter, places, query, problems }: { filter: FilterDef } & Pick<Props, "places" | "query" | "problems">) {
  const [name] = filter.params;
  const chosen = valuesOf(query, name);
  const hint = appliesTo(filter);
  const errors = filter.params.filter((param) => problems[param]);
  const errorText = (param: string) =>
    problems[param] && (
      <p className="field-error" id={`${param}-error`}>
        {problems[param]}
      </p>
    );
  const invalid = (param: string) => (problems[param] ? { "aria-invalid": true, "aria-describedby": `${param}-error` } : {});

  if (filter.match === "boolean") {
    return (
      <div className="field">
        <label htmlFor={name}>{filterTitle(filter.id)}</label>
        {errorText(name)}
        <select id={name} name={name} defaultValue={query.get(name) ?? ""} {...invalid(name)}>
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  return (
    <fieldset className={filter.match === "amenities" || filter.reference === "locality" ? "filter-group filter-wide" : "filter-group"}>
      <legend>
        {filterTitle(filter.id)}
        {filter.sellerDeclared && <span className="declared-tag declared-tag-inline">Seller-declared</span>}
      </legend>
      {hint && <p className="hint">{hint}</p>}
      {filter.id === "asking_price" && <p className="hint">Sale and rent prices differ: choose a purpose too.</p>}
      {filter.match === "range" ? (
        <div className="filter-range">
          {filter.params.map((param, index) => (
            <div className="field" key={param}>
              <label htmlFor={param}>{boundLabel(index)}</label>
              {errorText(param)}
              <input id={param} name={param} type="text" inputMode={filter.type === "integer" ? "numeric" : "decimal"} autoComplete="off" defaultValue={query.get(param) ?? ""} {...invalid(param)} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {errors.map((param) => (
            <p className="field-error" key={param}>
              {problems[param]}
            </p>
          ))}
          {filter.match === "amenities" ? (
            <Amenities filter={filter} chosen={chosen} />
          ) : filter.reference === "locality" ? (
            <Localities name={name} places={places} chosen={chosen} />
          ) : (
            <div className="filter-options">
              {(filter.reference === "city" ? [...places.cities.map((city) => city.id), ...chosen.filter((id) => !places.cities.some((city) => city.id === id))] : filter.allowedValues).map(
                (value) => (
                  <Box key={value} name={name} value={value} text={filter.reference === "city" ? cityName(places, value) : label(value)} checked={chosen.includes(value)} />
                ),
              )}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

function Localities({ name, places, chosen }: { name: string; places: Places; chosen: string[] }) {
  const listed = places.localities.flatMap((group) => group.items.map((item) => item.id));
  const others = chosen.filter((id) => !listed.includes(id));
  return (
    <>
      {places.localities.length === 0 && <p className="hint">Choose a city and apply the filters to see its areas and societies.</p>}
      {places.localities.map((group) => (
        <fieldset className="filter-group" key={group.city.id}>
          <legend className="filter-subtitle">In {group.city.name}</legend>
          <div className="filter-options">
            {group.items.map((item) => (
              <Box key={item.id} name={name} value={item.id} text={item.name} checked={chosen.includes(item.id)} />
            ))}
          </div>
        </fieldset>
      ))}
      {others.map((id) => (
        <Box key={id} name={name} value={id} text={localityName(places, id)} checked />
      ))}
    </>
  );
}

/** Every ticked amenity must be present. Nearby entries are the seller's own declaration. */
function Amenities({ filter, chosen }: { filter: FilterDef; chosen: string[] }) {
  const [name] = filter.params;
  if (filter.options.length === 0)
    return (
      <>
        <p className="hint">The amenities are not available right now.</p>
        {chosen.map((code) => (
          <Box key={code} name={name} value={code} text={label(code)} checked />
        ))}
      </>
    );
  return (
    <>
      <p className="hint">A listing must have everything you tick.</p>
      {groupCatalogue(filter.options).map((kind) => (
        <fieldset className="filter-group" key={kind.kind}>
          <legend className="filter-subtitle">
            {kind.title}
            {kind.kind === "nearby" && <span className="declared-tag declared-tag-inline">Seller-declared</span>}
          </legend>
          <div className="filter-options">
            {kind.groups.flatMap((group) => group.items).map((item) => (
              <Box key={item.code} name={name} value={item.code} text={item.label} checked={chosen.includes(item.code)} />
            ))}
          </div>
        </fieldset>
      ))}
    </>
  );
}
