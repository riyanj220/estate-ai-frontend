"use client";

import { useCallback, useState } from "react";
import type { components } from "@/api/schema";
import { getApi } from "@/lib/api";
import { useAdminRead, useAdminWrite, words } from "../moderation-shared";

type City = components["schemas"]["AdminCityList"]["items"][number];
type Locality = components["schemas"]["AdminLocalityList"]["items"][number];
type Amenity = components["schemas"]["AdminAmenityList"]["items"][number];
type Fixed = components["schemas"]["FixedCatalogue"];
type Send = (csrf: string, signal: AbortSignal) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
type Save = (send: Send, after: () => void) => void;

const PATH = "/admin/reference";
const REFUSED = "That value is not valid or is already in use.";
const AMENITY_KINDS = ["on_property", "community", "nearby"];

const options = (csrf: string, signal: AbortSignal) => ({ headers: { "X-CSRFToken": csrf }, cache: "no-store" as const, signal });

/** Cities, localities and amenities (Story 10.5): added, renamed and deactivated, never deleted. */
export function ReferenceData() {
  const cities = useAdminRead(useCallback(async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/reference/cities", { cache: "no-store", signal }), []), PATH);
  const amenities = useAdminRead(useCallback(async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/reference/amenities", { cache: "no-store", signal }), []), PATH);
  const fixed = useAdminRead<Fixed>(useCallback(async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/reference/fixed", { cache: "no-store", signal }), []), PATH);
  const [notice, setNotice] = useState("");
  const [cityId, setCityId] = useState("");
  const { working, write } = useAdminWrite(cities.gone, setNotice);

  const save: Save = (send, after) => {
    if (working) return;
    void write<unknown>(send, {
      done: () => {
        setNotice("Saved.");
        after();
      },
      refused: () => setNotice(REFUSED),
    });
  };
  const failure = cities.failure || amenities.failure || fixed.failure;

  return (
    <>
      <h1 className="page-title">Reference data</h1>
      <p className="muted">Items are never deleted. A deactivated item is no longer offered, and listings that use it keep it.</p>
      <p role="status" aria-live="polite" className={notice ? "state-note" : "sr-only"} data-testid="reference-notice">
        {notice}
      </p>
      {failure && <p role="alert">{failure}</p>}

      <section className="card" aria-labelledby="cities-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="cities-title" className="section-title">
          Cities
        </h2>
        <ul aria-label="Cities">
          {cities.data?.items.map((city: City) => (
            <Item
              key={city.id}
              name={city.name}
              active={city.is_active}
              rename={(name) => save(async (csrf, signal) => (await getApi()).PATCH("/api/v1/admin/reference/cities/{city_id}", { params: { path: { city_id: city.id } }, body: { name }, ...options(csrf, signal) }), cities.reload)}
              toggle={() => save(async (csrf, signal) => (await getApi()).PATCH("/api/v1/admin/reference/cities/{city_id}", { params: { path: { city_id: city.id } }, body: { is_active: !city.is_active }, ...options(csrf, signal) }), cities.reload)}
            />
          ))}
        </ul>
        <AddForm label="Add city" fields={[{ name: "name", label: "City name" }]} submit={(values, clear) => save(async (csrf, signal) => (await getApi()).POST("/api/v1/admin/reference/cities", { body: { name: values.name }, ...options(csrf, signal) }), () => { clear(); void cities.reload(); })} />
      </section>

      <section className="card" aria-labelledby="localities-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="localities-title" className="section-title">
          Areas and societies
        </h2>
        <div className="field">
          <label htmlFor="reference-city">City</label>
          <select id="reference-city" value={cityId} onChange={(event) => setCityId(event.target.value)}>
            <option value="">Choose a city</option>
            {cities.data?.items.map((city: City) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
        {cityId && <Localities key={cityId} cityId={cityId} save={save} />}
      </section>

      <section className="card" aria-labelledby="amenities-title" style={{ marginBottom: "var(--space)" }}>
        <h2 id="amenities-title" className="section-title">
          Amenities and nearby facilities
        </h2>
        <ul aria-label="Amenities">
          {amenities.data?.items.map((amenity: Amenity) => (
            <Item
              key={amenity.code}
              name={amenity.label}
              detail={`${words(amenity.kind)}, ${words(amenity.group)}`}
              active={amenity.is_active}
              rename={(label) => save(async (csrf, signal) => (await getApi()).PATCH("/api/v1/admin/reference/amenities/{code}", { params: { path: { code: amenity.code } }, body: { label }, ...options(csrf, signal) }), amenities.reload)}
              toggle={() => save(async (csrf, signal) => (await getApi()).PATCH("/api/v1/admin/reference/amenities/{code}", { params: { path: { code: amenity.code } }, body: { is_active: !amenity.is_active }, ...options(csrf, signal) }), amenities.reload)}
            />
          ))}
        </ul>
        <AddForm
          label="Add amenity"
          fields={[
            { name: "label", label: "Amenity name" },
            { name: "code", label: "Code (lowercase_words, cannot change)" },
            { name: "group", label: "Group (lowercase_words)" },
            { name: "kind", label: "Kind", choices: AMENITY_KINDS },
          ]}
          submit={(values, clear) =>
            save(
              async (csrf, signal) => (await getApi()).POST("/api/v1/admin/reference/amenities", { body: { code: values.code, label: values.label, kind: values.kind, group: values.group }, ...options(csrf, signal) }),
              () => {
                clear();
                void amenities.reload();
              },
            )
          }
        />
      </section>

      <section className="card" aria-labelledby="fixed-title">
        <h2 id="fixed-title" className="section-title">
          Fixed by the product
        </h2>
        <p className="muted">These cannot be edited.</p>
        {fixed.data && (
          <dl className="account-details" data-testid="fixed-catalogue">
            <dt>Purposes</dt>
            <dd>{fixed.data.purposes.map(words).join(", ")}</dd>
            {fixed.data.categories.map((category) => (
              <div key={category.id}>
                <dt>{words(category.id)} subtypes</dt>
                <dd>{category.subtypes.map(words).join(", ")}</dd>
              </div>
            ))}
            <dt>Area units</dt>
            <dd>{fixed.data.area_units.join(", ")}</dd>
          </dl>
        )}
      </section>
    </>
  );
}

function Localities({ cityId, save }: { cityId: string; save: Save }) {
  const send = useCallback(
    async (signal: AbortSignal) => (await getApi()).GET("/api/v1/admin/reference/cities/{city_id}/localities", { params: { path: { city_id: cityId } }, cache: "no-store", signal }),
    [cityId],
  );
  const { data, failure, reload } = useAdminRead(send, PATH);
  const change = (id: string, body: { name?: string; is_active?: boolean }) =>
    save(async (csrf, signal) => (await getApi()).PATCH("/api/v1/admin/reference/localities/{locality_id}", { params: { path: { locality_id: id } }, body, ...options(csrf, signal) }), reload);
  return (
    <>
      {failure && <p role="alert">{failure}</p>}
      <p className="muted">The price model knows areas by name: a renamed area has no estimates until the model is retrained.</p>
      <ul aria-label="Areas and societies">
        {data?.items.map((row: Locality) => (
          <Item key={row.id} name={row.name} detail={words(row.kind)} active={row.is_active} rename={(name) => change(row.id, { name })} toggle={() => change(row.id, { is_active: !row.is_active })} />
        ))}
      </ul>
      <AddForm
        label="Add area"
        fields={[
          { name: "name", label: "Area name" },
          { name: "kind", label: "Area kind", choices: ["area", "society"] },
        ]}
        submit={(values, clear) =>
          save(
            async (csrf, signal) => (await getApi()).POST("/api/v1/admin/reference/cities/{city_id}/localities", { params: { path: { city_id: cityId } }, body: { name: values.name, kind: values.kind }, ...options(csrf, signal) }),
            () => {
              clear();
              void reload();
            },
          )
        }
      />
    </>
  );
}

function Item({ name, detail, active, rename, toggle }: { name: string; detail?: string; active: boolean; rename: (value: string) => void; toggle: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <li className="account-text" style={{ marginBottom: "var(--space)" }}>
      <span>
        {name}
        {detail ? ` (${detail})` : ""}
        {active ? "" : " - deactivated"}
      </span>
      {editing === null ? (
        <div className="image-actions">
          <button type="button" className="secondary-button" aria-label={`Rename ${name}`} onClick={() => setEditing(name)}>
            Rename
          </button>
          <button type="button" className="secondary-button" aria-label={`${active ? "Deactivate" : "Reactivate"} ${name}`} onClick={toggle}>
            {active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      ) : (
        <form
          className="image-actions"
          onSubmit={(event) => {
            event.preventDefault();
            rename(editing.trim());
            setEditing(null);
          }}
        >
          <input aria-label={`New name for ${name}`} type="text" maxLength={80} required value={editing} onChange={(event) => setEditing(event.target.value)} />
          <button type="submit" className="primary-button">
            Save
          </button>
          <button type="button" className="secondary-button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </form>
      )}
    </li>
  );
}

function AddForm({ label, fields, submit }: { label: string; fields: { name: string; label: string; choices?: string[] }[]; submit: (values: Record<string, string>, clear: () => void) => void }) {
  const empty = () => Object.fromEntries(fields.map((field) => [field.name, field.choices?.[0] ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(empty);
  return (
    <form
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        submit(values, () => setValues(empty()));
      }}
    >
      {fields.map((field) => {
        const id = `${label}-${field.name}`.toLowerCase().replaceAll(" ", "-");
        const change = (value: string) => setValues((before) => ({ ...before, [field.name]: value }));
        return (
          <div className="field" key={field.name}>
            <label htmlFor={id}>{field.label}</label>
            {field.choices ? (
              <select id={id} value={values[field.name]} onChange={(event) => change(event.target.value)}>
                {field.choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {words(choice)}
                  </option>
                ))}
              </select>
            ) : (
              <input id={id} type="text" required autoComplete="off" value={values[field.name]} onChange={(event) => change(event.target.value)} />
            )}
          </div>
        );
      })}
      <button type="submit" className="primary-button">
        {label}
      </button>
    </form>
  );
}
