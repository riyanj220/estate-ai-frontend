import { KIND_ORDER, KIND_TITLES, STATE_TEXT, amenityLabel, answeredOfKind, decodeAmenities, otherCodes, type AmenityCatalogueList } from "@/lib/amenities";
import { SELLER_DECLARED, answeredDetails, shownDetails } from "@/lib/listing-details";
import { NOT_SET, areaSummary, derivedText, formatPrice, label, type ListingView } from "@/lib/listing-labels";
import { PUBLIC_LOCATION_TEXT } from "@/lib/listing-preview";
import type { Registry } from "@/lib/registry";

/** "PKR 25,000.00 (Total · Monthly)", or "Not set". */
export function priceText(fields: ListingView["fields"]): string {
  if (fields.asking_price === null) return NOT_SET;
  const extra = [fields.price_basis, fields.rental_period].filter((value): value is string => value !== null).map(label).join(" · ");
  return `PKR ${formatPrice(fields.asking_price)}${extra ? ` (${extra})` : ""}`;
}

function Declared() {
  return (
    <>
      <span className="sr-only">. </span>
      <span className="declared-tag declared-tag-inline">{SELLER_DECLARED}</span>
    </>
  );
}

/**
 * The public facts of a Listing: price, area, public location, registry details and amenities. Shared by the owner's preview and the public
 * detail page (no hooks, so it renders on the server too). `testId` prefixes the test ids.
 */
export function ListingFacts({
  listing,
  registry,
  catalogue,
  cityName,
  localityName,
  testId,
}: {
  listing: ListingView;
  /** Null while it is not available: the registry details are then left out. */
  registry: Registry | null;
  catalogue: AmenityCatalogueList;
  cityName: string | null;
  localityName: string | null;
  testId: string;
}) {
  const { fields } = listing;
  const derived = derivedText(fields);
  const details = registry ? answeredDetails(shownDetails(registry, listing), listing) : [];
  const amenityText = listing.details.amenities ?? "";
  const location: { id: string; label: string; text: string }[] = [
    ...(cityName ? [{ id: "city", label: "City", text: cityName }] : []),
    ...(localityName ? [{ id: "locality", label: "Locality", text: localityName }] : []),
    ...PUBLIC_LOCATION_TEXT.filter((key) => listing.details[key]).map((key) => ({ id: key, label: label(key), text: listing.details[key] })),
  ];
  const states = (codes: string[], map: Record<string, string>) =>
    (["present", "none"] as const)
      .map((state) => {
        const names = codes.filter((code) => map[code] === state).map((code) => amenityLabel(code, catalogue.items));
        return names.length > 0 ? `${STATE_TEXT[state]}: ${names.join(", ")}.` : "";
      })
      .filter(Boolean)
      .join(" ");

  return (
    <dl className="detail-list" data-testid={`${testId}-facts`}>
      <div>
        <dt>Asking price</dt>
        <dd data-testid={`${testId}-price`}>{priceText(fields)}</dd>
      </div>
      <div>
        <dt>Area</dt>
        <dd data-testid={`${testId}-area`}>
          {areaSummary(fields)}
          {derived && ` — ${derived}`}
        </dd>
      </div>
      {location.map((item) => (
        <div key={item.id}>
          <dt>{item.label}</dt>
          <dd data-testid={`${testId}-location-${item.id}`}>{item.text}</dd>
        </div>
      ))}
      {details.map((item) => (
        <div key={item.id}>
          <dt>{item.label}</dt>
          <dd data-testid={`${testId}-detail-${item.id}`}>
            {item.href ? (
              // a link only, never an embed: nothing is loaded from the other site until it is followed
              <a href={item.href} className="text-link account-text" target="_blank" rel="noopener noreferrer nofollow ugc">
                {item.text}
              </a>
            ) : (
              item.text
            )}
            {item.sellerDeclared && <Declared />}
          </dd>
        </div>
      ))}
      {amenityText !== "" &&
        (catalogue.status === "ready" ? (
          <>
            {KIND_ORDER.map((kind) => {
              const codes = answeredOfKind(amenityText, catalogue.items, kind).map((item) => item.code);
              if (codes.length === 0) return null;
              return (
                <div key={kind}>
                  <dt>{KIND_TITLES[kind]}</dt>
                  <dd data-testid={`${testId}-amenities-${kind}`}>
                    {states(codes, decodeAmenities(amenityText))}
                    {kind === "nearby" && <Declared />}
                  </dd>
                </div>
              );
            })}
            {otherCodes(amenityText, catalogue.items).length > 0 && (
              <div>
                <dt>Other amenities</dt>
                <dd data-testid={`${testId}-amenities-other`}>{states(otherCodes(amenityText, catalogue.items), decodeAmenities(amenityText))}</dd>
              </div>
            )}
          </>
        ) : (
          <div>
            <dt>Amenities</dt>
            <dd>{catalogue.status === "loading" || catalogue.status === "idle" ? "Loading the amenities…" : "The amenities are not available right now."}</dd>
          </div>
        ))}
    </dl>
  );
}
