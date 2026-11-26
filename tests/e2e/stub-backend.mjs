// Minimal stand-in for the Django backend, used only by the Playwright tests.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

// The real API reports `error.fields` as arrays of static SENTENCES (backend `FIELD_MESSAGES`), not codes. The stub keeps the stories' codes
// in its handlers and turns them into the real sentences on the wire (`wireMode` "sentences", the default); "codes" sends them as they are.
// A value that is not a known code (a made-up sentence, an odd key) is sent unchanged either way.
const FIELD_SENTENCES = JSON.parse(readFileSync(new URL("./field-sentences.json", import.meta.url), "utf8"));
let wireMode = "sentences";
const wireFields = (fields) =>
  wireMode === "codes" || typeof fields !== "object" || fields === null
    ? fields
    : Object.fromEntries(
        Object.entries(fields).map(([key, values]) => [key, Array.isArray(values) ? values.map((value) => (typeof value === "string" && Object.hasOwn(FIELD_SENTENCES, value) ? FIELD_SENTENCES[value] : value)) : values]),
      );

let mode = "up";
let lastCookie = "";
let registrationMode = "accepted";
let lastRegistration = null;
let registrationCount = 0;
let confirmMode = "ok";
let confirmCount = 0;
let lastConfirm = null;
let resendMode = "accepted";
let resendCount = 0;
let lastResend = null;
// Session stand-in (Story 1.17): the cookie is stateful, so `me` is 401 before sign-in and after sign-out.
const SESSION_COOKIE = "estate_session=stub-live";
let signInMode = "ok";
let meMode = "up";
let signOutMode = "ok";
let liveSession = false;
// Administrator stand-ins (Story 1.23): the live session is either an ordinary one or an administrator one.
let sessionAdmin = false;
let adminSignInMode = "ok";
let adminMeMode = "up";
let adminSignInCount = 0;
let adminMeCount = 0;
let lastAdminSignIn = null;
let lastAdminSignInToken = null;
let csrfSeed = 0;
let csrfFetches = 0;
let signInCount = 0;
let signOutCount = 0;
let meCount = 0;
let unsafeCount = 0;
let lastSignIn = null;
let lastSignInToken = null;
let lastSignOutToken = null;
let csrfOnceSpent = false;
let csrfMode = "ok";
// Password reset and change stand-ins (Story 1.18).
let forgotMode = "accepted";
let forgotCount = 0;
let lastForgot = null;
let resetMode = "ok";
let resetCount = 0;
let lastReset = null;
let changeMode = "ok";
let changeCount = 0;
let lastChange = null;
let lastChangeToken = null;
// Agency registration and city reference stand-ins (Story 1.19).
let agencyMode = "accepted";
let agencyCount = 0;
let lastAgency = null;
let citiesMode = "ok";
let citiesCount = 0;
const CITIES = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Karachi" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Lahore" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Islamabad" },
];
// Localities (Story 2.7): Karachi has areas and societies, Islamabad one of each, Lahore none (an empty list); any other id is unknown (404).
let localitiesMode = "ok";
let localitiesCount = 0;
let localitiesAnswered = 0; // answers actually sent (a slow one counts when it leaves)
let localityCityIds = [];
const loc = (seq, name, kind) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(seq).padStart(12, "0")}`, name, kind });
const LOCALITIES = {
  "11111111-1111-4111-8111-111111111111": [
    loc(1, "Clifton", "area"),
    loc(2, "Gulshan-e-Iqbal", "area"),
    loc(3, "DHA Phase 6", "society"),
    loc(4, "Bahria Town Karachi", "society"),
  ],
  "22222222-2222-4222-8222-222222222222": [],
  "33333333-3333-4333-8333-333333333333": [loc(11, "Blue Area", "area"), loc(12, "Capital Heights", "society")],
};
const KARACHI = "11111111-1111-4111-8111-111111111111";
// Amenity catalogue (Story 2.8): EXACTLY the backend's seeded vocabulary, in its order (kind, then display order). `kind` is on_property,
// community or nearby; a nearby entry is the seller's own declaration (no distance, no verification anywhere).
let amenitiesMode = "ok";
let amenitiesCount = 0;
const am = (kind, group, code, label) => ({ code, label, kind, group });
const AMENITIES = [
  am("on_property", "utilities", "electricity_backup", "Electricity backup"),
  am("on_property", "utilities", "broadband_internet", "Broadband internet"),
  am("on_property", "utilities", "waste_disposal", "Waste disposal"),
  am("on_property", "building", "double_glazed_windows", "Double-glazed windows"),
  am("on_property", "building", "central_air_conditioning", "Central air conditioning"),
  am("on_property", "building", "central_heating", "Central heating"),
  am("on_property", "building", "elevator", "Elevator"),
  am("on_property", "building", "lobby", "Lobby"),
  am("on_property", "building", "intercom", "Intercom"),
  am("on_property", "business", "conference_room", "Conference room"),
  am("on_property", "business", "business_centre", "Business centre"),
  am("on_property", "business", "atm_in_building", "ATM in building"),
  am("community", "residential_community", "community_lawn", "Community lawn"),
  am("community", "residential_community", "swimming_pool", "Swimming pool"),
  am("community", "residential_community", "community_gym", "Gym"),
  am("community", "residential_community", "daycare", "Daycare"),
  am("community", "residential_community", "childrens_play_area", "Children's play area"),
  am("community", "residential_community", "bbq_area", "BBQ area"),
  am("community", "community_services", "community_mosque", "Community mosque"),
  am("community", "community_services", "medical_facility", "Medical facility"),
  am("community", "community_services", "community_centre", "Community centre"),
  am("nearby", "nearby", "nearby_mosque", "Mosque"),
  am("nearby", "nearby", "nearby_park", "Park"),
  am("nearby", "nearby", "nearby_gym", "Gym"),
  am("nearby", "nearby", "nearby_school", "School"),
  am("nearby", "nearby", "nearby_hospital", "Hospital"),
];
const ACTIVE_AMENITY_CODES = AMENITIES.map((entry) => entry.code);
/** The real rules for the amenity map (Story 2.8): { value } or { code }. `stored` is the Listing's map now (a deactivated code may be re-sent unchanged). */
const checkAmenities = (value, stored) => {
  if (value === null) return { value: null }; // null clears
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { code: "invalid" };
  const entries = Object.entries(value);
  // At most 40 entries. (The 41-entry test map is refused for this rule and also because most of its codes are not in the catalogue; the stub
  // cannot hold 41 active codes, the vocabulary has 26.)
  if (entries.length > 40) return { code: "invalid" };
  const kept = stored && typeof stored === "object" ? stored : {};
  for (const [code, state] of entries) {
    if (state !== "present" && state !== "none") return { code: "invalid" };
    if (!ACTIVE_AMENITY_CODES.includes(code) && !(Object.hasOwn(kept, code) && kept[code] === state)) return { code: "invalid" };
  }
  return { value: entries.length === 0 ? null : Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : 1))) };
};
/** Whether two stored values differ (the amenity map is compared by content, every other value by identity). */
const differs = (a, b) => (typeof a === "object" && a !== null) || (typeof b === "object" && b !== null) ? JSON.stringify(a ?? null) !== JSON.stringify(b ?? null) : (a ?? null) !== (b ?? null);
const cityOfLocality = (id) => Object.entries(LOCALITIES).find(([, list]) => list.some((entry) => entry.id === id))?.[0] ?? null;
// Profile and email change stand-ins (Story 1.20). The profile is stateful so a save shows on the next read.
const PROFILE_START = { full_name: "Ayesha Khan", phone: "+923001234567", email: "ayesha@example.com", pending_email: null };
let profile = { ...PROFILE_START };
let profileMode = "ok";
let profileGets = 0;
let profilePatchMode = "ok";
let profilePatchCount = 0;
let lastProfilePatch = null;
let lastProfilePatchToken = null;
let emailChangeMode = "ok";
let emailChangeCount = 0;
let lastEmailChange = null;
let lastEmailChangeToken = null;
let emailConfirmMode = "ok";
let emailConfirmCount = 0;
let lastEmailConfirm = null;
// Agency business profile stand-in (Story 1.21). Stateful like the individual profile; the email and pending address are
// shared with it so the email-change stubs work unchanged. The city is Karachi, which is in the active list.
const AGENCY_PROFILE_START = {
  agency_name: "Sunrise Estates",
  description: "Residential sales and rentals.",
  city_id: "11111111-1111-4111-8111-111111111111",
  business_phone: "+923211234567",
  office_address: "Office 12, Blue Plaza, Main Boulevard",
};
const INACTIVE_CITY = "77777777-7777-4777-8777-777777777777"; // a stored city that is not in the active list
let agencyProfile = { ...AGENCY_PROFILE_START };
let agencyProfileMode = "ok";
let agencyProfileGets = 0;
let agencyProfilePatchMode = "ok";
let agencyProfilePatchCount = 0;
let lastAgencyProfilePatch = null;
let lastAgencyProfilePatchToken = null;
// In-app notification stand-ins (Story 1.24). Stateful: marking read changes the list and the count. Newest first, `seq` is
// the position; a cursor is "pos-<seq>" (the items strictly older than that position). Ids are repetitive digit patterns.
const KIND_CYCLE = ["account.password_changed", "account.email_changed", "listing.mystery"];
const UNKNOWN_SECRET = "payload canary text";
const notificationId = (seq) => `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
function makeNotifications(total, isRead) {
  const items = [];
  for (let seq = total; seq >= 1; seq -= 1) {
    const kind = KIND_CYCLE[seq % 3];
    items.push({
      seq,
      id: notificationId(seq),
      kind,
      payload: kind === "listing.mystery" ? { secret_detail: UNKNOWN_SECRET } : {},
      created_at: new Date(Date.UTC(2026, 10, 20, 10, 0, 0) - seq * 60_000).toISOString(),
      read: isRead(seq),
    });
  }
  return items;
}
const NOTIFICATION_PRESETS = {
  default: () => makeNotifications(25, (seq) => seq % 2 === 0), // 25 items (two pages), the odd ones unread: 13 unread
  few: () => makeNotifications(3, (seq) => seq === 1), // newest three: 2 unread (seq 3 and 2), 1 read
  one_unread: () => makeNotifications(2, (seq) => seq === 2),
  empty: () => [],
  all_read: () => makeNotifications(4, () => true),
  many_unread: () => makeNotifications(120, () => false),
  unread_pages: () => makeNotifications(45, (seq) => seq % 3 === 0), // 30 unread: the Unread filter has two pages
};
let notifications = NOTIFICATION_PRESETS.default();
let cacheable = false; // test-only: answer list and count as cacheable, to prove the client never reuses a cached read
let accountVariant = "1"; // test-only: another id makes /me answer as another account
let notificationsMode = "ok";
let notificationsGets = 0;
let notificationQueries = [];
let notificationReadMode = "ok";
let notificationReadCount = 0;
let lastNotificationReadId = null;
let lastNotificationReadToken = null;
let notificationReadAllMode = "ok";
let notificationReadAllCount = 0;
let lastNotificationReadAllToken = null;
let unreadCountMode = "ok";
let unreadCountGets = 0;
// The owner's publication allowance (Story 2.14): `allowanceMode` shapes the answer (limit 2 for an Individual, 10 for an Agency;
// datetimes carry the +05:00 offset like the real API); `allowanceGets` counts the requests so tests can prove an administrator sends none.
let allowanceMode = "ok";
let allowanceGets = 0;
// Story 2.15: publishing. `publishMode` shapes the answer; `publishUsed` is the counted publications of this month per account (it adds to
// the allowance route's own base, so the card and the publish route agree); `publishRecords` are the claimed Idempotency-Keys (a refusal
// claims nothing, like the real transaction); `publishAttempts` lists every request that reached the route.
let publishMode = "ok";
let publishUsed = {};
let publishRecords = new Map();
let publishAttempts = [];
let publishLostSpent = false;
let publishReuseSpent = false;
let heldPublishAnswers = [];
const ALLOWANCE_BASE_USED = (limit) => ({ ok: 1, empty: 0, last: limit - 1, exhausted: limit, over: limit + 2, zero: 0 });
const publicNotification = (item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "seq"));
// Listings and the Field registry (Story 2.1). The registry serves the real taxonomy (or another one, to prove the choices
// come from it) with a strong ETag. Listings are stateful: a created Draft shows in the list and in the detail. Ids are
// repetitive digit patterns; `owner` is "mine" (the signed-in account) or "other" (never shown to it).
const TAXONOMIES = {
  default: {
    purposes: ["sale", "rent"],
    categories: [
      { id: "house", subtypes: ["house"] },
      { id: "apartment", subtypes: ["apartment"] },
      { id: "plot", subtypes: ["residential_plot", "commercial_plot", "plot_file"] },
      { id: "commercial", subtypes: ["shop", "office"] },
    ],
  },
  // One Subtype id (shared_unit) belongs to two Categories.
  shared: {
    purposes: ["sale", "rent"],
    categories: [
      { id: "villa", subtypes: ["shared_unit", "only_villa"] },
      { id: "bungalow", subtypes: ["shared_unit", "only_bungalow"] },
    ],
  },
  // A made-up commercial Subtype (`kiosk`): the labels follow the Category, so it needs no code.
  kiosk: {
    purposes: ["sale", "rent"],
    categories: [
      { id: "house", subtypes: ["house"] },
      { id: "apartment", subtypes: ["apartment"] },
      { id: "plot", subtypes: ["residential_plot", "commercial_plot", "plot_file"] },
      { id: "commercial", subtypes: ["shop", "office", "kiosk"] },
    ],
  },
  other: {
    purposes: ["sale", "rent", "lease_out"],
    categories: [
      { id: "villa", subtypes: ["farm_house", "beach_hut"] },
      { id: "plot", subtypes: ["plot_file"] },
    ],
  },
};
// The Field registry version 2 (Story 2.2) adds the five editable fields; version 3 (Story 2.3) adds the area fields. `other` has different limits and values to prove the
// editor is built from the registry; `none` defines no editable field.
const fieldDef = (id, type, requirement, extra = {}) => ({
  id,
  type,
  requirement,
  applicability: { purposes: [], categories: [], subtypes: [] },
  allowed_values: null,
  allowed_values_by_purpose: null,
  allowed_values_by_subtype: null,
  seller_declared: false,
  section: "details",
  min_length: null,
  max_length: null,
  min: null,
  max: null,
  currency: null,
  scale: null,
  derived: false,
  description: null,
  reference: null,
  class: "public",
  searchable: false,
  sortable: false,
  ai_extractable: false,
  valuation_input: false,
  quota_identity: false,
  ...extra,
});
const REGISTRY_FIELDS = {
  default: [
    // The identity set of the real registry (`quota_identity`): purpose, category and subtype are fields there too (the editor builds them by hand and never shows a control).
    fieldDef("purpose", "enum", "required_for_publication", { allowed_values: ["sale", "rent"], quota_identity: true }),
    fieldDef("category", "enum", "required_for_publication", { allowed_values: ["house", "apartment", "plot", "commercial"], quota_identity: true }),
    fieldDef("subtype", "enum", "required_for_publication", { allowed_values: ["house", "apartment", "residential_plot", "commercial_plot", "plot_file", "shop", "office"], quota_identity: true }),
    fieldDef("title", "text", "required_for_publication", { min_length: 10, max_length: 100, ai_extractable: true }),
    fieldDef("description", "text", "recommended", { min_length: 0, max_length: 5000, ai_extractable: true }),
    fieldDef("asking_price", "money", "required_for_publication", { min: "0.01", max: "999999999999.99", currency: "PKR", ai_extractable: true }),
    fieldDef("price_basis", "enum", "required_for_publication", {
      allowed_values: ["total", "per_unit", "rental_period"],
      allowed_values_by_purpose: { sale: ["total", "per_unit"], rent: ["rental_period"] },
    }),
    fieldDef("rental_period", "enum", "required_for_publication", {
      section: "terms",
      allowed_values: ["day", "week", "month", "year"],
      applicability: { purposes: ["rent"], categories: [], subtypes: [] },
    }),
    fieldDef("area_value", "decimal", "required_for_publication", { min: "0.0001", max: "9999999999.9999", scale: 4, searchable: true, sortable: true, ai_extractable: true, valuation_input: true, quota_identity: true }),
    fieldDef("area_unit", "enum", "required_for_publication", {
      allowed_values: ["sqft", "sqyd", "marla", "kanal", "acre"],
      searchable: true,
      ai_extractable: true,
      valuation_input: true,
      quota_identity: true,
    }),
    fieldDef("marla_basis", "enum", "optional", {
      allowed_values: ["225", "250", "272.25"],
      description: "Square feet in one marla.",
      ai_extractable: true,
      valuation_input: true,
    }),
    fieldDef("area_sqft", "decimal", "optional", { min: "0.0001", max: "9999999999.9999", scale: 4, derived: true, searchable: true, sortable: true, description: "Area in square feet, computed from the area, its unit and the marla size." }),
  ],
  other: [
    fieldDef("title", "text", "recommended", { min_length: 5, max_length: 20 }),
    fieldDef("description", "text", "optional", { min_length: 0, max_length: 50 }),
    fieldDef("asking_price", "money", "recommended", { min: "1.00", max: "9999.00", currency: "PKR" }),
    fieldDef("price_basis", "enum", "optional", {
      allowed_values: ["total", "per_unit", "rental_period"],
      allowed_values_by_purpose: { sale: ["total"], rent: ["rental_period"] },
    }),
    fieldDef("rental_period", "enum", "recommended", {
      section: "terms",
      allowed_values: ["day", "week"],
      applicability: { purposes: ["rent"], categories: [], subtypes: [] },
    }),
    // Other bounds, other units and other basis choices: the Area block is built from them.
    fieldDef("area_value", "decimal", "recommended", { min: "1", max: "9999", scale: 2 }),
    fieldDef("area_unit", "enum", "optional", { allowed_values: ["sqft", "marla", "kanal"] }),
    fieldDef("marla_basis", "enum", "optional", { allowed_values: ["225", "250"] }),
    fieldDef("area_sqft", "decimal", "optional", { min: "1", max: "9999", scale: 2, derived: true }),
  ],
  // A finer area scale (6 decimals) to prove the client compares amounts by the registry's scale.
  get scale6() {
    return this.default.map((entry) => (entry.id === "area_value" ? { ...entry, min: "0.000001", max: "9999999999.999999", scale: 6 } : entry));
  },
  none: [],
};
// Story 2.4: the thirty House and Apartment details of registry version 4, exactly as the backend defines them (bounds, choices,
// requirements, applicability by Subtype). Integer bounds are served as text, like the real registry.
const BOTH = { purposes: [], categories: [], subtypes: ["house", "apartment"] };
const subtypesOf = (...subtypes) => ({ purposes: [], categories: [], subtypes });
// Story 2.5: the shared details also apply to Shops and Offices (the same ids and columns).
const UNITS_AND_COMMERCIAL = subtypesOf("house", "apartment", "shop", "office");
const BUILDINGS = subtypesOf("apartment", "shop", "office");
const HOUSE = { purposes: [], categories: [], subtypes: ["house"] };
const APARTMENT = { purposes: [], categories: [], subtypes: ["apartment"] };
const intDef = (id, requirement, applicability, min, max, extra = {}) =>
  fieldDef(id, "integer", requirement, { applicability, min: min === null ? null : String(min), max: max === null ? null : String(max), ai_extractable: true, ...extra });
const boolDef = (id, requirement, applicability, extra = {}) => fieldDef(id, "boolean", requirement, { applicability, ai_extractable: true, ...extra });
const enumDef = (id, requirement, applicability, allowed_values, extra = {}) =>
  fieldDef(id, "enum", requirement, { applicability, allowed_values, ai_extractable: true, ...extra });
const ROOM_COUNTS = ["drawing_rooms", "dining_rooms", "tv_lounges", "study_rooms", "prayer_rooms", "store_rooms", "laundry_rooms", "powder_rooms", "servant_quarters"];
const RESIDENTIAL_DEFS = [
  intDef("bedrooms", "required_for_publication", BOTH, 0, 50, { description: "Number of bedrooms. 0 for a studio.", searchable: true, valuation_input: true }),
  intDef("bathrooms", "required_for_publication", BOTH, 0, 50, { searchable: true, valuation_input: true }),
  intDef("construction_year", "recommended", BOTH, 1900, 2100, { description: "Year the building was built.", valuation_input: true }),
  enumDef("condition", "recommended", UNITS_AND_COMMERCIAL, ["new", "excellent", "good", "needs_renovation"], { valuation_input: true }),
  enumDef("furnishing", "recommended", UNITS_AND_COMMERCIAL, ["unfurnished", "semi_furnished", "furnished"], { searchable: true }),
  intDef("parking_spaces", "recommended", UNITS_AND_COMMERCIAL, 0, 50, { searchable: true }),
  enumDef("occupancy_status", "recommended", UNITS_AND_COMMERCIAL, ["owner_occupied", "tenant_occupied", "vacant"]),
  fieldDef("covered_area_sqft", "decimal", "recommended", {
    applicability: BOTH,
    description: "Covered area in square feet, whatever unit the area uses.",
    min: "0.0001",
    max: "9999999999.9999",
    scale: 4,
    ai_extractable: true,
    valuation_input: true,
  }),
  intDef("total_floors", "recommended", HOUSE, 1, 200),
  intDef("kitchens", "recommended", HOUSE, 0, 50),
  enumDef("construction_status", "recommended", HOUSE, ["completed", "under_construction", "grey_structure"]),
  ...ROOM_COUNTS.map((id) => intDef(id, "optional", HOUSE, 0, 50)),
  boolDef("basement", "optional", HOUSE),
  intDef("floor_number", "recommended", BUILDINGS, 0, 200, { description: "Floor of the unit. 0 is the ground floor." }),
  intDef("building_floors", "recommended", BUILDINGS, 1, 200, { description: "Number of floors in the building." }),
  boolDef("lift", "recommended", subtypesOf("apartment", "office")),
  boolDef("backup_electricity", "recommended", APARTMENT),
  boolDef("building_security", "recommended", BUILDINGS),
  boolDef("balcony_or_terrace", "optional", APARTMENT),
  boolDef("building_lobby", "optional", BUILDINGS),
  boolDef("intercom", "optional", APARTMENT),
  fieldDef("maintenance_charges", "money", "optional", {
    applicability: BUILDINGS,
    description: "Maintenance charges in PKR per month.",
    min: "0",
    max: "999999999999.99",
    currency: "PKR",
    ai_extractable: true,
  }),
];
const RESIDENTIAL_IDS = RESIDENTIAL_DEFS.map((entry) => entry.id);
// Story 2.5: the Plot and Commercial details of registry version 5, as the backend serves them (feet and kW as decimal fields with scale 2,
// the seller-declared claims flagged, the Plot File's own possession vocabulary in `allowed_values_by_subtype`).
const PLOTS = subtypesOf("residential_plot", "commercial_plot", "plot_file");
const UTILITIES = subtypesOf("residential_plot", "commercial_plot", "plot_file", "shop", "office");
const COMMERCIAL = subtypesOf("shop", "office");
const measureDef = (id, requirement, applicability, min, max, extra = {}) =>
  fieldDef(id, "decimal", requirement, { applicability, min, max, scale: 2, ...extra });
const declared = { seller_declared: true };
const PLOT_COMMERCIAL_DEFS = [
  boolDef("electricity", "recommended", UTILITIES, { description: "Electricity connection available." }),
  boolDef("water", "recommended", UTILITIES, { description: "Water connection available." }),
  boolDef("gas", "optional", UTILITIES, { description: "Gas connection available." }),
  measureDef("plot_width", "recommended", PLOTS, "0.01", "99999.99", { description: "Plot width in feet.", ai_extractable: true, valuation_input: true }),
  measureDef("plot_depth", "recommended", PLOTS, "0.01", "99999.99", { description: "Plot depth in feet.", ai_extractable: true, valuation_input: true }),
  enumDef("possession_status", "recommended", PLOTS, ["possession_ready", "possession_pending", "file_only"], {
    ...declared,
    description: "As stated by the seller. A Plot File is never possession-ready.",
    ai_extractable: false,
    allowed_values_by_subtype: { residential_plot: ["possession_ready", "possession_pending"], commercial_plot: ["possession_ready", "possession_pending"], plot_file: ["file_only"] },
  }),
  boolDef("corner_plot", "recommended", PLOTS, { valuation_input: true }),
  measureDef("road_width_ft", "recommended", PLOTS, "1.00", "999.99", { description: "Width of the road in front, in feet.", ai_extractable: true, valuation_input: true }),
  enumDef("balloting_status", "recommended", PLOTS, ["not_applicable", "balloting_pending", "balloted"], { ...declared, ai_extractable: false }),
  boolDef("sewerage", "recommended", PLOTS),
  enumDef("development_status", "recommended", PLOTS, ["developed", "partially_developed", "undeveloped"], { ...declared, ai_extractable: false, valuation_input: true }),
  enumDef("approval_authority", "recommended", PLOTS, ["lda", "cda", "kda", "rda", "fda", "mda", "gda", "bda", "peshawar_development_authority", "private_society", "none", "other"], {
    ...declared,
    ai_extractable: false,
  }),
  boolDef("park_facing", "optional", PLOTS),
  boolDef("main_boulevard", "optional", PLOTS),
  boolDef("boundary_wall", "optional", PLOTS),
  enumDef("orientation", "optional", PLOTS, ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"]),
  enumDef("plot_file_status", "optional", subtypesOf("plot_file"), ["open_file", "allocation_letter", "possession_letter"], { ...declared, ai_extractable: false }),
  enumDef("business_use", "recommended", COMMERCIAL, ["retail", "restaurant", "office_work", "clinic", "warehouse", "showroom", "mixed", "other"]),
  measureDef("frontage_ft", "recommended", subtypesOf("shop"), "0.01", "9999.99", { description: "Width of the frontage in feet.", ai_extractable: true, valuation_input: true }),
  enumDef("road_access", "recommended", COMMERCIAL, ["main_road", "secondary_road", "inner_street"]),
  measureDef("ceiling_height_ft", "optional", COMMERCIAL, "1.00", "99.99", { description: "Ceiling height in feet.", ai_extractable: true }),
  measureDef("power_load_kw", "optional", COMMERCIAL, "0.01", "99999.99", { description: "Sanctioned power load in kilowatts.", ai_extractable: true }),
  boolDef("three_phase_electricity", "optional", COMMERCIAL),
  intDef("conference_rooms", "optional", subtypesOf("office"), 0, 50),
  boolDef("business_centre_facilities", "optional", subtypesOf("office")),
];
REGISTRY_FIELDS.default.push(...RESIDENTIAL_DEFS, ...PLOT_COMMERCIAL_DEFS);
// Story 2.6: the sale and rent terms of registry version 6, exactly as the backend defines them (descriptions copied from the real
// registry). Every one is `section: "terms"`, applicable by purpose only; `possession_availability` is seller-declared; a date serves its
// bounds as ISO text in `min` and `max`; the deposit and the advance accept zero.
const SALE = { purposes: ["sale"], categories: [], subtypes: [] };
const RENT = { purposes: ["rent"], categories: [], subtypes: [] };
const BOTH_PURPOSES = { purposes: [], categories: [], subtypes: [] };
const termDef = (id, type, requirement, applicability, extra = {}) => fieldDef(id, type, requirement, { section: "terms", applicability, ai_extractable: true, ...extra });
const MONEY_ZERO = { min: "0", max: "999999999999.99", currency: "PKR" };
const TERMS_DEFS = [
  termDef("price_negotiable", "boolean", "optional", BOTH_PURPOSES, { description: "The price can be discussed." }),
  termDef("possession_availability", "enum", "recommended", SALE, {
    description: "When the buyer can take possession, as the seller states it.",
    allowed_values: ["available_now", "within_one_month", "within_three_months", "after_three_months"],
    seller_declared: true,
    ai_extractable: false,
  }),
  termDef("security_deposit", "money", "recommended", RENT, { description: "Security deposit in PKR.", ...MONEY_ZERO }),
  termDef("availability_date", "date", "recommended", RENT, {
    description: "The date the property is available from, as a calendar date (YYYY-MM-DD).",
    min: "2000-01-01",
    max: "2100-12-31",
  }),
  termDef("advance_rent", "money", "optional", RENT, { description: "Rent paid in advance in PKR.", ...MONEY_ZERO }),
  termDef("minimum_lease_months", "integer", "optional", RENT, { description: "Shortest lease in months.", min: "1", max: "120" }),
  termDef("notice_period_days", "integer", "optional", RENT, { description: "Notice period in days.", min: "0", max: "365" }),
  termDef("utility_electricity_included", "boolean", "optional", RENT, { description: "Electricity is included in the rent." }),
  termDef("utility_gas_included", "boolean", "optional", RENT, { description: "Gas is included in the rent." }),
  termDef("utility_water_included", "boolean", "optional", RENT, { description: "Water is included in the rent." }),
  termDef("utility_internet_included", "boolean", "optional", RENT, { description: "Internet is included in the rent." }),
  termDef("pets_allowed", "boolean", "optional", RENT, { description: "Pets are allowed." }),
  termDef("occupant_restrictions", "enum", "optional", RENT, { description: "Who may rent, as the owner states it.", allowed_values: ["no_restriction", "families_only", "bachelors_only"] }),
];
REGISTRY_FIELDS.default.push(...TERMS_DEFS);
// Other limits, requirements and choices for a few of them (and none of the rest): the section follows the registry. `extra` adds
// fields no label knows (a yes/no, a choice, a count, a covered-area-like decimal with another scale, a field of a type with no control)
// to prove that a registry field needs no code of its own.
REGISTRY_FIELDS.other.push(
  intDef("bedrooms", "recommended", BOTH, 1, 9, { description: "Number of bedrooms." }),
  enumDef("condition", "optional", BOTH, ["new", "used"]),
  boolDef("lift", "required_for_publication", APARTMENT),
  intDef("kitchens", "optional", HOUSE, 1, 3),
);
// Another by-subtype map (and a by-purpose one, to prove the two are intersected): a Residential Plot may only state `possession_pending`, a
// Plot File offers two choices, the approval authority is no longer a claim and the condition is one. The form follows these, not code.
Object.defineProperty(REGISTRY_FIELDS, "plotmap", {
  enumerable: true,
  get() {
    return this.default.map((entry) => {
      if (entry.id === "possession_status") {
        return {
          ...entry,
          allowed_values_by_purpose: { sale: ["possession_pending", "file_only"], rent: ["possession_ready"] },
          allowed_values_by_subtype: { residential_plot: ["possession_pending"], commercial_plot: ["possession_ready"], plot_file: ["file_only", "possession_pending"] },
        };
      }
      if (entry.id === "approval_authority") return { ...entry, seller_declared: false };
      if (entry.id === "condition") return { ...entry, seller_declared: true };
      return entry;
    });
  },
});
// Story 2.6: another registry for the terms. The date window and the notice range change, the advance rent moves out of the Terms
// fieldset (`section: details`) and the deposit into it from nowhere else, the possession choices narrow, and a terms field of a type with
// no control (`deposit_scheme`) is served and gets none.
Object.defineProperty(REGISTRY_FIELDS, "termsother", {
  enumerable: true,
  get() {
    return [
      ...this.default.map((entry) => {
        if (entry.id === "availability_date") return { ...entry, min: "2026-01-01", max: "2027-12-31", requirement: "required_for_publication" };
        if (entry.id === "notice_period_days") return { ...entry, max: "90" };
        if (entry.id === "advance_rent") return { ...entry, section: "details", min: "10" };
        if (entry.id === "price_negotiable") return { ...entry, section: "details" };
        if (entry.id === "possession_availability") return { ...entry, allowed_values: ["available_now", "after_three_months"] };
        return entry;
      }),
      termDef("deposit_scheme", "geometry", "optional", RENT),
    ];
  },
});
// Date fields whose bounds cannot be trusted: a bound that is not a real date, junk text, none at all, and a window that ends before it starts.
// The form offers no min or max for any of them and prints no "Between" clause.
Object.defineProperty(REGISTRY_FIELDS, "baddates", {
  enumerable: true,
  get() {
    return [
      ...this.default,
      termDef("bad_date", "date", "optional", RENT, { description: "A date.", min: "2000-13-45", max: "2100-12-31" }),
      termDef("junk_date", "date", "optional", RENT, { description: "A date.", min: "junk", max: "soon" }),
      termDef("open_date", "date", "optional", RENT, { description: "A date.", min: null, max: null }),
      termDef("swapped_date", "date", "optional", RENT, { description: "A date.", min: "2030-01-01", max: "2020-01-01" }),
    ];
  },
});
// An older payload: no `section` key anywhere (the terms fall back to the Details, never guessed from applicability), and a marker that
// is not one of the two known values.
Object.defineProperty(REGISTRY_FIELDS, "nosection", {
  enumerable: true,
  get() {
    return this.default.map((entry) => {
      const older = { ...entry };
      delete older.section;
      return older;
    });
  },
});
Object.defineProperty(REGISTRY_FIELDS, "oddsection", {
  enumerable: true,
  get() {
    return this.default.map((entry) => (entry.id === "pets_allowed" ? { ...entry, section: "extras" } : entry));
  },
});
Object.defineProperty(REGISTRY_FIELDS, "kiosk", {
  enumerable: true,
  get() {
    return this.default.map((entry) =>
      entry.applicability.subtypes.includes("shop") ? { ...entry, applicability: { ...entry.applicability, subtypes: [...entry.applicability.subtypes, "kiosk"] } } : entry,
    );
  },
});
// The same registry with the two Story 2.5 keys missing from every field, like an older server.
Object.defineProperty(REGISTRY_FIELDS, "nokeys", {
  enumerable: true,
  get() {
    return this.default.map((entry) => {
      const older = { ...entry };
      delete older.seller_declared;
      delete older.allowed_values_by_subtype;
      return older;
    });
  },
});
// The possession list as a present-but-empty by-subtype map, and a by-purpose map that does not list the Draft's purpose: both fail closed.
Object.defineProperty(REGISTRY_FIELDS, "emptymap", {
  enumerable: true,
  get() {
    return this.default.map((entry) => (entry.id === "possession_status" ? { ...entry, allowed_values_by_subtype: {} } : entry));
  },
});
Object.defineProperty(REGISTRY_FIELDS, "purposegap", {
  enumerable: true,
  get() {
    return this.default.map((entry) => (entry.id === "possession_status" ? { ...entry, allowed_values_by_purpose: { rent: ["possession_ready", "possession_pending"] } } : entry));
  },
});
// A hand-built field a registry flags as the owner's claim.
Object.defineProperty(REGISTRY_FIELDS, "claimprice", {
  enumerable: true,
  get() {
    return this.default.map((entry) => (entry.id === "asking_price" ? { ...entry, seller_declared: true } : entry));
  },
});
Object.defineProperty(REGISTRY_FIELDS, "extra", {
  enumerable: true,
  get() {
    return [
      ...this.default,
      boolDef("swimming_pool", "optional", HOUSE),
      enumDef("roof_type", "recommended", BOTH, ["flat", "sloped"]),
      intDef("solar_panels", "required_for_publication", BOTH, 0, 99),
      fieldDef("garden_area_sqft", "decimal", "optional", { applicability: HOUSE, min: "1", max: "99999", scale: 2 }),
      intDef("garage_slots", "optional", HOUSE, 1, null), // one bound only

      fieldDef("agent_notes", "text", "optional", { applicability: BOTH, min_length: 0, max_length: 100 }),
      fieldDef("roof_geometry", "geometry", "optional", { applicability: BOTH }),
    ];
  },
});
// Story 2.7: the location of registry version 7 (shape 6), as the backend defines it: `city` and `locality` are `reference` fields, the
// public location text is class public, the private address (street, house number, coordinates) is class private. All in `section: location`.
const locDef = (id, type, requirement, extra = {}) => fieldDef(id, type, requirement, { section: "location", ...extra });
const LOCATION_DEFS = [
  locDef("city", "reference", "required_for_publication", { reference: "city", searchable: true, quota_identity: true }),
  locDef("locality", "reference", "required_for_publication", { reference: "locality", searchable: true, quota_identity: true }),
  ...["society", "phase", "sector", "block"].map((id) => locDef(id, "text", "optional", { min_length: 0, max_length: 60, ai_extractable: true })),
  locDef("street", "text", "optional", { min_length: 0, max_length: 120, class: "private" }),
  locDef("house_number", "text", "optional", { min_length: 0, max_length: 30, class: "private" }),
  locDef("latitude", "decimal", "optional", { min: "-90", max: "90", scale: 6, class: "private" }),
  locDef("longitude", "decimal", "optional", { min: "-180", max: "180", scale: 6, class: "private" }),
];
REGISTRY_FIELDS.default.push(...LOCATION_DEFS);
// Story 2.8: the amenity map of registry version 8 (shape 7): type `amenities`, `section: amenities`, public, optional, applies everywhere.
const AMENITIES_DEF = fieldDef("amenities", "amenities", "optional", {
  section: "amenities",
  searchable: true,
  valuation_input: true,
  description: "Amenities and nearby facilities as a map from a catalogue code to present or none. A code left out is unanswered, never none. Nearby facilities are the seller's own declaration.",
});
REGISTRY_FIELDS.default.push(AMENITIES_DEF);
// A location field with no `class` and one with an unknown `class`: both must be treated as private (fail closed).
Object.defineProperty(REGISTRY_FIELDS, "oddclass", {
  enumerable: true,
  get() {
    return this.default.map((entry) => {
      if (entry.id === "society") {
        const copy = { ...entry };
        delete copy.class;
        return copy;
      }
      return entry.id === "phase" ? { ...entry, class: "secret" } : entry;
    });
  },
});
const REGISTRY_VERSION = 10;
const REGISTRY_SHAPE = 7;
let fieldsName = "default";
let taxonomyName = "default";
let registryMode = "ok";
let registryGets = 0;
let registryNotModified = 0;
let lastRegistryConditional = null;
const listingId = (seq) => `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`;
const EMPTY_EDITABLE = {
  title: null,
  description: null,
  asking_price: null,
  price_basis: null,
  rental_period: null,
  area_value: null,
  area_unit: null,
  marla_basis: null,
  area_sqft: null,
  ...Object.fromEntries(RESIDENTIAL_IDS.map((id) => [id, null])),
  ...Object.fromEntries(PLOT_COMMERCIAL_DEFS.map((entry) => [entry.id, null])),
  ...Object.fromEntries(TERMS_DEFS.map((entry) => [entry.id, null])),
  ...Object.fromEntries(LOCATION_DEFS.map((entry) => [entry.id, null])),
  amenities: null,
};
// What a client may send (the derived square feet never): the real service answers `not_editable` for `area_sqft`.
const INPUT_FIELDS = Object.keys(EMPTY_EDITABLE).filter((key) => key !== "area_sqft");
// Area rules, exact like the real service: text only, no floats. Units measured in marla need the basis.
const MARLA_UNITS = ["marla", "kanal"];
const AREA_TEXT = /^(-)?(\d{1,30})(?:\.(\d{1,30}))?$/;
const toScaled = (text, scale) => {
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole + fraction.padEnd(scale, "0"));
};
const fromScaled = (value, scale) => {
  const digits = value.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
};
/** The real conversion: sqft 1, sqyd 9, acre 43560, marla = basis, kanal = 20 x basis, half up to four decimals. */
const normalisedSqft = (value, unit, basis) => {
  if (value === null || unit === null) return null;
  const bases = { 225: [225n, 1n], 250: [250n, 1n], 272.25: [27225n, 100n] };
  let factor;
  if (unit === "sqft") factor = [1n, 1n];
  else if (unit === "sqyd") factor = [9n, 1n];
  else if (unit === "acre") factor = [43560n, 1n];
  else if (MARLA_UNITS.includes(unit)) {
    if (basis === null || !Object.hasOwn(bases, basis)) return null;
    const [numerator, denominator] = bases[basis];
    factor = [numerator * (unit === "kanal" ? 20n : 1n), denominator];
  } else return null;
  const numerator = toScaled(value, 4) * factor[0] * 10000n;
  const denominator = 10000n * factor[1];
  return fromScaled((2n * numerator + denominator) / (2n * denominator), 4);
};
/** Keeps a stub Listing consistent after any area change: the basis only for marla and kanal, the square feet always derived. */
// A registry detail the editor builds generically: any non-derived field of a type with a control that is not hand-built.
const HAND_IDS = ["purpose", "category", "subtype", "title", "description", "asking_price", "price_basis", "rental_period", "area_value", "area_unit", "marla_basis", "area_sqft"];
const DETAIL_TYPES = ["integer", "boolean", "enum", "decimal", "money", "date"];
const currentDef = (id) => REGISTRY_FIELDS[fieldsName].find((entry) => entry.id === id);
const isInput = (key) => INPUT_FIELDS.includes(key) || (!HAND_IDS.includes(key) && DETAIL_TYPES.includes(currentDef(key)?.type) && !currentDef(key).derived);
/** Whether a field applies to a Listing, from the registry's applicability (an empty list means all). */
const applies = (rule, fields) =>
  [["purposes", fields.purpose], ["categories", fields.category], ["subtypes", fields.subtype]].every(([key, value]) => rule.applicability[key].length === 0 || rule.applicability[key].includes(value));
/** The real rules for a registry detail: [value, code]. Integers and yes/no only as JSON numbers and booleans; decimals and money as text. */
// A null is judged before this (it clears or is a no-op, even for a field that does not apply). The applicability rules themselves are
// owned and tested by the backend; the stub only mirrors them so the form can be exercised.
const AREA_CODE_IDS = ["area_value", "covered_area_sqft", "garden_area_sqft"];
const checkDetail = (rule, value, fields) => {
  if (!applies(rule, fields)) return { code: "not_applicable" };
  if (rule.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) return { code: "invalid" };
    return value < Number(rule.min) || value > Number(rule.max) ? { code: "invalid_range" } : { value };
  }
  if (rule.type === "boolean") return typeof value === "boolean" ? { value } : { code: "invalid" };
  if (rule.type === "enum") {
    if (typeof value !== "string") return { code: "invalid" };
    const byPurpose = rule.allowed_values_by_purpose?.[fields.purpose] ?? null;
    let allowed = byPurpose ?? rule.allowed_values ?? [];
    // A by-subtype map narrows to the Draft's Subtype (and to the purpose's list when there is one); a Subtype with no entry offers nothing.
    if (rule.allowed_values_by_subtype) {
      const own = rule.allowed_values_by_subtype[fields.subtype] ?? [];
      allowed = byPurpose ? own.filter((choice) => byPurpose.includes(choice)) : own;
    }
    return allowed.includes(value) ? { value } : { code: "invalid_choice" };
  }
  if (rule.type === "decimal") {
    const match = typeof value === "string" && value.length <= 40 ? AREA_TEXT.exec(value) : null;
    if (!match || (match[2].length > 1 && match[2].startsWith("0"))) return { code: "invalid" };
    const scale = rule.scale ?? 4;
    // The two area fields keep `invalid_area`; every other decimal (feet, kW) is `invalid_measure`.
    const code = AREA_CODE_IDS.includes(rule.id) ? "invalid_area" : "invalid_measure";
    if (match[1] || (match[3] ?? "").length > scale || match[2].length > 10) return { code };
    const scaled = toScaled(value, scale);
    return scaled < toScaled(rule.min, scale) || scaled > toScaled(rule.max, scale) ? { code } : { value: fromScaled(scaled, scale) };
  }
  if (rule.type === "money") {
    // Like the backend's check_money: text (surrounding whitespace trimmed) or a bare JSON integer; floats and booleans never.
    const text = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";
    const match = text.length > 0 && text.length <= 40 ? AREA_TEXT.exec(text) : null;
    if (!match) return { code: "invalid" };
    if (match[1] || (match[3] ?? "").length > 2) return { code: "invalid_price" };
    value = text;
    const cents = toScaled(value, 2);
    return cents < toScaled(rule.min, 2) || cents > toScaled(rule.max, 2) ? { code: "invalid_price" } : { value: fromScaled(cents, 2) };
  }
  if (rule.type === "date") {
    // Plain calendar text only (ASCII digits, a real date: arithmetic, never Date); a real date outside the registry window is `invalid_date`,
    // compared as text like the ISO strings they are.
    const match = typeof value === "string" ? /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value) : null;
    if (!match) return { code: "invalid" };
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days) return { code: "invalid" };
    return (rule.min && value < rule.min) || (rule.max && value > rule.max) ? { code: "invalid_date" } : { value };
  }
  return { code: "invalid" }; // a type with no editor
};
/** The real rules for one location field (Story 2.7): [value, code]. Ids are uuid text of a known city or locality; coordinates are signed decimal text. */
const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checkLocation = (rule, value) => {
  if (rule.type === "reference") {
    const text = typeof value === "string" && UUID_TEXT.test(value.trim()) ? value.trim().toLowerCase() : null;
    if (text === null) return { code: "invalid" };
    if (rule.reference === "city") return Object.hasOwn(LOCALITIES, text) ? { value: text } : { code: "invalid" };
    return cityOfLocality(text) !== null ? { value: text } : { code: "invalid" };
  }
  if (rule.type === "text") {
    if (typeof value !== "string" || /[\u0000-\u001F\u007F]/.test(value)) return { code: "invalid" };
    const text = value.normalize("NFC").replace(/\s+/g, " ").trim();
    if (text === "") return { value: null };
    if (Array.from(text).length > rule.max_length) return { code: "too_long" };
    if (/@|\b0\d{10}\b|\+\d{8,}/.test(text)) return { code: "contains_contact_details" };
    return { value: text };
  }
  const match = typeof value === "string" && value.length <= 40 ? AREA_TEXT.exec(value.trim()) : null;
  if (!match) return { code: "invalid" };
  if ((match[3] ?? "").length > 6) return { code: "out_of_range" };
  const scaled = toScaled(`${match[2]}.${match[3] ?? ""}`, 6);
  const signed = match[1] && scaled !== 0n ? -scaled : scaled;
  if (signed < BigInt(rule.min) * 1000000n || signed > BigInt(rule.max) * 1000000n) return { code: "out_of_range" };
  return { value: `${signed < 0n ? "-" : ""}${fromScaled(signed < 0n ? -signed : signed, 6)}` };
};
const settleArea = (fields) => {
  if (!MARLA_UNITS.includes(fields.area_unit)) fields.marla_basis = null;
  fields.area_sqft = normalisedSqft(fields.area_value, fields.area_unit, fields.marla_basis);
};
const makeListing = (seq, owner, fields, revision = 1) => ({
  seq,
  owner,
  id: listingId(seq),
  revision,
  registryVersion: 1,
  provenance: {},
  images: [],
  fields: { purpose: "sale", category: "house", subtype: "house", ...EMPTY_EDITABLE, ...fields },
});
// Story 2.10: images of a Draft, in position order (0-based, contiguous, exactly one cover while there are any). The stub serves one
// tiny valid PNG for every image, so `bytes` and the sizes below are only what the wire reports.
const IMAGE_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const imageId = (seq) => `00000000-0000-4000-a000-${String(seq).padStart(12, "0")}`;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BODY = 6 * 1024 * 1024;
const newImage = (seq, position, cover, type = "image/png") => ({ id: imageId(seq), position, is_cover: cover, content_type: type, width: 800, height: 600, bytes: 12345 });
const withImages = (item, count, coverAt = 0) => {
  item.images = Array.from({ length: count }, (_, index) => newImage(index + 1, index, index === coverAt));
  return item;
};
// A wire the page must refuse to build on (the list is not trusted): set with /__image-wire-mode, only the media of the answer changes.
let imageWireMode = "ok";
const spoilMedia = (media) => {
  if (imageWireMode === "not_list") return "none";
  if (media.length === 0) return media;
  const copy = media.map((entry) => ({ ...entry }));
  if (imageWireMode === "bad_url") copy[0].url = "https://elsewhere.example/a.png";
  if (imageWireMode === "other_listing_url") copy[0].url = copy[0].url.replace(/listings\/[^/]+/, "listings/00000000-0000-4000-9000-000000000099");
  if (imageWireMode === "two_covers") copy.forEach((entry) => (entry.is_cover = true));
  // Ghost repair states the backend may serve (still trusted): gappy positions, no cover.
  if (imageWireMode === "ghost_gap") copy.forEach((entry, index) => (entry.position = index * 2));
  if (imageWireMode === "ghost_no_cover") copy.forEach((entry) => (entry.is_cover = false));
  // Positions that cannot be trusted.
  if (imageWireMode === "dup_position" && copy.length > 1) copy[1].position = copy[0].position;
  if (imageWireMode === "decreasing" && copy.length > 1) copy[0].position = 5;
  if (imageWireMode === "negative_position") copy[0].position = -1;
  if (imageWireMode === "string_position") copy[0].position = "0";
  if (imageWireMode === "dup_id" && copy.length > 1) copy[1].id = copy[0].id;
  if (imageWireMode === "bad_id") copy[0].id = "not-an-id";
  return copy;
};
const publicImage = (item, image) => ({ ...image, url: `/api/v1/listings/${item.id}/images/${image.id}/file` });
const publicListing = (item) => ({
  id: item.id,
  status: item.status ?? "draft",
  visibility: "private",
  revision: item.revision,
  registry_version: item.registryVersion,
  fields: item.fields,
  provenance: item.provenance,
  media: spoilMedia(item.images.map((image) => publicImage(item, image))),
  restricted: item.restricted === true,
  restriction_reason: item.restrictionReason ?? null,
});
const statusOf = (item) => item.status ?? "draft";
/** Story 2.17: only a Draft, Published or Archived Listing that is not restricted can be edited; the rest is view only. */
const editableListing = (item) => item.restricted !== true && ["draft", "published", "archived"].includes(statusOf(item));
// Story 2.18: the identity fields the quota rule watches (the registry's `quota_identity` ones) and the current Karachi month (the allowance's period).
const IDENTITY_FIELDS = ["purpose", "category", "subtype", "city", "locality", "area_value", "area_unit"];
const KARACHI_MONTH = "2026-11";
const canonicalNumber = (value) => (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)) ? String(Number(value)) : value ?? null);
const identityFingerprint = (item) => JSON.stringify(IDENTITY_FIELDS.map((name) => (name === "area_value" ? canonicalNumber(item.fields[name]) : item.fields[name] ?? null)));
/** A Listing whose last counted publication was in `month` with its identity as it is now. */
const countedIn = (item, month, at = Date.now() - 60 * 60 * 1000) => Object.assign(item, { baseline: { month, fp: identityFingerprint(item), at, used: false } });
// Story 2.19: the correction window is 24 hours after the last counted publication, once.
const CORRECTION_HOURS = 24 * 60 * 60 * 1000;
const correctionEnds = (item) => {
  const baseline = item.baseline;
  if (statusOf(item) !== "published" || item.restricted === true || !baseline || baseline.used || !baseline.at) return null;
  return Date.now() < baseline.at + CORRECTION_HOURS ? baseline.at + CORRECTION_HOURS : null;
};
/** ISO 8601 in the Karachi offset, like the backend. */
const karachiIso = (ms) => `${new Date(ms + 5 * 60 * 60 * 1000).toISOString().slice(0, 19)}+05:00`;
let correctionMode = "ok";
let correctionAttempts = [];
let correctionGets = 0;
let heldCorrectionAnswers = [];
const STATUS_NAMES = ["draft", "published", "archived", "sold", "rented", "removed"];
const publishReady = (seq) =>
  withImages(
    makeListing(
      seq,
      "mine",
      {
        title: "Corner house with garden",
        asking_price: "1500000.00",
        price_basis: "total",
        area_value: "10.0000",
        area_unit: "marla",
        marla_basis: "272.25",
        area_sqft: "2722.5000",
        bedrooms: 3,
        bathrooms: 2,
        city: KARACHI,
        locality: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
      },
      4,
    ),
    2,
  );
const LISTING_PRESETS = {
  empty: () => [],
  few: () => [
    makeListing(3, "mine", { purpose: "rent", category: "apartment", subtype: "apartment" }),
    makeListing(2, "mine", { purpose: "sale", category: "plot", subtype: "plot_file" }),
    makeListing(1, "mine", { purpose: "sale", category: "house", subtype: "house" }),
  ],
  many: () => Array.from({ length: 25 }, (_, index) => makeListing(25 - index, "mine", { purpose: index % 2 ? "rent" : "sale" })),
  capped: () => Array.from({ length: 20 }, (_, index) => makeListing(20 - index, "mine", {})),
  unknown: () => [
    makeListing(3, "mine", { purpose: null, category: null, subtype: null }),
    makeListing(2, "mine", { purpose: "lease_out", category: "villa", subtype: "farm_house" }),
  ],
  foreign: () => [makeListing(1, "mine", {}), makeListing(900, "other", { purpose: "rent", category: "commercial", subtype: "shop" })],
  // Story 2.2: one sale Draft with its editable fields set (revision 3), one rent Draft with nothing set, one rent Draft filled.
  titled: () => [
    makeListing(
      1,
      "mine",
      { title: "Corner house with garden", description: "Three bedrooms near the park.", asking_price: "1500000.00", price_basis: "total" },
      3,
    ),
  ],
  // Story 2.3: a Draft with a marla and its basis (10 x 272.25), one with an unknown basis, and one in square feet.
  area_marla: () => [makeListing(1, "mine", { area_value: "10.0000", area_unit: "marla", marla_basis: "272.25", area_sqft: "2722.5000" }, 2)],
  area_unknown: () => [makeListing(1, "mine", { area_value: "5.0000", area_unit: "marla" }, 2)],
  area_sqft: () => [makeListing(1, "mine", { area_value: "1200.0000", area_unit: "sqft", area_sqft: "1200.0000" }, 2)],
  // Story 2.4: Drafts with no details, and with details (revision 2); zero is an answer, unanswered stays null.
  house_blank: () => [makeListing(1, "mine", {})],
  apartment_blank: () => [makeListing(1, "mine", { category: "apartment", subtype: "apartment" })],
  house_details: () => [
    makeListing(1, "mine", { bedrooms: 4, bathrooms: 3, total_floors: 2, kitchens: 1, condition: "good", basement: true, covered_area_sqft: "2400.5000" }, 2),
  ],
  apartment_details: () => [
    makeListing(
      1,
      "mine",
      { category: "apartment", subtype: "apartment", bedrooms: 2, bathrooms: 2, floor_number: 5, building_floors: 12, lift: true, backup_electricity: false, furnishing: "semi_furnished", maintenance_charges: "2500.00" },
      2,
    ),
  ],
  // Story 2.13: a Draft with content for the preview (private address, coordinates and a phone-like canary included: none may reach the preview page),
  // two images, and one Published Listing (which cannot be deleted).
  preview_rich: () => [
    withImages(
      makeListing(
        1,
        "mine",
        {
          title: "Corner house with garden",
          description: "Three bedrooms near the park.\nQuiet street.",
          asking_price: "1500000.00",
          price_basis: "total",
          area_value: "10.0000",
          area_unit: "marla",
          marla_basis: "272.25",
          area_sqft: "2722.5000",
          bedrooms: 4,
          bathrooms: 3,
          condition: "good",
          basement: true,
          city: KARACHI,
          locality: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
          society: "Palm Society",
          phase: "Phase Two",
          amenities: { elevator: "present", community_gym: "present", nearby_school: "present" },
          street: "Cedar Lane",
          house_number: "Plot 12",
          latitude: "24.860000",
          longitude: "67.010000",
        },
        2,
      ),
      2,
    ),
  ],
  // Published with images: the image `url` is the same media route a Draft's owner reads (the backend serves it publicly once published).
  published_with_images: () => [Object.assign(withImages(makeListing(1, "mine", { title: "Published house", asking_price: "2500000.00", price_basis: "total" }, 4), 2), { status: "published" })],
  published_one: () => [Object.assign(makeListing(1, "mine", { title: "Published house" }, 4), { status: "published" })],
  // Story 2.7: a Draft with the location and the private address set (revision 2).
  location_filled: () => [
    makeListing(
      1,
      "mine",
      { city: KARACHI, locality: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003", society: "Palm Society", phase: "Phase Two", sector: "Sector Nine", block: "Block Seven", street: "Cedar Lane", house_number: "Plot 12", latitude: "24.860000", longitude: "67.010000" },
      2,
    ),
  ],
  // A saved city and locality that are no longer in the lists (deactivated since).
  location_gone: () => [makeListing(1, "mine", { city: "99999999-9999-4999-8999-999999999999", locality: "99999999-9999-4999-8999-999999999998" }, 2)],
  // Story 2.8: a Draft with answered amenities (one nearby), one holding a deactivated code (old_sauna) beside active ones, and blank ones.
  amenities_filled: () => [makeListing(1, "mine", { amenities: { elevator: "present", lobby: "none", community_gym: "present", nearby_school: "present", nearby_park: "none" } }, 2)],
  amenities_inactive: () => [makeListing(1, "mine", { amenities: { elevator: "present", old_sauna: "present", former_helipad: "none" } }, 2)],
  amenities_bad_state: () => [makeListing(1, "mine", { amenities: { elevator: "maybe" } }, 2)],
  amenities_empty_state: () => [makeListing(1, "mine", { amenities: { elevator: "" } }, 2)],
  amenities_null_state: () => [makeListing(1, "mine", { amenities: { elevator: null } }, 2)],
  amenities_number_state: () => [makeListing(1, "mine", { amenities: { elevator: 1 } }, 2)],
  amenities_bad_code: () => [makeListing(1, "mine", { amenities: { Elevator: "present" } }, 2)],
  amenities_not_object: () => [makeListing(1, "mine", { amenities: ["elevator"] }, 2)],
  house_zero: () => [makeListing(1, "mine", { bedrooms: 0, kitchens: 0, basement: false }, 2)],
  // Stored values the form cannot represent: a float for an integer, a JSON number for a decimal, a text for a yes/no, a choice outside the
  // registry, an unsafe integer, and a poisoned key.
  house_odd: () => [
    makeListing(1, "mine", { ...JSON.parse('{"__proto__": 7}'), bedrooms: 3.5, kitchens: 1e21, condition: "mint", basement: "maybe", covered_area_sqft: 1200.5 }, 2),
  ],
  // Story 2.5: a Residential Plot, a Plot File, a Shop and an Office, blank and with details (revision 2). Feet and kW are decimal
  // strings at the registry scale; the claims (possession, approval, development, balloting, plot file status) are the owner's.
  plot_blank: () => [makeListing(1, "mine", { category: "plot", subtype: "residential_plot" })],
  plot_file_blank: () => [makeListing(1, "mine", { category: "plot", subtype: "plot_file" })],
  shop_blank: () => [makeListing(1, "mine", { category: "commercial", subtype: "shop" })],
  kiosk_blank: () => [makeListing(1, "mine", { category: "commercial", subtype: "kiosk" })],
  // A Plot File that stores a possession the Plot File never offers (from before the rule): it must stay visible and be fixable.
  plot_file_stale: () => [makeListing(1, "mine", { category: "plot", subtype: "plot_file", possession_status: "possession_ready" }, 2)],
  office_blank: () => [makeListing(1, "mine", { category: "commercial", subtype: "office" })],
  plot_details: () => [
    makeListing(
      1,
      "mine",
      {
        category: "plot",
        subtype: "residential_plot",
        plot_width: "35.00",
        plot_depth: "70.50",
        possession_status: "possession_ready",
        corner_plot: true,
        road_width_ft: "40.00",
        development_status: "developed",
        approval_authority: "lda",
        sewerage: false,
        electricity: true,
      },
      2,
    ),
  ],
  plot_file_details: () => [
    makeListing(1, "mine", { category: "plot", subtype: "plot_file", possession_status: "file_only", plot_file_status: "allocation_letter", approval_authority: "private_society", plot_width: "30.00" }, 2),
  ],
  shop_details: () => [
    makeListing(
      1,
      "mine",
      { category: "commercial", subtype: "shop", business_use: "retail", frontage_ft: "18.00", road_access: "main_road", condition: "good", furnishing: "semi_furnished", floor_number: 1, building_floors: 4, power_load_kw: "12.50", three_phase_electricity: true, maintenance_charges: "4000.00" },
      2,
    ),
  ],
  office_details: () => [
    makeListing(
      1,
      "mine",
      { category: "commercial", subtype: "office", business_use: "office_work", road_access: "secondary_road", lift: true, conference_rooms: 3, floor_number: 2, building_floors: 8, ceiling_height_ft: "10.50", business_centre_facilities: false },
      2,
    ),
  ],
  // Story 2.10: a Draft (revision 2, with a title so the form shows) with no images, one, three (the cover is the second) and the limit of ten.
  images_none: () => [makeListing(1, "mine", { title: "Corner house with garden" }, 2)],
  images_one: () => [withImages(makeListing(1, "mine", { title: "Corner house with garden" }, 2), 1)],
  images_three: () => [withImages(makeListing(1, "mine", { title: "Corner house with garden" }, 2), 3, 1)],
  images_ten: () => [withImages(makeListing(1, "mine", { title: "Corner house with garden" }, 2), 10)],
  images_nine: () => [withImages(makeListing(1, "mine", { title: "Corner house with garden" }, 2), 9)],
  rent: () => [makeListing(1, "mine", { purpose: "rent", category: "apartment", subtype: "apartment" })],
  // Story 2.6: a sale Draft and a rent Draft with terms (revision 2), and a rent Draft with nothing set (no rental period, no terms). False
  // and zero are answers. Low-entropy fake values only.
  sale_terms: () => [makeListing(1, "mine", { asking_price: "1500000.00", price_basis: "total", price_negotiable: true, possession_availability: "within_one_month" }, 2)],
  sale_terms_blank: () => [makeListing(1, "mine", { category: "apartment", subtype: "apartment" })],
  rent_terms: () => [
    makeListing(
      1,
      "mine",
      {
        purpose: "rent",
        category: "apartment",
        subtype: "apartment",
        asking_price: "85000.00",
        price_basis: "rental_period",
        rental_period: "month",
        security_deposit: "170000.00",
        availability_date: "2027-03-01",
        advance_rent: "0.00",
        minimum_lease_months: 12,
        notice_period_days: 0,
        utility_electricity_included: true,
        utility_gas_included: false,
        pets_allowed: false,
        occupant_restrictions: "families_only",
        price_negotiable: false,
      },
      2,
    ),
  ],
  rent_terms_blank: () => [makeListing(1, "mine", { purpose: "rent", category: "apartment", subtype: "apartment" })],
  terms_unknown_purpose: () => [makeListing(1, "mine", { purpose: "lease_out", category: "house", subtype: "house" })],
  shop_rent_blank: () => [makeListing(1, "mine", { purpose: "rent", category: "commercial", subtype: "shop" })],
  plot_rent_blank: () => [makeListing(1, "mine", { purpose: "rent", category: "plot", subtype: "residential_plot" })],
  house_rent_terms_blank: () => [makeListing(1, "mine", { purpose: "rent", category: "house", subtype: "house" })],
  // Story 2.15: a Draft that can be published (everything the default registry requires, one image), two of them (the second finds the
  // allowance used up when the allowance is "last"), a bare Draft (nothing required is set), a rent Draft missing only its rental period,
  // a Draft whose street was filled in by the Assistant and not confirmed, and a ready Draft that has no image.
  publish_ready: () => [publishReady(1)],
  publish_two: () => [publishReady(2), publishReady(1)],
  publish_empty: () => [makeListing(1, "mine", {}, 2)],
  publish_no_image: () => [Object.assign(publishReady(1), { images: [] })],
  publish_rent_no_period: () => [Object.assign(publishReady(1), { fields: { ...publishReady(1).fields, purpose: "rent", category: "apartment", subtype: "apartment", price_basis: "rental_period", rental_period: null, bathrooms: 2, bedrooms: 1, lift: true } })],
  publish_ai_street: () => [Object.assign(publishReady(1), { provenance: { street: { origin: "ai", confirmed: false } } }, { fields: { ...publishReady(1).fields, street: "Cedar Lane" } })],
  publish_cleared_city: () => [Object.assign(publishReady(1), { fields: { ...publishReady(1).fields, city: null, locality: null } })],
  // Story 2.17: Listings in every status. A Published one is complete (it can be edited without becoming invalid), has two images and
  // revision 4; the rent one is an apartment for rent.
  published_sale: () => [Object.assign(publishReady(1), { status: "published" })],
  published_rent: () => [Object.assign(publishReady(1), { status: "published", fields: { ...publishReady(1).fields, purpose: "rent", category: "apartment", subtype: "apartment", price_basis: "rental_period", rental_period: "month" } })],
  published_one_image: () => [Object.assign(withImages(publishReady(1), 1), { status: "published" })],
  archived_one: () => [Object.assign(publishReady(1), { status: "archived" })],
  // Story 2.18: archived listings for republication. `archived_one` has no counted baseline (counted); the baseline of the others is a month and the identity as saved.
  published_counted: () => [countedIn(Object.assign(publishReady(1), { status: "published" }), KARACHI_MONTH)],
  archived_free: () => [countedIn(Object.assign(publishReady(1), { status: "archived" }), KARACHI_MONTH)],
  archived_last_month: () => [countedIn(Object.assign(publishReady(1), { status: "archived" }), "2026-10")],
  archived_two: () => [countedIn(Object.assign(publishReady(2), { status: "archived" }), KARACHI_MONTH), Object.assign(publishReady(1), { status: "archived" })],
  archived_no_image: () => [Object.assign(publishReady(1), { status: "archived", images: [] })],
  archived_empty: () => [Object.assign(makeListing(1, "mine", {}, 2), { status: "archived" })],
  archived_ai_street: () => [Object.assign(publishReady(1), { status: "archived", provenance: { street: { origin: "ai", confirmed: false } } }, { fields: { ...publishReady(1).fields, street: "Cedar Lane" } })],
  restricted_archived: () => [Object.assign(publishReady(1), { status: "archived", restricted: true, restrictionReason: "Under review." })],
  sold_one: () => [Object.assign(publishReady(1), { status: "sold" })],
  rented_one: () => [Object.assign(publishReady(1), { status: "rented", fields: { ...publishReady(1).fields, purpose: "rent", category: "apartment", subtype: "apartment", price_basis: "rental_period", rental_period: "month" } })],
  removed_one: () => [Object.assign(publishReady(1), { status: "removed", restrictionReason: "Removed after a report about the photos." })],
  restricted_one: () => [Object.assign(publishReady(1), { status: "published", restricted: true, restrictionReason: "Under review: the price looks wrong." })],
  restricted_draft: () => [Object.assign(publishReady(1), { restricted: true, restrictionReason: "Under review." })],
  restricted_sold: () => [Object.assign(publishReady(1), { status: "sold", restricted: true, restrictionReason: "Under review." })],
  // Two drafts, three published (newest first), one archived, one sold, one rented, one removed.
  lifecycle: () => [
    Object.assign(publishReady(9), { status: "removed", restrictionReason: "Removed after a report about the photos." }),
    Object.assign(publishReady(8), { status: "rented", fields: { ...publishReady(8).fields, purpose: "rent", category: "apartment", subtype: "apartment" } }),
    Object.assign(publishReady(7), { status: "sold" }),
    Object.assign(publishReady(6), { status: "archived" }),
    Object.assign(publishReady(5), { status: "published", fields: { ...publishReady(5).fields, purpose: "rent", category: "apartment", subtype: "apartment", price_basis: "rental_period", rental_period: "month" } }),
    Object.assign(publishReady(4), { status: "published" }),
    Object.assign(publishReady(3), { status: "published" }),
    makeListing(2, "mine", { purpose: "rent", category: "apartment", subtype: "apartment" }),
    makeListing(1, "mine", {}),
  ],
  // Only drafts and archived: the default tab is the first one that is not empty (Draft).
  lifecycle_no_published: () => [Object.assign(publishReady(3), { status: "archived" }), makeListing(2, "mine", {}), makeListing(1, "mine", {})],
  lifecycle_only_removed: () => [Object.assign(publishReady(1), { status: "removed", restrictionReason: "Removed after a report about the photos." })],
  // 25 Published listings: the Published tab needs load more.
  published_many: () => Array.from({ length: 25 }, (_, index) => Object.assign(publishReady(25 - index), { status: "published" })),
  // 25 Published listings and one Draft: the Published tab has a load more and the Draft tab one row.
  published_many_and_draft: () => [...Array.from({ length: 25 }, (_, index) => Object.assign(publishReady(26 - index), { status: "published" })), makeListing(1, "mine", {})],
  rent_filled: () => [
    makeListing(
      1,
      "mine",
      { purpose: "rent", category: "apartment", subtype: "apartment", title: "Bright apartment near the market", asking_price: "85000.00", price_basis: "rental_period", rental_period: "month" },
      2,
    ),
  ],
};
let listings = LISTING_PRESETS.empty();
let listingsMode = "ok";
let listingsGets = 0;
let listingQueries = [];
let createMode = "ok";
let createCount = 0;
let lastCreate = null;
let lastCreateToken = null;
let detailMode = "ok";
let countsMode = "ok";
let countsGets = 0;
let statusMode = "ok";
let statusAttempts = [];
let statusLostSpent = false;
let heldStatusAnswers = [];
let patchMode = "ok";
// Story 2.13: the owner's preview and delete. Modes shape the answers; the lists keep what the page did.
let previewMode = "ok";
let previewGets = 0;
let lastPreviewId = null;
let previewIds = [];
let deleteMode = "ok";
let listingDeletes = [];
let heldDeleteAnswers = []; // delete answers held open by deleteMode "hold" until /__listing-delete-release
let listingDeleteTokens = [];
let patchCount = 0;
let patchBodies = [];
let patchTokens = [];
let patchLostSpent = false;
let detailGets = 0;
let lastDetailId = null;
const pending = []; // responses held open by the hang mode
// Story 2.10 image stand-ins: three modes (upload, order, delete) plus the media endpoint, with counters for the tests.
let imageMode = "ok";
let imageOrderMode = "ok";
let imageDeleteMode = "ok";
let imageFileMode = "ok";
let imageSeq = 100;
let imageLostSpent = false;
let imageAttempts = 0; // every upload request that reached the stub, refused or not
let imageUploads = []; // what each upload attempt carried: part names, size and the type the stub read from the magic bytes
let imageOrderBodies = [];
let imageDeletes = [];
let imageFileGets = 0;
let imageFileHeads = 0;
let imageTokens = [];

// Story 2.11 profile picture and Agency logo stand-ins. The stub keeps the uploaded bytes and serves them back, like the backend (which
// re-encodes: this one does not). The Agency's public id is a fixed low-entropy UUID; the public logo is served only while `logoMode` is "active".
const AGENCY_PUBLIC_ID = "55555555-5555-4555-8555-555555555555";
let profileImages = { individual: null, agency: null }; // { type, data } once set
let profileImageMode = "ok";
let profileImageDeleteMode = "ok";
let profileImageFileMode = "ok";
let profileImageWireMode = "ok";
let logoMode = "active";
let profileImageAttempts = 0; // every upload request that reached the stub, refused or not
let profileImagePuts = 0; // the ones the 10-per-hour limit counts
let profileImageUploads = [];
let profileImageDeletes = [];
let profileImageFileGets = 0;
let profileImageFileHeads = 0;
let profileImageTokens = [];
let profileImageLostSpent = false;
let profileImageAborted = 0; // held uploads whose client gave up before the answer
let logoRequests = [];
let heldImageAnswers = []; // answers held open by the "hold" modes until /__profile-image-release
let heldUploadAnswers = []; // gallery upload answers held open by imageMode "hold" until /__image-release
let heldProfileReads = []; // profile reads held open by the "hold" profile modes until /__profile-release
const ownerImageUrl = (kind) => (kind === "individual" ? "/api/v1/me/profile/image/file" : "/api/v1/me/agency-profile/image/file");
function wireImage(kind) {
  const stored = profileImages[kind];
  if (!stored) return null;
  const image = { content_type: stored.type, width: 800, height: 600, bytes: stored.data.length, url: ownerImageUrl(kind) };
  if (profileImageWireMode === "string_image") return "none";
  if (profileImageWireMode === "bad_url") image.url = "https://elsewhere.example/a.png";
  if (profileImageWireMode === "other_route") image.url = ownerImageUrl(kind === "individual" ? "agency" : "individual");
  if (profileImageWireMode === "bad_type") image.content_type = "image/gif";
  if (profileImageWireMode === "zero_dims") image.width = 0;
  return image;
}
const profileBody = () => ({ ...profile, image: wireImage("individual") });
const agencyIdentifiers = () => ({
  agency_id: profileImageWireMode === "bad_agency_id" ? "not-a-uuid" : profileImageWireMode === "upper_ids" ? AGENCY_PUBLIC_ID.toUpperCase() : AGENCY_PUBLIC_ID,
  logo_url:
    profileImageWireMode === "bad_logo_url"
      ? "https://elsewhere.example/logo"
      : profileImages.agency
        ? `/api/v1/agencies/${profileImageWireMode === "upper_ids" ? AGENCY_PUBLIC_ID.toUpperCase() : AGENCY_PUBLIC_ID}/logo`
        : null,
});

// Story 2.20: the administrator's publication limits and this month's usage (masked addresses, 20 per page).
const quotaRows = () => [
  { account_type: "individual", monthly_limit: 2, effective_from: "2026-01-01T00:00:00+05:00" },
  { account_type: "agency", monthly_limit: 10, effective_from: "2026-01-01T00:00:00+05:00" },
];
const QUOTA_MODES = ["ok", "load_error", "empty", "more_fail", "stale_cursor", "put_error", "put_invalid", "csrf_once", "csrf_always", "session_gone"];
let quotaPolicy = quotaRows();
let quotaMode = "ok";
let quotaStats = { policyGets: 0, usageGets: 0, puts: [] };

// Story 2.21: the one account the administrator can look up (stateful), and the reason a Suspended session reads in `me`.
const ACCOUNT_ID = "00000000-0000-4000-c000-000000000001";
const SUSPENSION_REASON = "Repeated misleading listings.";
const adminAccountRow = () => ({
  id: ACCOUNT_ID,
  account_type: "individual",
  display_name: "Ayesha Khan",
  state: "active",
  email: "ayesha@example.com",
  email_verified: true,
  suspension_reason: "",
  suspended_at: null,
});
const ACCOUNT_MODES = ["ok", "invalid", "conflict", "error", "csrf_once", "session_gone"];
let suspensionReason = SUSPENSION_REASON;
let adminAccount = adminAccountRow();
let accountsMode = "ok";
let accountsPosts = [];

createServer((req, res) => {
  const url = new URL(req.url, "http://stub");
  const json = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const envelope = (code, message, fields = {}) => ({ error: { code, message, fields: wireFields(fields), request_id: "stub" } });
  if (url.pathname === "/__wire-mode") {
    const value = url.searchParams.get("value") ?? "sentences";
    if (!["sentences", "codes"].includes(value)) return json(400, { error: "unknown mode" });
    wireMode = value;
    return json(200, { wireMode });
  }
  if (url.pathname === "/__confirm-mode") {
    const value = url.searchParams.get("value") ?? "ok";
    if (!["ok", "expired", "used", "invalid", "unknown_code", "expired_status_unknown_code", "invalid_status_no_code", "flaky", "error", "broken", "hang"].includes(value)) {
      return json(400, { error: "unknown mode" });
    }
    confirmMode = value;
    return json(200, { confirmMode });
  }
  if (url.pathname === "/__last-confirm") return json(200, { count: confirmCount, body: lastConfirm });
  if (url.pathname === "/__resend-mode") {
    const value = url.searchParams.get("value") ?? "accepted";
    if (!["accepted", "field", "rate_20", "rate_90", "rate_none", "rate_abc", "error", "broken", "hang"].includes(value)) {
      return json(400, { error: "unknown mode" });
    }
    resendMode = value;
    return json(200, { resendMode });
  }
  if (url.pathname === "/__last-resend") return json(200, { count: resendCount, body: lastResend });
  if (url.pathname === "/api/v1/email-verifications/confirm" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      confirmCount += 1;
      try {
        lastConfirm = JSON.parse(raw);
      } catch {
        lastConfirm = null;
      }
      if (confirmMode === "ok") return json(200, { status: "verified" });
      if (confirmMode === "flaky") {
        return confirmCount === 1 ? json(500, envelope("server_error", "Internal detail that must not show.")) : json(200, { status: "verified" });
      }
      if (confirmMode === "expired") return json(410, envelope("link_expired", "This link has expired."));
      if (confirmMode === "used") return json(409, envelope("link_used", "This link was already used."));
      if (confirmMode === "invalid") return json(400, envelope("link_invalid", "This link is not valid."));
      if (confirmMode === "unknown_code") return json(403, envelope("forbidden", "Forbidden."));
      if (confirmMode === "expired_status_unknown_code") return json(410, envelope("something_else", "Gone."));
      if (confirmMode === "invalid_status_no_code") return json(400, { detail: "not an envelope" });
      if (confirmMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (confirmMode === "broken") return req.socket.destroy();
      pending.push(res);
    });
    return;
  }
  if (url.pathname === "/api/v1/email-verification-requests" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      resendCount += 1;
      try {
        lastResend = JSON.parse(raw);
      } catch {
        lastResend = null;
      }
      if (resendMode === "accepted") return json(202, { status: "check_your_email" });
      if (resendMode === "field") return json(400, envelope("validation_error", "Some fields are invalid.", { email: ["Enter a valid email address."] }));
      if (resendMode.startsWith("rate_")) {
        const retry = { rate_20: "20", rate_90: "90", rate_abc: "soon" }[resendMode];
        res.writeHead(429, { "content-type": "application/json", ...(retry ? { "retry-after": retry } : {}) });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      if (resendMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (resendMode === "broken") return req.socket.destroy();
      pending.push(res);
    });
    return;
  }
  const choose = (name, allowed, apply) => {
    const value = url.searchParams.get("value") ?? allowed[0];
    if (!allowed.includes(value)) return json(400, { error: "unknown mode" });
    apply(value);
    return json(200, { [name]: value });
  };
  if (url.pathname === "/__signin-mode") {
    return choose("signInMode", ["ok", "unverified", "suspended", "no_name", "rate_limited", "wrong_credentials", "validation", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      signInMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__me-mode") return choose("meMode", ["up", "agency", "agency_no_name", "agency_bare", "admin", "error", "broken", "hang"], (v) => (meMode = v));
  if (url.pathname === "/__signout-mode") {
    return choose("signOutMode", ["ok", "gone", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      signOutMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__csrf-mode") return choose("csrfMode", ["ok", "error", "rate_limited"], (v) => (csrfMode = v));
  if (url.pathname === "/__force-session") {
    liveSession = true;
    sessionAdmin = url.searchParams.get("kind") === "admin";
    return json(200, {});
  }
  if (url.pathname === "/__expire-session") {
    liveSession = false;
    sessionAdmin = false;
    return json(200, {});
  }
  if (url.pathname === "/__admin-signin-mode") {
    return choose("adminSignInMode", ["ok", "wrong_credentials", "validation", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      adminSignInMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__admin-me-mode") return choose("adminMeMode", ["up", "error", "broken", "hang", "slow", "denied_401", "denied_403", "denied_404", "rate_limited"], (v) => (adminMeMode = v));
  if (url.pathname === "/__session-stats") {
    return json(200, { adminSignInCount, adminMeCount, lastAdminSignIn, lastAdminSignInToken, sessionAdmin, csrfFetches, signInCount, signOutCount, meCount, unsafeCount, lastSignIn, lastSignInToken, lastSignOutToken, liveSession, csrfToken: `csrf-${csrfSeed}` });
  }
  const hasSession = () => liveSession && (req.headers.cookie ?? "").includes(SESSION_COOKIE);
  const account = () => ({
    id: `00000000-0000-4000-8000-00000000000${accountVariant}`,
    account_type: meMode.startsWith("agency") ? "agency" : meMode === "admin" || sessionAdmin ? "admin" : "individual",
    state: signInMode === "unverified" ? "email_unverified" : signInMode === "suspended" ? "suspended" : "active",
    email: profile.email,
    full_name: meMode === "agency" || meMode === "agency_bare" ? "" : signInMode === "no_name" ? "" : profile.full_name,
    agency_name: meMode === "agency" ? agencyProfile.agency_name : "",
    capabilities: ["sign_in", "browse"],
    suspension_reason: signInMode === "suspended" ? suspensionReason : null,
  });
  if (url.pathname === "/api/v1/csrf" && req.method === "GET") {
    csrfFetches += 1;
    if (csrfMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
    if (csrfMode === "rate_limited") {
      res.writeHead(429, { "content-type": "application/json", "retry-after": "120" });
      return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
    }
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "set-cookie": "csrftoken=stub; HttpOnly; Path=/; SameSite=Lax" });
    return res.end(JSON.stringify({ csrf_token: `csrf-${csrfSeed}` }));
  }
  if (url.pathname === "/api/v1/me" && req.method === "GET") {
    meCount += 1;
    if (meMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
    if (meMode === "broken") return req.socket.destroy();
    if (meMode === "hang") {
      pending.push(res);
      return;
    }
    res.setHeader("cache-control", "no-store");
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication required."));
    return json(200, account());
  }
  const readBody = (handle) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      handle(parsed);
    });
  };
  const throttled = () => {
    res.writeHead(429, { "content-type": "application/json", "retry-after": "120" });
    return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
  };
  const throttledNoRetry = () => {
    res.writeHead(429, { "content-type": "application/json" });
    return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
  };
  const serverFailure = (mode) => {
    if (mode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
    if (mode === "broken") return req.socket.destroy();
    pending.push(res); // hang
  };
  if (url.pathname === "/api/v1/admin/me" && req.method === "GET") {
    adminMeCount += 1;
    if (adminMeMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
    if (adminMeMode === "broken") return req.socket.destroy();
    if (adminMeMode === "hang") {
      pending.push(res);
      return;
    }
    res.setHeader("cache-control", "no-store");
    // Denial modes keep `/me` an administrator while this endpoint refuses: only the page-level guard can notice.
    if (adminMeMode === "denied_401") return json(401, envelope("unauthenticated", "Authentication required."));
    if (adminMeMode === "denied_403") return json(403, envelope("forbidden", "Forbidden."));
    if (adminMeMode === "denied_404") return json(404, envelope("not_found", "Not found."));
    if (adminMeMode === "rate_limited") return throttled();
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication required."));
    if (!sessionAdmin) return json(404, envelope("not_found", "Not found."));
    const body = { id: "00000000-0000-4000-8000-0000000000aa", account_type: "admin", state: "active" };
    if (adminMeMode === "slow") return setTimeout(() => json(200, body), 2000);
    return json(200, body);
  }
  if (url.pathname === "/api/v1/admin-session" && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      adminSignInCount += 1;
      lastAdminSignIn = parsed;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      lastAdminSignInToken = sentToken;
      const forbidden = () => json(403, envelope("forbidden", "CSRF check failed."));
      if (adminSignInMode === "csrf_always") return forbidden();
      if (adminSignInMode === "csrf_once" && !csrfOnceSpent) {
        csrfOnceSpent = true;
        csrfSeed += 1;
        return forbidden();
      }
      if (sentToken !== `csrf-${csrfSeed}`) return forbidden();
      if (adminSignInMode === "error" || adminSignInMode === "broken" || adminSignInMode === "hang") return serverFailure(adminSignInMode);
      if (adminSignInMode === "rate_limited") return throttled();
      if (adminSignInMode === "wrong_credentials") return json(401, envelope("invalid_credentials", "Internal: no such administrator."));
      if (adminSignInMode === "validation") {
        return json(400, envelope("validation_error", "Some fields are invalid.", { email: ["Enter a valid email address."], password: ["This field may not be blank."] }));
      }
      liveSession = true;
      sessionAdmin = true;
      csrfSeed += 1; // the backend rotates the CSRF secret with the new session
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "set-cookie": `${SESSION_COOKIE}; HttpOnly; Path=/; SameSite=Lax` });
      return res.end(JSON.stringify(account()));
    });
  }
  if (url.pathname === "/api/v1/session" && (req.method === "POST" || req.method === "DELETE")) {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      unsafeCount += 1;
      const isSignIn = req.method === "POST";
      const mode = isSignIn ? signInMode : signOutMode;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      if (isSignIn) {
        signInCount += 1;
        lastSignInToken = sentToken;
        try {
          lastSignIn = JSON.parse(raw);
        } catch {
          lastSignIn = null;
        }
      } else {
        signOutCount += 1;
        lastSignOutToken = sentToken;
      }
      const forbidden = () => json(403, envelope("forbidden", "CSRF check failed."));
      if (mode === "csrf_always") return forbidden();
      if (mode === "csrf_once" && !csrfOnceSpent) {
        csrfOnceSpent = true;
        csrfSeed += 1; // the stale token is what the client holds; a refetch returns the new one
        return forbidden();
      }
      if (sentToken !== `csrf-${csrfSeed}`) return forbidden();
      if (isSignIn) {
        if (mode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
        if (mode === "broken") return req.socket.destroy();
        if (mode === "hang") {
          pending.push(res);
          return;
        }
        if (mode === "rate_limited") {
          res.writeHead(429, { "content-type": "application/json", "retry-after": "120" });
          return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
        }
        if (mode === "wrong_credentials") return json(401, envelope("invalid_credentials", "Internal: no such account."));
        if (mode === "validation") {
          return json(400, envelope("validation_error", "Some fields are invalid.", { email: ["Enter a valid email address."], password: ["This field may not be blank."] }));
        }
        liveSession = true;
        sessionAdmin = false;
        csrfSeed += 1; // the backend rotates the CSRF secret with the new session
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "set-cookie": `${SESSION_COOKIE}; HttpOnly; Path=/; SameSite=Lax` });
        return res.end(JSON.stringify(account()));
      }
      if (mode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (mode === "broken") return req.socket.destroy();
      if (mode === "hang") {
        pending.push(res);
        return;
      }
      const had = hasSession();
      liveSession = false;
      sessionAdmin = false;
      csrfSeed += 1;
      if (mode === "gone" || !had) {
        res.writeHead(401, { "content-type": "application/json", "set-cookie": "estate_session=; Max-Age=0; Path=/" });
        return res.end(JSON.stringify(envelope("unauthenticated", "Authentication required.")));
      }
      res.writeHead(204, { "set-cookie": "estate_session=; Max-Age=0; Path=/" });
      return res.end();
    });
    return;
  }
  if (url.pathname === "/__forgot-mode") {
    return choose("forgotMode", ["accepted", "field", "codes", "rate_limited", "error", "broken", "hang"], (v) => (forgotMode = v));
  }
  if (url.pathname === "/__last-forgot") return json(200, { count: forgotCount, body: lastForgot });
  if (url.pathname === "/__reset-mode") {
    return choose("resetMode", ["ok", "expired", "used", "invalid", "weak", "weak_once", "weak_messages", "weak_unknown", "token_field", "no_fields", "unknown_code", "rate_limited", "forbidden", "error", "broken", "hang"], (v) => (resetMode = v));
  }
  if (url.pathname === "/__last-reset") return json(200, { count: resetCount, body: lastReset });
  if (url.pathname === "/__change-mode") {
    return choose("changeMode", ["ok", "wrong_current", "same", "weak", "admin_weak", "server_messages", "session_gone", "unknown_code", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      changeMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__last-change") return json(200, { count: changeCount, body: lastChange, token: lastChangeToken });
  if (url.pathname === "/api/v1/password-reset-requests" && req.method === "POST") {
    return readBody((parsed) => {
      forgotCount += 1;
      lastForgot = parsed;
      if (forgotMode === "accepted") return json(202, { status: "check_your_email" });
      if (forgotMode === "field") return json(400, envelope("validation_error", "Some fields are invalid.", { email: ["Enter a valid email address."] }));
      if (forgotMode === "codes") return json(400, envelope("validation_error", "Raw server text.", { email: ["invalid"] }));
      if (forgotMode === "rate_limited") return throttled();
      return serverFailure(forgotMode);
    });
  }
  if (url.pathname === "/api/v1/password-resets/confirm" && req.method === "POST") {
    return readBody((parsed) => {
      resetCount += 1;
      lastReset = parsed;
      res.setHeader("cache-control", "no-store");
      const weak = (message) => json(400, envelope("validation_error", "The request contains invalid values.", { password: [message] }));
      if (resetMode === "ok") return json(200, { status: "password_reset" });
      if (resetMode === "expired") return json(410, envelope("link_expired", "This link has expired. Request a new one."));
      if (resetMode === "used") return json(409, envelope("link_used", "This link has already been used or replaced by a newer one."));
      if (resetMode === "invalid") return json(400, envelope("link_invalid", "This link is not valid. Request a new one."));
      if (resetMode === "weak") return weak("password_too_short");
      if (resetMode === "weak_once") return resetCount === 1 ? weak("password_too_common") : json(200, { status: "password_reset" });
      if (resetMode === "weak_messages") return weak("Pick something harder to guess.");
      if (resetMode === "weak_unknown") return weak("mystery_code");
      if (resetMode === "token_field") return json(400, envelope("validation_error", "Raw server text.", { token: ["invalid"] }));
      if (resetMode === "no_fields") return json(400, envelope("validation_error", "Raw server text."));
      if (resetMode === "unknown_code") return json(410, envelope("something_else", "Raw server text that must not show."));
      if (resetMode === "rate_limited") return throttled();
      if (resetMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
      return serverFailure(resetMode);
    });
  }
  if (url.pathname === "/api/v1/me/password" && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      changeCount += 1;
      lastChange = parsed;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      lastChangeToken = sentToken;
      res.setHeader("cache-control", "no-store");
      const fieldError = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (changeMode === "session_gone") {
        liveSession = false;
        return json(401, envelope("unauthenticated", "Authentication is required."));
      }
      if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
      if (changeMode === "csrf_always") return json(403, envelope("forbidden", "CSRF check failed."));
      if (changeMode === "csrf_once" && !csrfOnceSpent) {
        csrfOnceSpent = true;
        csrfSeed += 1;
        return json(403, envelope("forbidden", "CSRF check failed."));
      }
      if (sentToken !== `csrf-${csrfSeed}`) return json(403, envelope("forbidden", "CSRF check failed."));
      if (changeMode === "wrong_current") return fieldError({ current_password: ["incorrect"] });
      if (changeMode === "admin_weak") return fieldError({ new_password: ["admin_password_too_short", "admin_password_weak", "admin_password_whitespace"] });
      if (changeMode === "same") return fieldError({ new_password: ["password_same_as_current"] });
      if (changeMode === "weak") return fieldError({ new_password: ["password_too_short", "password_too_common"] });
      if (changeMode === "rate_limited") return throttled();
      if (changeMode === "unknown_code") return fieldError({ new_password: ["mystery_code"] });
      if (changeMode === "server_messages") {
        return fieldError({ current_password: ["The current password is incorrect."], new_password: ["Choose a password different from your current one."] });
      }
      if (changeMode === "error" || changeMode === "broken" || changeMode === "hang") return serverFailure(changeMode);
      return json(200, { status: "password_changed" });
    });
  }
  if (url.pathname === "/__profile-mode") {
    return choose("profileMode", ["ok", "forbidden", "flaky", "session_gone", "malformed", "hold", "error", "broken", "hang"], (v) => {
      profileMode = v;
      profileGets = 0;
    });
  }
  if (url.pathname === "/__profile-patch-mode") {
    return choose(
      "profilePatchMode",
      ["ok", "fields", "required", "sentences", "proto", "empty_ok", "non_field", "unknown_code", "empty_fields", "session_gone", "forbidden", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"],
      (v) => {
        profilePatchMode = v;
        csrfOnceSpent = false;
      },
    );
  }
  if (url.pathname === "/__email-change-mode") {
    return choose(
      "emailChangeMode",
      ["ok", "wrong_password", "invalid_email", "required", "sentences", "proto", "non_field", "unknown_code", "session_gone", "forbidden", "rate_limited", "rate_none", "csrf_once", "csrf_always", "error", "broken", "hang"],
      (v) => {
        emailChangeMode = v;
        csrfOnceSpent = false;
      },
    );
  }
  if (url.pathname === "/__email-confirm-mode") {
    return choose(
      "emailConfirmMode",
      ["ok", "expired", "used", "invalid", "other_400", "unknown_code", "rate_limited", "flaky", "error", "broken", "hang"],
      (v) => (emailConfirmMode = v),
    );
  }
  if (url.pathname === "/__last-profile") return json(200, { gets: profileGets, profile });
  if (url.pathname === "/__last-profile-patch") return json(200, { count: profilePatchCount, body: lastProfilePatch, token: lastProfilePatchToken });
  if (url.pathname === "/__last-email-change") return json(200, { count: emailChangeCount, body: lastEmailChange, token: lastEmailChangeToken });
  if (url.pathname === "/__last-email-confirm") return json(200, { count: emailConfirmCount, body: lastEmailConfirm });
  if (url.pathname === "/api/v1/me/profile" && req.method === "GET") {
    profileGets += 1;
    res.setHeader("cache-control", "no-store");
    if (profileMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (profileMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (profileMode === "flaky" && profileGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (profileMode === "malformed") return json(200, { full_name: 7 });
    if (profileMode === "error" || profileMode === "broken" || profileMode === "hang") return serverFailure(profileMode);
    if (profileMode === "hold") {
      heldProfileReads.push({ res, body: JSON.stringify(profileBody()) }); // the answer as it is NOW, sent when released
      return;
    }
    return json(200, profileBody());
  }
  // Signed-in unsafe calls share the session, CSRF self-heal and session-gone behaviour.
  // Answers the shared failures and returns true when it has already sent the response.
  const signedInUnsafe = (mode, sentToken) => {
    const reply = (status, body) => {
      json(status, body);
      return true;
    };
    if (mode === "session_gone") {
      liveSession = false;
      return reply(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return reply(401, envelope("unauthenticated", "Authentication is required."));
    if (mode === "csrf_always") return reply(403, envelope("forbidden", "CSRF check failed."));
    if (mode === "csrf_once" && !csrfOnceSpent) {
      csrfOnceSpent = true;
      csrfSeed += 1;
      return reply(403, envelope("forbidden", "CSRF check failed."));
    }
    if (sentToken !== `csrf-${csrfSeed}`) return reply(403, envelope("forbidden", "CSRF check failed."));
    if (mode === "forbidden") return reply(403, envelope("forbidden", "Forbidden."));
    if (mode === "rate_limited") {
      throttled();
      return true;
    }
    if (mode === "rate_none") {
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      return true;
    }
    return false;
  };
  // ---- Publication limits (Story 2.20)
  if (url.pathname === "/__quota-mode") {
    return choose("quotaMode", QUOTA_MODES, (v) => {
      quotaMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__quota-stats") return json(200, quotaStats);
  if (url.pathname.startsWith("/api/v1/admin/quota-")) {
    res.setHeader("cache-control", "no-store");
    const refused = () => {
      if (!hasSession()) json(401, envelope("unauthenticated", "Authentication required."));
      else if (!sessionAdmin) json(404, envelope("not_found", "Not found."));
      else return false;
      return true;
    };
    if (req.method === "GET" && url.pathname === "/api/v1/admin/quota-policy") {
      quotaStats.policyGets += 1;
      if (refused()) return;
      if (quotaMode === "load_error") return json(500, envelope("server_error", "Internal detail that must not show."));
      return json(200, { items: quotaPolicy });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/admin/quota-usage") {
      quotaStats.usageGets += 1;
      if (refused()) return;
      const cursor = url.searchParams.get("cursor");
      if (quotaMode === "load_error" || (quotaMode === "more_fail" && cursor)) return json(500, envelope("server_error", "Internal detail that must not show."));
      if (quotaMode === "stale_cursor" && cursor) return json(400, envelope("validation_error", "Invalid cursor.", { cursor: ["invalid"] }));
      const total = quotaMode === "empty" ? 0 : 23;
      const from = cursor ? 20 : 0;
      const results = Array.from({ length: total }, (_, i) => {
        const accountType = i % 2 ? "agency" : "individual";
        return {
          account_id: `00000000-0000-4000-b000-${String(i + 1).padStart(12, "0")}`,
          email: `u***@host${i + 1}.example.com`,
          account_type: accountType,
          used: 1,
          limit: quotaPolicy.find((row) => row.account_type === accountType).monthly_limit,
        };
      }).slice(from, from + 20);
      return json(200, {
        period_start: "2026-11-01T00:00:00+05:00",
        resets_at: "2026-12-01T00:00:00+05:00",
        next: from + 20 < total ? "http://backend.invalid/api/v1/admin/quota-usage?cursor=page-2" : null,
        previous: null,
        results,
      });
    }
    const putMatch = url.pathname.match(/^\/api\/v1\/admin\/quota-policy\/(individual|agency)$/);
    if (req.method === "PUT" && putMatch) {
      return readBody((body) => {
        const token = req.headers["x-csrftoken"] ?? null;
        quotaStats.puts.push({ accountType: putMatch[1], body, token });
        if (signedInUnsafe(quotaMode, token)) return;
        if (refused()) return;
        if (quotaMode === "put_error") return json(500, envelope("server_error", "Internal detail that must not show."));
        if (quotaMode === "put_invalid") return json(400, envelope("validation_error", "Some fields are invalid.", { monthly_limit: ["max_value"] }));
        const row = quotaPolicy.find((entry) => entry.account_type === putMatch[1]);
        if (row.monthly_limit !== body?.monthly_limit) Object.assign(row, { monthly_limit: body.monthly_limit, effective_from: karachiIso(Date.now()) });
        return json(200, row);
      });
    }
  }
  // ---- Account suspension (Story 2.21)
  if (url.pathname === "/__accounts-mode") {
    return choose("accountsMode", ACCOUNT_MODES, (v) => {
      accountsMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__accounts-stats") return json(200, { posts: accountsPosts });
  const accountRoute = url.pathname.match(/^\/api\/v1\/admin\/accounts\/(?:(lookup)|([^/]+)\/(suspend|reactivate))$/);
  if (accountRoute && req.method === "POST") {
    res.setHeader("cache-control", "no-store");
    return readBody((body) => {
      const [, lookup, id, action] = accountRoute;
      const token = req.headers["x-csrftoken"] ?? null;
      accountsPosts.push({ action: lookup ?? action, body, token });
      if (signedInUnsafe(accountsMode, token)) return;
      if (!sessionAdmin) return json(404, envelope("not_found", "Not found."));
      if (accountsMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (accountsMode === "invalid") return json(400, envelope("validation_error", "Some fields are invalid.", { reason: ["contains_contact_details"] }));
      if (lookup) {
        return body?.email === adminAccount.email ? json(200, adminAccount) : json(404, envelope("not_found", "Not found."));
      }
      if (id !== ACCOUNT_ID) return json(404, envelope("not_found", "Not found."));
      const suspended = adminAccount.state === "suspended";
      if (accountsMode === "conflict" || suspended === (action === "suspend")) return json(409, envelope("conflict", "Conflict."));
      Object.assign(
        adminAccount,
        action === "suspend"
          ? { state: "suspended", suspension_reason: body.reason, suspended_at: "2026-11-26T10:00:00+05:00" }
          : { state: "active", suspension_reason: "", suspended_at: null },
      );
      const { account_type, state, suspension_reason, suspended_at } = adminAccount;
      return json(200, { id: ACCOUNT_ID, account_type, state, suspension_reason, suspended_at });
    });
  }
  // ---- Listings and the registry (Story 2.1)
  if (url.pathname === "/__registry-mode") {
    return choose("registryMode", ["ok", "flaky", "flaky_slow", "gone", "error", "broken", "hang", "malformed", "empty_choices", "bad_subtypes", "odd_ids"], (v) => {
      registryMode = v;
      registryGets = 0;
    });
  }
  if (url.pathname === "/__registry-taxonomy") return choose("taxonomyName", Object.keys(TAXONOMIES), (v) => (taxonomyName = v));
  if (url.pathname === "/__registry-fields") return choose("fieldsName", Object.keys(REGISTRY_FIELDS), (v) => (fieldsName = v));
  if (url.pathname === "/__listing-preview-mode") {
    return choose("previewMode", ["ok", "flaky", "malformed", "other_id", "leaky", "nulls", "bad_request", "unprocessable", "session_gone", "forbidden", "rate_limited", "not_found", "error", "broken", "hang"], (v) => {
      previewMode = v;
      previewGets = 0;
    });
  }
  if (url.pathname === "/__listing-delete-mode") {
    return choose("deleteMode", ["ok", "slow", "hold", "hold_fail", "conflict", "not_found", "html_404", "forbidden", "session_gone", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      deleteMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__listing-patch-mode") {
    return choose(
      "patchMode",
      ["ok", "slow", "codes", "hidden", "area_codes", "area_hidden", "area_other_codes", "detail_codes", "location_codes", "location_invalid", "sentence_all", "location_sentences", "location_unknown", "amenities_invalid", "amenities_unknown", "amenities_hidden", "amenities_not_editable", "plot_codes", "commercial_codes", "detail_floor", "detail_codes_slow", "term_codes", "term_hidden", "detail_not_editable", "detail_not_applicable", "detail_hidden", "detail_unknown", "unknown", "non_field", "not_editable", "empty_fields", "conflict_no_current", "conflict_bad_current", "lost_once", "unreadable", "not_found", "forbidden", "session_gone", "rate_limited", "rate_none", "csrf_once", "csrf_always", "error", "broken", "hang"],
      (v) => {
        patchMode = v;
        patchLostSpent = false;
        csrfOnceSpent = false;
      },
    );
  }
  // Simulates another session: changes the given fields of a Listing directly and bumps its revision (and registry version).
  if (url.pathname === "/__other-session") {
    const target = listings.find((item) => item.id === url.searchParams.get("id"));
    if (!target) return json(404, { error: "unknown listing" });
    for (const name of INPUT_FIELDS) {
      if (!url.searchParams.has(name)) continue;
      const raw = url.searchParams.get(name);
      const type = currentDef(name)?.type;
      // The amenity map is sent as JSON text ("" or "{}" clears it).
      if (name === "amenities") {
        const map = raw === "" ? null : JSON.parse(raw);
        target.fields[name] = map !== null && Object.keys(map).length === 0 ? null : map;
        continue;
      }
      // A detail keeps its wire type: integers as numbers, yes/no as booleans, "" is not answered.
      target.fields[name] = raw === "" ? null : !HAND_IDS.includes(name) && type === "integer" ? Number(raw) : !HAND_IDS.includes(name) && type === "boolean" ? raw === "true" : raw;
    }
    // Identity changes (a Subtype never changes in the real service; this simulates a registry or taxonomy change that hides details).
    for (const name of ["purpose", "category", "subtype"]) if (url.searchParams.has(name)) target.fields[name] = url.searchParams.get(name);
    for (const [name, raw] of url.searchParams) {
      if (["id", "purpose", "category", "subtype"].includes(name) || INPUT_FIELDS.includes(name) || !isInput(name)) continue;
      const type = currentDef(name).type;
      target.fields[name] = raw === "" ? null : type === "integer" ? Number(raw) : type === "boolean" ? raw === "true" : raw;
    }
    settleArea(target.fields);
    target.revision += 1;
    target.registryVersion = REGISTRY_VERSION;
    return json(200, { revision: target.revision });
  }
  if (url.pathname === "/__hand-ids") return json(200, { ids: HAND_IDS });
  if (url.pathname === "/__listing-patch-stats") {
    return json(200, { count: patchCount, bodies: patchBodies, tokens: patchTokens });
  }
  if (url.pathname === "/__listings-mode") {
    return choose("listingsMode", ["ok", "flaky", "flaky_slow", "more_fail", "more_gone", "more_forbidden", "more_rate_limited", "small_pages", "dup", "inpage_dup", "repeat_cursor", "known_advance", "bad_first", "bad_next", "malformed", "partial", "rate_limited", "forbidden", "session_gone", "error", "broken", "hang"], (v) => {
      listingsMode = v;
      listingsGets = 0;
    });
  }
  if (url.pathname === "/__listing-create-mode") {
    return choose("createMode", ["ok", "required", "fields", "subtype_mismatch", "sentences", "non_field", "no_id", "forbidden", "session_gone", "rate_limited", "rate_none", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      createMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__listing-counts-mode") {
    return choose("countsMode", ["ok", "error", "hang", "forbidden", "malformed"], (v) => {
      countsMode = v;
      countsGets = 0;
    });
  }
  if (url.pathname === "/__listing-status-mode") {
    return choose("statusMode", ["ok", "hold", "stale", "stale_archived", "stale_sold", "stale_no_current", "conflict", "conflict_gone", "forbidden", "not_found", "unreadable", "lost_once", "session_gone", "rate_limited", "csrf_once", "error", "broken", "hang"], (v) => {
      statusMode = v;
      statusLostSpent = false;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__listing-status-release") {
    const answers = heldStatusAnswers;
    heldStatusAnswers = [];
    for (const answer of answers) answer();
    return json(200, { released: answers.length });
  }
  if (url.pathname === "/__listing-status-stats") return json(200, { attempts: statusAttempts, countsGets });
  // Simulates another session (or moderation) moving a Listing: the status, the restriction and its reason; the revision moves.
  if (url.pathname === "/__listing-lifecycle") {
    const target = listings.find((item) => item.id === url.searchParams.get("id"));
    if (!target) return json(404, { error: "unknown listing" });
    if (url.searchParams.has("status")) target.status = url.searchParams.get("status");
    if (url.searchParams.has("restricted")) target.restricted = url.searchParams.get("restricted") === "1";
    if (url.searchParams.has("reason")) target.restrictionReason = url.searchParams.get("reason") || null;
    target.revision += 1; // the real service always bumps it
    return json(200, { revision: target.revision, status: statusOf(target) });
  }
  if (url.pathname === "/__listing-detail-mode") {
    return choose("detailMode", ["ok", "flaky", "malformed", "forbidden", "bad_request", "unprocessable", "rate_limited", "session_gone", "error", "broken", "hang"], (v) => {
      detailMode = v;
      detailGets = 0;
    });
  }
  if (url.pathname === "/__listing-publish-mode") {
    return choose("publishMode", ["ok", "hold", "error", "broken", "lost_once", "reuse_once", "reuse_always", "stale", "stale_no_current", "stale_published", "conflict", "conflict_draft", "conflict_sold", "conflict_published_restricted", "stale_removed", "restricted_race", "no_kind", "quota", "quota_one", "quota_no_details", "invalid_extra", "garbled", "session_gone", "forbidden", "rate_limited", "csrf_once", "csrf_always"], (v) => {
      publishMode = v;
      csrfOnceSpent = false;
      publishLostSpent = publishReuseSpent = false;
    });
  }
  if (url.pathname === "/__listing-publish-release") {
    const answers = heldPublishAnswers;
    heldPublishAnswers = [];
    for (const answer of answers) answer();
    return json(200, { released: answers.length });
  }
  if (url.pathname === "/__listing-publish-stats") return json(200, { attempts: publishAttempts, used: publishUsed, records: [...publishRecords.keys()] });
  if (url.pathname === "/__listings-preset") {
    const value = url.searchParams.get("value") ?? "empty";
    if (!Object.hasOwn(LISTING_PRESETS, value)) return json(400, { error: "unknown preset" });
    listings = LISTING_PRESETS[value]();
    return json(200, { total: listings.length });
  }
  if (url.pathname === "/__listings-stats") {
    return json(200, {
      registryGets,
      registryNotModified,
      lastRegistryConditional,
      listGets: listingsGets,
      queries: listingQueries,
      detailGets,
      lastDetailId,
      previewGets,
      lastPreviewId,
      previewIds,
      deletes: listingDeletes,
      deleteTokens: listingDeleteTokens,
      createCount,
      lastCreate,
      lastCreateToken,
      mine: listings.filter((item) => item.owner === "mine").length,
      listings: listings.map((item) => ({ id: item.id, owner: item.owner, status: statusOf(item), revision: item.revision, fields: item.fields })),
    });
  }
  if (url.pathname === "/api/v1/registry" && req.method === "GET") {
    registryGets += 1;
    const taxonomy = TAXONOMIES[taxonomyName];
    // "<registry version>-<hash of what is served>-<response shape version>", like the backend's validator.
    const served = { version: REGISTRY_VERSION, taxonomy, fields: REGISTRY_FIELDS[fieldsName] };
    const etag = `"${REGISTRY_VERSION}-${createHash("sha1").update(JSON.stringify(served)).digest("hex").slice(0, 8)}-${REGISTRY_SHAPE}"`;
    lastRegistryConditional = req.headers["if-none-match"] ?? null;
    if ((registryMode === "flaky" || registryMode === "flaky_slow") && registryGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (registryMode === "gone") return json(401, envelope("unauthenticated", "Authentication is required."));
    if (registryMode === "odd_ids") {
      return json(200, {
        version: 1,
        taxonomy: {
          purposes: ["sale", "Bad Id", "rent"],
          categories: [
            { id: "house", subtypes: ["house", "bad id", "x\"y"] },
            { id: "empty_one", subtypes: [] },
            { id: "Bad Category", subtypes: ["house"] },
          ],
        },
        fields: [],
      });
    }
    if (registryMode === "error" || registryMode === "broken" || registryMode === "hang") return serverFailure(registryMode);
    if (registryMode === "malformed") return json(200, { version: 1, taxonomy: { purposes: "sale", categories: null }, fields: [] });
    if (registryMode === "empty_choices") return json(200, { version: 1, taxonomy: { purposes: [], categories: [] }, fields: [] });
    if (registryMode === "bad_subtypes") return json(200, { version: 1, taxonomy: { purposes: ["sale"], categories: [{ id: "house", subtypes: [7] }] }, fields: [] });
    const headers = { "content-type": "application/json", etag, "cache-control": "public, max-age=0, must-revalidate" };
    if (lastRegistryConditional === etag) {
      registryNotModified += 1;
      res.writeHead(304, { etag, "cache-control": headers["cache-control"] });
      return res.end();
    }
    const send = () => {
      res.writeHead(200, headers);
      res.end(JSON.stringify(served));
    };
    if (registryMode === "flaky_slow") return void setTimeout(send, 1500);
    return send();
  }
  if (url.pathname === "/api/v1/listings" && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      createCount += 1;
      lastCreate = parsed;
      lastCreateToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(createMode, lastCreateToken)) return;
      if (sessionAdmin) return json(403, envelope("forbidden", "Forbidden."));
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (createMode === "required") return fail({ purpose: ["required"], category: ["required"], subtype: ["required"] });
      if (createMode === "fields") return fail({ purpose: ["invalid_choice"], category: ["invalid"], subtype: ["invalid_choice"] });
      if (createMode === "subtype_mismatch") return fail({ subtype: ["subtype_not_in_category"] });
      if (createMode === "sentences") return fail({ purpose: ["Some server sentence."], subtype: ["mystery_code"], role: ["constructor"] });
      if (createMode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (createMode === "error" || createMode === "broken" || createMode === "hang") return serverFailure(createMode);
      const taxonomy = TAXONOMIES[taxonomyName];
      const body = parsed && typeof parsed === "object" ? parsed : {};
      const category = taxonomy.categories.find((entry) => entry.id === body.category);
      const problems = {};
      if (!body.purpose) problems.purpose = ["required"];
      else if (!taxonomy.purposes.includes(body.purpose)) problems.purpose = ["invalid_choice"];
      if (!body.category) problems.category = ["required"];
      else if (!category) problems.category = ["invalid_choice"];
      if (!body.subtype) problems.subtype = ["required"];
      else if (category && !category.subtypes.includes(body.subtype)) problems.subtype = ["subtype_not_in_category"];
      if (Object.keys(problems).length > 0) return fail(problems);
      if (listings.filter((item) => item.owner === "mine" && statusOf(item) === "draft").length >= 20) return throttledNoRetry();
      const seq = Math.max(0, ...listings.map((item) => item.seq)) + 1;
      const created = makeListing(seq, "mine", { purpose: body.purpose, category: body.category, subtype: body.subtype });
      listings = [created, ...listings];
      if (createMode === "no_id") return json(201, { status: "draft" });
      return json(201, publicListing(created));
    });
  }
  const listingMatch = /^\/api\/v1\/listings\/([^/]+)$/.exec(url.pathname);
  if (listingMatch && req.method === "GET") {
    detailGets += 1;
    lastDetailId = decodeURIComponent(listingMatch[1]);
    res.setHeader("cache-control", "no-store");
    if (detailMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (detailMode === "flaky" && detailGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (detailMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (detailMode === "bad_request") return json(400, envelope("validation_error", "Invalid id."));
    if (detailMode === "unprocessable") return json(422, envelope("validation_error", "Invalid id."));
    if (detailMode === "rate_limited") return throttled();
    if (detailMode === "error" || detailMode === "broken" || detailMode === "hang") return serverFailure(detailMode);
    if (detailMode === "malformed") return json(200, { status: "draft" });
    // Unknown, malformed, someone else's and an administrator's reads are one answer.
    const found = sessionAdmin ? undefined : listings.find((item) => item.id === lastDetailId && item.owner === "mine");
    if (!found) return json(404, envelope("not_found", "Not found."));
    return json(200, publicListing(found));
  }
  // Story 2.13: owner-only preview, built from the public projection (never a private-class field, never a phone, never the revision).
  const previewMatch = /^\/api\/v1\/listings\/([^/]+)\/preview$/.exec(url.pathname);
  if (previewMatch && req.method === "GET") {
    previewGets += 1;
    lastPreviewId = decodeURIComponent(previewMatch[1]);
    previewIds.push(lastPreviewId);
    res.setHeader("cache-control", "no-store");
    if (previewMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (previewMode === "flaky" && previewGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (previewMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (previewMode === "bad_request") return json(400, envelope("validation_error", "Invalid id."));
    if (previewMode === "unprocessable") return json(422, envelope("validation_error", "Invalid id."));
    if (previewMode === "rate_limited") return throttled();
    if (previewMode === "error" || previewMode === "broken" || previewMode === "hang") return serverFailure(previewMode);
    const found = sessionAdmin ? undefined : listings.find((item) => item.id === lastPreviewId && item.owner === "mine");
    if (!found || previewMode === "not_found") return json(404, envelope("not_found", "Not found."));
    if (previewMode === "malformed") return json(200, { status: "draft" });
    const PRIVATE = ["street", "house_number", "latitude", "longitude"];
    const HEAD = ["purpose", "category", "subtype", "title", "description"];
    const fields = Object.fromEntries(Object.entries(found.fields).filter(([key]) => !PRIVATE.includes(key) && !HEAD.includes(key)));
    // `leaky`: a body that wrongly carries owner-only data and a non-null estimate; the page must render none of it. `nulls`: every public key null.
    const leak =
      previewMode === "leaky"
        ? { street: "Cedar Lane", house_number: "Plot 12", latitude: "24.860000", longitude: "67.010000", phone: "+923001234567", revision: 77, provenance: { title: "manual" }, status: "draft", visibility: "private", confirmed: true }
        : {};
    const nullFields = previewMode === "nulls" ? Object.fromEntries(["asking_price", "price_basis", "rental_period", "area_value", "area_unit", "marla_basis", "bedrooms", "bathrooms", "condition", "basement", "city", "locality", "society", "amenities", "area_sqft"].map((key) => [key, null])) : null;
    return json(200, {
      ...leak,
      id: previewMode === "other_id" ? listingId(999) : found.id,
      purpose: found.fields.purpose,
      category: found.fields.category,
      subtype: found.fields.subtype,
      title: found.fields.title ?? null,
      description: found.fields.description ?? null,
      fields: nullFields ?? { ...fields, ...leak },
      media: found.images.map((image) => ({ id: image.id, position: image.position, is_cover: image.is_cover, content_type: image.content_type, width: image.width, height: image.height, url: `/api/v1/listings/${found.id}/images/${image.id}/file` })),
      registry_version: found.registryVersion,
      estimate: previewMode === "leaky" ? { value: 1 } : null,
    });
  }
  // Story 2.13: delete one of the owner's Drafts (204). 404 for missing, someone else's, an administrator and a repeat; 409 for a
  // Listing that is not a draft (or forced by the mode); 403 for an account that may not edit.
  if (listingMatch && req.method === "DELETE") {
    const sentToken = req.headers["x-csrftoken"] ?? null;
    res.setHeader("cache-control", "no-store");
    // Every attempt is counted, with the token it carried (before the CSRF and session rules answer).
    listingDeleteTokens.push(sentToken);
    listingDeletes.push(decodeURIComponent(listingMatch[1]));
    if (deleteMode === "csrf_always" && hasSession()) {
      csrfSeed += 1; // a refused token is replaced: the retry carries a new one and is refused again
      return json(403, envelope("forbidden", "CSRF check failed."));
    }
    if (signedInUnsafe(deleteMode, sentToken)) return;
    unsafeCount += 1;
    // An account that may not edit (Suspended) is refused whatever the mode.
    if (signInMode === "suspended") return json(403, envelope("forbidden", "Forbidden."));
    const target = sessionAdmin ? undefined : listings.find((item) => item.id === decodeURIComponent(listingMatch[1]) && item.owner === "mine");
    if (deleteMode === "html_404") {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end("<html><body>Not found</body></html>");
    }
    if (deleteMode === "error" || deleteMode === "broken" || deleteMode === "hang") return serverFailure(deleteMode);
    if (!target || deleteMode === "not_found") {
      if (target) listings = listings.filter((item) => item !== target);
      return json(404, envelope("not_found", "Not found."));
    }
    if (deleteMode === "conflict") target.status = "published"; // published meanwhile, elsewhere
    if (statusOf(target) !== "draft") return json(409, envelope("conflict", "The listing is not a draft."));
    listings = listings.filter((item) => item !== target);
    const answer = () => {
      res.writeHead(204);
      res.end();
    };
    if (deleteMode === "slow") return void setTimeout(answer, 600);
    if (deleteMode === "hold") return void heldDeleteAnswers.push(answer);
    if (deleteMode === "hold_fail") {
      // The delete did not happen: the held answer is a server error, and the Listing stays.
      listings = [target, ...listings.filter((item) => item !== target)];
      return void heldDeleteAnswers.push(() => json(500, envelope("server_error", "Internal detail that must not show.")));
    }
    return answer();
  }
  // Story 2.17: change the status of one of the owner's Listings (archive, mark sold, mark rented). The real order: key shape and body (400),
  // owner (404), stale revision (409 + current), account and Listing limits (403: a Suspended owner may only archive, a removed Listing is
  // fixed, a restricted one may only be archived), the transition table (409 conflict: published to archived, sold or rented; sold and
  // rented to archived; sold only for sale, rented only for rent), then the write. A refusal changes nothing.
  const statusMatch = /^\/api\/v1\/listings\/([^/]+)\/status$/.exec(url.pathname);
  if (statusMatch && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      statusAttempts.push({ id: decodeURIComponent(statusMatch[1]), token: sentToken, body: parsed });
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(statusMode, sentToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (statusMode === "error" || statusMode === "broken" || statusMode === "hang") return serverFailure(statusMode);
      const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      const shape = {};
      if (Object.keys(body).some((key) => key !== "base_revision" && key !== "status")) shape.non_field_errors = ["unknown_field"];
      if (!Number.isInteger(body.base_revision) || body.base_revision < 1) shape.base_revision = [body.base_revision === undefined ? "required" : "invalid"];
      if (body.status === undefined) shape.status = ["required"];
      else if (!["archived", "sold", "rented"].includes(body.status)) shape.status = ["invalid_choice"];
      if (Object.keys(shape).length > 0) return fail(shape);
      const target = sessionAdmin ? undefined : listings.find((item) => item.id === decodeURIComponent(statusMatch[1]) && item.owner === "mine");
      if (!target || statusMode === "not_found") return json(404, envelope("not_found", "Not found."));
      const from = statusOf(target);
      const stale = () => json(409, { ...envelope("stale_revision", "This listing was changed since you loaded it."), current: publicListing(target) });
      if (statusMode === "stale") {
        target.fields.title = "Changed in another session"; // another session saved meanwhile
        target.revision += 1;
        return stale();
      }
      if (statusMode === "stale_archived") {
        target.status = "archived"; // archived meanwhile, elsewhere
        target.revision += 1;
        return stale();
      }
      if (statusMode === "stale_sold") {
        target.status = "sold"; // sold meanwhile, elsewhere: archiving it is still allowed
        target.revision += 1;
        return stale();
      }
      if (statusMode === "stale_no_current") return json(409, envelope("stale_revision", "This listing was changed since you loaded it."));
      if (body.base_revision !== target.revision) return stale();
      // Then the account and Listing limits (403): a removed Listing is fixed, a Suspended owner may only archive, a restricted Listing may only be archived.
      if (from === "removed" || (signInMode === "suspended" && body.status !== "archived") || (target.restricted === true && body.status !== "archived")) {
        return json(403, envelope("forbidden", "Forbidden."));
      }
      if (statusMode === "conflict") {
        target.status = "archived"; // moved meanwhile: the table no longer allows this move
        target.revision += 1;
        return json(409, envelope("conflict", "The listing cannot be moved to that status."));
      }
      if (statusMode === "conflict_gone") return json(409, envelope("conflict", "The listing cannot be moved to that status."));
      const allowed =
        (from === "published" && ["archived", "sold", "rented"].includes(body.status)) || ((from === "sold" || from === "rented") && body.status === "archived");
      const purposeOk = body.status === "sold" ? target.fields.purpose === "sale" : body.status === "rented" ? target.fields.purpose === "rent" : true;
      if (!allowed || !purposeOk) return json(409, envelope("conflict", "The listing cannot be moved to that status."));
      const commit = () => {
        target.status = body.status;
        target.revision += 1;
      };
      const answer = () => {
        commit();
        return json(200, statusMode === "unreadable" ? { status: body.status } : publicListing(target));
      };
      if (statusMode === "lost_once" && !statusLostSpent) {
        statusLostSpent = true;
        commit();
        return req.socket.destroy(); // it happened, the answer never arrives
      }
      if (statusMode === "hold") return void heldStatusAnswers.push(answer);
      return answer();
    });
  }
  // Story 2.15: publish one of the owner's Drafts. The order and every rule are the real service's: key shape, body, claim (a replay of the
  // same key and content answers the original success, another content is 422), owner (404), stale revision (409 + current), Draft (409
  // conflict), account state (403, two reasons), validation (400, all at once), quota (409 with details), then the write. A refusal
  // changes nothing: no counted publication, no claimed key, no status.
  // ---- The correction of the locality and area (Story 2.19), mirroring the backend's order of refusals.
  if (url.pathname === "/__correction-mode") {
    return choose("correctionMode", ["ok", "hold", "read_error", "stale", "conflict", "unavailable", "restricted_race", "invalid", "session_gone", "error", "broken"], (v) => (correctionMode = v));
  }
  if (url.pathname === "/__correction-release") {
    const answers = heldCorrectionAnswers;
    heldCorrectionAnswers = [];
    for (const answer of answers) answer();
    return json(200, { released: answers.length });
  }
  if (url.pathname === "/__correction-stats") return json(200, { gets: correctionGets, attempts: correctionAttempts });
  const correctionMatch = /^\/api\/v1\/listings\/([^/]+)\/correction$/.exec(url.pathname);
  if (correctionMatch && req.method === "GET") {
    correctionGets += 1;
    res.setHeader("cache-control", "no-store");
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    const target = sessionAdmin ? undefined : listings.find((item) => item.id === correctionMatch[1] && item.owner === "mine");
    if (!target) return json(404, envelope("not_found", "Not found."));
    if (correctionMode === "read_error") return json(500, envelope("server_error", "Internal detail that must not show."));
    const ends = signInMode === "suspended" ? null : correctionEnds(target);
    return json(200, { available: ends !== null, expires_at: ends === null ? null : karachiIso(ends) });
  }
  if (correctionMatch && req.method === "POST") {
    return readBody((body) => {
      unsafeCount += 1;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      correctionAttempts.push({ token: sentToken, body });
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(correctionMode, sentToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      const target = sessionAdmin ? undefined : listings.find((item) => item.id === correctionMatch[1] && item.owner === "mine");
      if (!target) return json(404, envelope("not_found", "Not found."));
      if (correctionMode === "error" || correctionMode === "broken") return serverFailure(correctionMode);
      const sent = body?.fields ?? {};
      const outside = Object.keys(sent).filter((key) => !["locality", "area_value", "area_unit", "marla_basis"].includes(key));
      if (outside.length > 0) return fail(Object.fromEntries(outside.map((key) => [key, ["not_editable"]])));
      if (correctionMode === "stale") {
        target.fields.title = "Changed in another session";
        target.revision += 1;
      }
      if (body.base_revision !== target.revision) return json(409, { ...envelope("stale_revision", "The resource changed since it was loaded."), current: publicListing(target) });
      if (correctionMode === "conflict") {
        target.status = "archived";
        target.revision += 1;
      }
      if (statusOf(target) !== "published") return json(409, envelope("conflict", "This action cannot be done in the current state."));
      if (correctionMode === "restricted_race") {
        target.restricted = true;
        target.revision += 1;
      }
      if (target.restricted === true || signInMode === "suspended") return json(403, envelope("forbidden", "Forbidden."));
      if (correctionMode === "unavailable" && target.baseline) target.baseline.used = true; // used or expired meanwhile
      if (correctionEnds(target) === null) return json(409, envelope("correction_unavailable", "The correction window is closed. Archive the listing to change these details."));
      if (correctionMode === "invalid") return fail({ locality: ["locality_not_in_city"], area_value: ["invalid_area"] });
      const problems = {};
      const next = { ...target.fields, ...sent };
      if (Object.hasOwn(sent, "locality") && (next.locality === null || cityOfLocality(next.locality) !== next.city)) problems.locality = [next.locality === null ? "required" : "locality_not_in_city"];
      if (Object.hasOwn(sent, "area_value")) {
        if (typeof next.area_value !== "string" || !/^\d{1,10}(\.\d{1,4})?$/.test(next.area_value) || Number(next.area_value) <= 0) problems.area_value = [next.area_value === null ? "required" : "invalid_area"];
        else next.area_value = Number(next.area_value).toFixed(4);
      }
      const changed = (key) => differs(target.fields[key], next[key]);
      if (!problems.area_value && !problems.locality) {
        if (Object.hasOwn(sent, "marla_basis") && changed("marla_basis") && !changed("area_value") && !changed("area_unit")) problems.marla_basis = ["not_editable"];
        else if (!["locality", "area_value", "area_unit", "marla_basis"].some(changed)) problems.non_field_errors = ["no_change"];
      }
      if (Object.keys(problems).length > 0) return fail(problems);
      const answer = () => {
        target.fields = next;
        settleArea(target.fields);
        target.revision += 1;
        target.baseline = { ...target.baseline, fp: identityFingerprint(target), used: true };
        return json(200, publicListing(target));
      };
      if (correctionMode === "hold") return void heldCorrectionAnswers.push(answer);
      return answer();
    });
  }
  const publishMatch = /^\/api\/v1\/listings\/([^/]+)\/(publish|republish)$/.exec(url.pathname);
  if (publishMatch && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      const sentToken = req.headers["x-csrftoken"] ?? null;
      const key = req.headers["idempotency-key"] ?? null;
      const isRepublish = publishMatch[2] === "republish";
      publishAttempts.push({ id: decodeURIComponent(publishMatch[1]), key, token: sentToken, body: parsed, op: publishMatch[2] });
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(publishMode, sentToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (publishMode === "error" || publishMode === "broken" || publishMode === "hang") return serverFailure(publishMode);
      const header = {};
      if (key === null) header.idempotency_key = ["required"];
      else if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) header.idempotency_key = ["invalid"];
      const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      if (!Number.isInteger(body.base_revision) || body.base_revision < 1) header.base_revision = [body.base_revision === undefined ? "required" : "invalid"];
      if (Object.keys(header).length > 0) return fail(header);
      const target = sessionAdmin ? undefined : listings.find((item) => item.id === decodeURIComponent(publishMatch[1]) && item.owner === "mine");
      if (!target) return json(404, envelope("not_found", "Not found."));
      const recordKey = `${accountVariant}:${key}`;
      const record = publishRecords.get(recordKey);
      if (record) {
        // A key belongs to one operation (publish or republish), one Listing and one body.
        if (record.id !== target.id || record.base !== body.base_revision || record.op !== publishMatch[2]) return json(422, envelope("idempotency_key_reused", "This idempotency key was used for a different request."));
        // The original success, the Listing as it is now, nothing charged again; a republication keeps its original kind.
        return json(200, isRepublish ? { ...publicListing(target), publication_kind: record.kind } : publicListing(target));
      }
      if (publishMode === "reuse_always" || (publishMode === "reuse_once" && !publishReuseSpent)) {
        publishReuseSpent = true;
        return json(422, envelope("idempotency_key_reused", "This idempotency key was used for a different request."));
      }
      const stale = () => json(409, { ...envelope("stale_revision", "This listing was changed since you loaded it."), current: publicListing(target) });
      if (publishMode === "stale") {
        target.fields.title = "Changed in another session"; // another session saved meanwhile
        target.revision += 1;
        return stale();
      }
      if (publishMode === "stale_published") {
        // Published meanwhile (another tab, or an earlier attempt whose answer was lost): the revision moved and `current` says published.
        target.status = "published";
        target.revision += 1;
        return stale();
      }
      if (publishMode === "stale_no_current") return json(409, envelope("stale_revision", "This listing was changed since you loaded it."));
      if (body.base_revision !== target.revision) return stale();
      // Story 2.18: the status moved under a republication (another session, moderation); the revision always moves.
      if (isRepublish && publishMode === "stale_removed") {
        target.status = "removed";
        target.revision += 1;
        return stale();
      }
      if (isRepublish && publishMode === "conflict_sold") {
        target.status = "sold";
        target.revision += 1;
        return json(409, envelope("conflict", "The listing is not archived."));
      }
      if (isRepublish && publishMode === "conflict_published_restricted") {
        target.status = "published";
        target.restricted = true;
        target.restrictionReason = "Under review.";
        target.revision += 1;
        return json(409, envelope("conflict", "The listing is not archived."));
      }
      // The listing was restricted meanwhile: the refusal is a plain 403 `forbidden`, like a restricted listing's.
      if (isRepublish && publishMode === "restricted_race") {
        target.restricted = true;
        target.restrictionReason = "Under review.";
        target.revision += 1;
        return json(403, envelope("forbidden", "Forbidden."));
      }
      if (publishMode === "conflict") {
        target.status = "published"; // published meanwhile, elsewhere (a publish bumps the revision)
        target.revision += 1;
      }
      // A refusal that claims "not a draft" while the Listing still is one (a claim without a result): nothing is published.
      if (publishMode === "conflict_draft") return json(409, envelope("conflict", isRepublish ? "The listing is not archived." : "The listing is not a draft."));
      // Republication starts from Archived only (Sold and Rented must be archived first; Draft, Published and Removed are refused too).
      if (statusOf(target) !== (isRepublish ? "archived" : "draft")) return json(409, envelope("conflict", isRepublish ? "The listing is not archived." : "The listing is not a draft."));
      if (target.restricted === true) return json(403, envelope("forbidden", "Forbidden."));
      if (signInMode === "unverified") return json(403, envelope("email_not_verified", "Verify your email address to publish."));
      if (signInMode === "suspended") return json(403, envelope("publishing_unavailable", "Your account cannot publish right now."));
      // Required items, from the stub's own registry and this Draft's data (applicability included).
      const problems = {};
      for (const name of ["purpose", "category", "subtype"]) if (!target.fields[name]) problems[name] = ["required"];
      for (const def of REGISTRY_FIELDS[fieldsName]) {
        if (def.requirement !== "required_for_publication" || def.derived || !applies(def, target.fields)) continue;
        const value = target.fields[def.id];
        if (value === null || value === undefined || value === "") problems[def.id] = ["required"];
      }
      const hasLocality = target.fields.locality && target.fields.city;
      if (hasLocality && cityOfLocality(target.fields.locality) !== target.fields.city) problems.locality = ["locality_not_in_city"];
      if (target.images.length === 0) problems.images = ["images_required"];
      // An Assistant value of a private or identity field that the owner has not confirmed.
      for (const def of REGISTRY_FIELDS[fieldsName]) {
        const origin = target.provenance?.[def.id];
        const value = target.fields[def.id];
        if ((def.class === "private" || def.quota_identity) && value !== null && value !== undefined && value !== "" && origin?.origin === "ai" && origin.confirmed !== true) problems[def.id] = ["confirm_required"];
      }
      if (publishMode === "invalid_extra") problems.title = [...(problems.title ?? []), "too_short"];
      if (Object.keys(problems).length > 0) return fail(problems);
      // Counted or free: a republication is free only when the last counted publication was in this Karachi month and the eight identity
      // fields are unchanged; no baseline (sample data, never counted) is counted. A free one needs no allowance and uses none.
      const kind = !isRepublish ? null : target.baseline && target.baseline.month === KARACHI_MONTH && target.baseline.fp === identityFingerprint(target) ? "republish_free" : "republish_counted";
      const counted = kind !== "republish_free";
      const limit = account().account_type === "agency" ? 10 : 2;
      const used = (ALLOWANCE_BASE_USED(limit)[allowanceMode] ?? 1) + (publishUsed[accountVariant] ?? 0);
      if (counted && (publishMode === "quota" || publishMode === "quota_one" || used >= limit)) {
        const shownLimit = publishMode === "quota_one" ? 1 : limit;
        return json(409, { ...envelope("quota_exhausted", "You have used all your publications for this month."), details: { limit: shownLimit, used: Math.max(used, shownLimit), resets_at: "2026-12-01T00:00:00+05:00" } });
      }
      if (counted && publishMode === "quota_no_details") return json(409, envelope("quota_exhausted", "You have used all your publications for this month."));
      const commit = () => {
        target.status = "published";
        target.revision += 1;
        if (counted) {
          publishUsed[accountVariant] = (publishUsed[accountVariant] ?? 0) + 1;
          target.baseline = { month: KARACHI_MONTH, fp: identityFingerprint(target), at: Date.now(), used: false }; // a counted publication is the new baseline; a free one does not move it
        }
        publishRecords.set(recordKey, { id: target.id, base: body.base_revision, op: publishMatch[2], kind });
      };
      const answer = () => {
        commit();
        if (publishMode === "garbled") return json(200, { status: "published" });
        if (isRepublish && publishMode === "no_kind") return json(200, publicListing(target));
        return json(200, isRepublish ? { ...publicListing(target), publication_kind: kind } : publicListing(target));
      };
      if (publishMode === "lost_once" && !publishLostSpent) {
        // It happened, but the answer never arrives: the retry with the same key must replay it.
        publishLostSpent = true;
        commit();
        return req.socket.destroy();
      }
      if (publishMode === "hold") return void heldPublishAnswers.push(answer);
      return answer();
    });
  }
  if (listingMatch && req.method === "PATCH") {
    return readBody((parsed) => {
      unsafeCount += 1;
      patchCount += 1;
      patchBodies.push(parsed);
      const sentToken = req.headers["x-csrftoken"] ?? null;
      patchTokens.push(sentToken);
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(patchMode, sentToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      const target = sessionAdmin ? undefined : listings.find((item) => item.id === decodeURIComponent(listingMatch[1]) && item.owner === "mine");
      if (!target || patchMode === "not_found") return json(404, envelope("not_found", "Not found."));
      if (patchMode === "error" || patchMode === "broken" || patchMode === "hang") return serverFailure(patchMode);
      // Story 2.17: a Sold, Rented or Removed Listing and a restricted one are view only.
      if (!editableListing(target)) return json(403, envelope("forbidden", "Forbidden."));
      // Shape first (it needs no stored data), then the stale check, then every value rule: the order of the real service.
      const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      const shape = {};
      if (Object.keys(body).some((key) => key !== "base_revision" && key !== "fields")) shape.non_field_errors = ["unknown_field"];
      if (!Number.isInteger(body.base_revision) || body.base_revision < 1) shape.base_revision = [body.base_revision === undefined ? "required" : "invalid"];
      const sent = body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields : null;
      if (!sent) shape.fields = [body.fields === undefined ? "required" : "not_a_dict"];
      else if (Object.keys(sent).length === 0) shape.fields = ["empty"];
      else {
        for (const key of Object.keys(sent)) {
          if (isInput(key)) continue;
          if (["purpose", "category", "subtype", "area_sqft"].includes(key)) shape[key] = ["not_editable"];
          else shape.non_field_errors = ["unknown_field"];
        }
      }
      if (Object.keys(shape).length > 0) return fail(shape);
      const conflictMessage = "This listing was changed since you loaded it.";
      if (patchMode === "conflict_no_current") return json(409, envelope("stale_revision", conflictMessage));
      if (patchMode === "conflict_bad_current") return json(409, { ...envelope("stale_revision", conflictMessage), current: { status: "draft" } });
      if (body.base_revision !== target.revision) {
        const conflict = () => json(409, { ...envelope("stale_revision", conflictMessage), current: publicListing(target) });
        return patchMode === "slow" ? void setTimeout(conflict, 600) : conflict();
      }
      if (patchMode === "codes") return fail({ title: ["too_short"], description: ["contains_contact_details"], asking_price: ["invalid_price"], price_basis: ["invalid_choice"] });
      if (patchMode === "location_codes") return fail({ city: ["invalid"], locality: ["locality_not_in_city"], society: ["contains_contact_details"], street: ["too_long"], latitude: ["out_of_range"], longitude: ["invalid"], block: ["mystery_code"] });
      if (patchMode === "location_sentences") return fail({ locality: ["Choose a locality that belongs to the selected city."], society: ["This text cannot contain phone numbers, email addresses or street addresses."], latitude: ["Enter a number within the allowed range, using digits and a decimal point."], street: ["Some server sentence."] });
      if (patchMode === "location_invalid") return fail({ locality: ["invalid"] });
      if (patchMode === "amenities_invalid") return fail({ amenities: ["invalid"] });
      if (patchMode === "amenities_unknown") return fail({ amenities: ["mystery_code", "Some server sentence."] });
      if (patchMode === "amenities_not_editable") return fail({ amenities: ["not_editable"] });
      if (patchMode === "amenities_hidden") return fail({ amenities: ["not_applicable"] });
      if (patchMode === "sentence_all") return fail({ title: ["too_short"], asking_price: ["invalid_price"], area_value: ["invalid_area"], floor_number: ["invalid_floor"], building_floors: ["invalid_floor"], lift: ["not_applicable"], bedrooms: ["not_editable"], city: ["invalid"], street: ["too_long"], longitude: ["invalid"] });
      if (patchMode === "location_unknown") return fail({ city: ["constructor"], phase: ["Some server sentence."], house_number: ["not_applicable"] });
      if (patchMode === "hidden") return fail({ rental_period: ["not_applicable"] });
      if (patchMode === "area_codes") return fail({ area_value: ["invalid_area"], area_unit: ["invalid_choice"], marla_basis: ["not_applicable"] });
      if (patchMode === "area_other_codes") return fail({ area_unit: ["invalid"], area_value: ["not_editable"], marla_basis: ["required"] });
      if (patchMode === "area_hidden") return fail({ marla_basis: ["not_applicable"] });
      if (patchMode === "unknown") return fail({ title: ["Some server sentence."], description: ["mystery_code"], asking_price: ["constructor"], role: ["constructor"], non_field_errors: ["Some other sentence."] });
      if (patchMode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (patchMode === "not_editable") return fail({ title: ["not_editable"] });
      if (patchMode === "detail_codes") return fail({ bedrooms: ["invalid_range"], condition: ["invalid_choice"], lift: ["invalid"], covered_area_sqft: ["invalid_area"], maintenance_charges: ["invalid_price"], floor_number: ["invalid_floor"] });
      if (patchMode === "term_codes") return fail({ security_deposit: ["invalid_price"], availability_date: ["invalid_date"], minimum_lease_months: ["invalid_range"], occupant_restrictions: ["invalid_choice"], pets_allowed: ["invalid"], advance_rent: ["not_editable"], notice_period_days: ["mystery"], utility_gas_included: ["not_applicable"] });
      if (patchMode === "term_hidden") return fail({ possession_availability: ["not_applicable"], payment_type: ["invalid"] });
      if (patchMode === "detail_codes_slow") return void setTimeout(() => fail({ bedrooms: ["invalid_range"], floor_number: ["invalid_floor"] }), 600);
      if (patchMode === "detail_not_editable") return fail({ bedrooms: ["not_editable"] });
      if (patchMode === "detail_not_applicable") return fail({ lift: ["not_applicable"] });
      if (patchMode === "plot_codes") return fail({ plot_width: ["invalid_measure"], possession_status: ["invalid_choice"], corner_plot: ["invalid"], road_width_ft: ["invalid"], approval_authority: ["not_applicable"] });
      if (patchMode === "commercial_codes") return fail({ furnishing: ["invalid_choice"], frontage_ft: ["invalid_measure"], power_load_kw: ["invalid"], floor_number: ["invalid_floor"], building_floors: ["invalid_floor"], business_use: ["invalid_choice"] });
      if (patchMode === "detail_floor") return fail({ floor_number: ["invalid_floor"] });
      if (patchMode === "detail_hidden") return fail({ kitchens: ["not_applicable"] });
      if (patchMode === "detail_unknown") return fail({ bedrooms: ["constructor"], condition: ["Some server sentence."], lift: ["invalid_range", "invalid"], nonsense_field: ["invalid"] });
      if (patchMode === "empty_fields") return json(400, envelope("validation_error", "The request contains invalid values."));
      const defs = REGISTRY_FIELDS[fieldsName];
      const def = (id) => defs.find((entry) => entry.id === id);
      const problems = {};
      const next = {};
      for (const [key, value] of Object.entries(sent)) {
        const rule = def(key);
        if (value === null) {
          next[key] = null;
        } else if (key === "title" || key === "description") {
          if (typeof value !== "string") problems[key] = ["invalid"];
          else if (value.length > 20000) problems[key] = ["too_long"];
          else if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) problems[key] = ["invalid"];
          else {
            const lines = value.replace(/\r\n?/g, "\n").trim();
            const text = key === "title" ? lines.replace(/\s+/g, " ") : lines.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n");
            const size = Array.from(text).length;
            if (text === "") next[key] = null;
            else if (rule?.min_length && size < rule.min_length) problems[key] = ["too_short"];
            else if (rule?.max_length && size > rule.max_length) problems[key] = ["too_long"];
            else if (/@|\b0\d{10}\b|\+\d{8,}/.test(text)) problems[key] = ["contains_contact_details"];
            else next[key] = text;
          }
        } else if (key === "asking_price") {
          // Money is text all the way, judged like the real service: digits with an optional decimal point, no commas, no signs
          // other than a leading minus (which the range then refuses).
          const plain = typeof value === "string" ? value : "";
          const match = /^(-)?(\d{1,30})(?:\.(\d{1,30}))?$/.exec(plain);
          if (!match) problems[key] = ["invalid"];
          else if (match[1] || (match[3] ?? "").length > 2) problems[key] = ["invalid_price"];
          else {
            match[1] = match[2];
            match[2] = match[3];
            const toCents = (text) => BigInt(text.split(".")[0] + (text.split(".")[1] ?? "").padEnd(2, "0"));
            const cents = toCents(plain);
            const low = toCents(rule?.min ?? "0.01");
            const high = toCents(rule?.max ?? "999999999999.99");
            if (cents < low || cents > high) problems[key] = ["invalid_price"];
            else next[key] = `${match[1].replace(/^0+(?=\d)/, "")}.${(match[2] ?? "").padEnd(2, "0")}`;
          }
        } else if (key === "price_basis") {
          const allowed = rule?.allowed_values_by_purpose?.[target.fields.purpose] ?? rule?.allowed_values ?? [];
          if (typeof value === "string" && allowed.includes(value)) next[key] = value;
          else problems[key] = ["invalid_choice"];
        } else if (key === "rental_period") {
          if (target.fields.purpose !== "rent") problems[key] = ["not_applicable"];
          else if (typeof value === "string" && (rule?.allowed_values ?? []).includes(value)) next[key] = value;
          else problems[key] = ["invalid_choice"];
        } else if (key === "area_value") {
          // Text only; digits with an optional decimal point, no commas, no zero padding. A signed, too fine, too small or
          // too large number is `invalid_area`.
          const match = typeof value === "string" && value.length <= 40 ? AREA_TEXT.exec(value) : null;
          if (!match || (match[2].length > 1 && match[2].startsWith("0"))) problems[key] = ["invalid"];
          else if (match[1] || (match[3] ?? "").length > (rule?.scale ?? 4)) problems[key] = ["invalid_area"];
          else {
            const scaled = toScaled(value, 4);
            if (scaled < toScaled(rule?.min ?? "0.0001", 4) || scaled > toScaled(rule?.max ?? "9999999999.9999", 4)) problems[key] = ["invalid_area"];
            else next[key] = fromScaled(scaled, 4);
          }
        } else if (key === "area_unit") {
          if (typeof value !== "string") problems[key] = ["invalid"];
          else if ((rule?.allowed_values ?? []).includes(value)) next[key] = value;
          else problems[key] = ["invalid_choice"];
        } else if (key === "marla_basis") {
          if (typeof value === "string" && (rule?.allowed_values ?? []).includes(value)) next[key] = value;
          else problems[key] = ["invalid_choice"];
        } else if (rule?.type === "amenities") {
          const result = checkAmenities(value, target.fields.amenities ?? null);
          if (result.code) problems[key] = [result.code];
          else next[key] = result.value;
        } else if (rule?.section === "location") {
          const result = checkLocation(rule, value);
          if (result.code) problems[key] = [result.code];
          else next[key] = result.value;
        } else if (!rule) {
          problems.non_field_errors = ["unknown_field"]; // a detail the current registry does not define
        } else {
          const result = checkDetail(rule, value, target.fields);
          if (result.code) problems[key] = [result.code];
          else next[key] = result.value;
        }
      }
      // An apartment's floor cannot be above its building's floors, judged on the resulting state; the code is on the floor, and
      // on the building too when it was sent.
      const floorRule = currentDef("floor_number");
      if (floorRule && applies(floorRule, target.fields) && !problems.floor_number && !problems.building_floors && (Object.hasOwn(next, "floor_number") || Object.hasOwn(next, "building_floors"))) {
        const floor = Object.hasOwn(next, "floor_number") ? next.floor_number : (target.fields.floor_number ?? null);
        const building = Object.hasOwn(next, "building_floors") ? next.building_floors : (target.fields.building_floors ?? null);
        if (floor !== null && building !== null && floor > building) {
          problems.floor_number = ["invalid_floor"];
          if (Object.hasOwn(next, "building_floors")) problems.building_floors = ["invalid_floor"];
        }
      }
      // Location (Story 2.7), judged on the resulting state. Changing or clearing the city without sending a locality clears the stored one;
      // a locality needs a city and must belong to it; the coordinates are both or neither (the code is on the field that ends up empty).
      if (currentDef("city")) {
        const now = (key) => (Object.hasOwn(next, key) ? next[key] : (target.fields[key] ?? null));
        if (Object.hasOwn(next, "city") && next.city !== (target.fields.city ?? null) && !Object.hasOwn(sent, "locality") && target.fields.locality) next.locality = null;
        if (!problems.locality && now("locality") !== null && (Object.hasOwn(next, "locality") || Object.hasOwn(next, "city"))) {
          if (now("city") === null) problems.locality = ["invalid"];
          else if (cityOfLocality(now("locality")) !== now("city")) problems.locality = ["locality_not_in_city"];
        }
        if (Object.hasOwn(next, "latitude") || Object.hasOwn(next, "longitude")) {
          for (const [key, other] of [["latitude", "longitude"], ["longitude", "latitude"]]) {
            if (!problems[key] && !problems[other] && now(key) === null && now(other) !== null) problems[key] = ["invalid"];
          }
        }
      }
      // Cross-field, on the resulting state: a basis only while the unit is marla or kanal; a unit moved away clears a stored one.
      if (!problems.area_unit && !problems.marla_basis) {
        const unit = Object.hasOwn(next, "area_unit") ? next.area_unit : target.fields.area_unit;
        if (!MARLA_UNITS.includes(unit)) {
          if (next.marla_basis !== undefined && next.marla_basis !== null) problems.marla_basis = ["not_applicable"];
          else if (!Object.hasOwn(next, "marla_basis") && target.fields.marla_basis !== null) next.marla_basis = null;
        }
      }
      // Story 2.17, while Published: an identity field (the registry's flag) cannot change (re-sending it unchanged is accepted), and the
      // edit must leave the Listing complete: the fields it changed, the required items still missing and the live images are judged.
      if (statusOf(target) === "published") {
        for (const key of Object.keys(sent)) {
          if (problems[key] || !currentDef(key)?.quota_identity) continue;
          if (differs(target.fields[key], Object.hasOwn(next, key) ? next[key] : target.fields[key])) problems[key] = ["not_editable"];
        }
        const after = { ...target.fields, ...next };
        for (const rule of defs) {
          if (rule.requirement !== "required_for_publication" || rule.derived || !applies(rule, after) || problems[rule.id]) continue;
          if (after[rule.id] === null || after[rule.id] === undefined || after[rule.id] === "") problems[rule.id] = ["required"];
        }
        if (target.images.length === 0) problems.images = ["images_required"];
      }
      if (Object.keys(problems).length > 0) return fail(problems);
      const merged = { ...target.fields, ...next };
      const sqft = normalisedSqft(merged.area_value, merged.area_unit, merged.marla_basis);
      if (sqft !== merged.area_sqft) next.area_sqft = sqft;
      const changed = Object.keys(next).filter((key) => differs(target.fields[key], next[key]));
      // Re-sending the value of an Assistant field the owner has not confirmed confirms it (stored manual and confirmed, revision bumps).
      let confirmedNow = false;
      for (const key of Object.keys(next)) {
        const origin = target.provenance[key];
        if (origin?.origin === "ai" && origin.confirmed !== true && next[key] !== null && !differs(target.fields[key], next[key])) {
          target.provenance[key] = { origin: "manual", confirmed: true };
          confirmedNow = true;
        }
      }
      if (confirmedNow && changed.length === 0) {
        target.revision += 1;
        target.registryVersion = REGISTRY_VERSION;
      }
      if (changed.length > 0) {
        for (const key of changed) {
          target.fields[key] = next[key];
          if (key === "area_sqft") continue; // derived: no provenance
          if (next[key] === null) delete target.provenance[key];
          else target.provenance[key] = { origin: "manual", confirmed: true };
        }
        target.revision += 1;
        target.registryVersion = REGISTRY_VERSION;
      }
      if (patchMode === "lost_once" && !patchLostSpent) {
        patchLostSpent = true;
        return req.socket.destroy(); // the change landed, the answer is lost
      }
      const answer = () => json(200, patchMode === "unreadable" ? { status: "draft" } : publicListing(target));
      if (patchMode === "slow") return void setTimeout(answer, 600);
      return answer();
    });
  }
  // ---- Images (Story 2.10): upload, reorder and cover, delete and the media endpoint, mirroring the backend's rules.
  if (url.pathname === "/__image-mode") {
    return choose("imageMode", ["ok", "slow", "hold", "too_small", "too_large_dimensions", "invalid_image", "too_many", "cap", "busy", "busy_no_retry", "rate_limited", "rate_none", "forbidden", "session_gone", "not_found", "unsupported_media", "payload_too_large", "not_editable", "csrf_once", "csrf_always", "lost_once", "error", "broken", "hang"], (v) => {
      imageMode = v;
      imageLostSpent = false;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__image-order-mode") {
    return choose("imageOrderMode", ["ok", "slow", "not_found", "forbidden", "session_gone", "rate_limited", "rate_none", "conflict_no_current", "order_invalid", "cover_invalid", "revision_invalid", "order_unknown", "not_editable", "csrf_once", "csrf_always", "lost_once", "unreadable", "error", "broken", "hang"], (v) => {
      imageOrderMode = v;
      imageLostSpent = false;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__image-delete-mode") {
    return choose("imageDeleteMode", ["ok", "slow", "not_found", "not_editable", "forbidden", "session_gone", "csrf_once", "csrf_always", "lost_once", "error", "broken", "hang"], (v) => {
      imageDeleteMode = v;
      imageLostSpent = false;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__image-wire-mode") return choose("imageWireMode", ["ok", "not_list", "bad_url", "other_listing_url", "two_covers", "ghost_gap", "ghost_no_cover", "dup_position", "decreasing", "negative_position", "string_position", "dup_id", "bad_id"], (v) => (imageWireMode = v));
  if (url.pathname === "/__image-file-mode") return choose("imageFileMode", ["ok", "not_found", "broken"], (v) => (imageFileMode = v));
  if (url.pathname === "/__image-stats") {
    return json(200, {
      attempts: imageAttempts,
      uploads: imageUploads,
      orderBodies: imageOrderBodies,
      deletes: imageDeletes,
      fileGets: imageFileGets,
      fileHeads: imageFileHeads,
      tokens: imageTokens,
      images: Object.fromEntries(listings.map((item) => [item.id, { revision: item.revision, images: item.images.map((image) => ({ id: image.id, position: image.position, is_cover: image.is_cover, content_type: image.content_type })) }])),
    });
  }
  // Simulates another session changing the images of a Draft (the revision moves): reverse the order, add one, delete the first, cover the last.
  if (url.pathname === "/__other-images") {
    const target = listings.find((item) => item.id === url.searchParams.get("id"));
    if (!target) return json(404, { error: "unknown listing" });
    const op = url.searchParams.get("op");
    const renumber = () => target.images.forEach((image, index) => (image.position = index));
    if (op === "reverse") target.images.reverse();
    else if (op === "add") target.images.push(newImage(++imageSeq, target.images.length, target.images.length === 0));
    else if (op === "delete_first") {
      const [gone] = target.images.splice(0, 1);
      if (gone?.is_cover && target.images[0]) target.images[0].is_cover = true;
    } else if (op === "cover_last") target.images.forEach((image, index) => (image.is_cover = index === target.images.length - 1));
    else return json(400, { error: "unknown op" });
    renumber();
    target.revision += 1;
    return json(200, { revision: target.revision });
  }
  const imagesRoute = /^\/api\/v1\/listings\/([^/]+)\/images$/.exec(url.pathname);
  const imageRoute = /^\/api\/v1\/listings\/([^/]+)\/images\/([^/]+)$/.exec(url.pathname);
  const imageFileRoute = /^\/api\/v1\/listings\/([^/]+)\/images\/([^/]+)\/file$/.exec(url.pathname);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const ownDraft = (raw) => (sessionAdmin ? undefined : listings.find((item) => item.id === decodeURIComponent(raw) && item.owner === "mine"));
  const failFields = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
  const notFound = () => json(404, envelope("not_found", "Not found."));
  // Parses a multipart body (a Buffer) into its parts; null when the boundary is missing.
  const parseMultipart = (body, contentType) => {
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
    if (!boundary) return null;
    const delimiter = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
    const parts = [];
    let at = body.indexOf(delimiter);
    while (at !== -1) {
      const start = at + delimiter.length;
      if (body.subarray(start, start + 2).toString() === "--") break;
      const next = body.indexOf(delimiter, start);
      if (next === -1) break;
      const chunk = body.subarray(start + 2, next - 2); // minus the CRLF after the delimiter and before the next one
      const split = chunk.indexOf("\r\n\r\n");
      const head = chunk.subarray(0, split).toString("latin1");
      parts.push({ name: /name="([^"]*)"/.exec(head)?.[1] ?? "", data: chunk.subarray(split + 4) });
      at = next;
    }
    return parts;
  };
  const sniffType = (data) => {
    if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
    if (data.length >= 12 && data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
    return null;
  };
  if (imagesRoute && req.method === "POST") {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_UPLOAD_BODY + 1) chunks.push(chunk);
    });
    req.on("end", () => {
      const sentToken = req.headers["x-csrftoken"] ?? null;
      imageAttempts += 1;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(imageMode, sentToken)) return;
      unsafeCount += 1;
      imageTokens.push(sentToken);
      const record = { size, type: req.headers["content-type"]?.split(";")[0] ?? null, parts: [], fileSize: null, sniffed: null };
      imageUploads.push(record);
      const target = ownDraft(imagesRoute[1]);
      if (!target || imageMode === "not_found") return notFound();
      if (imageMode === "error" || imageMode === "broken" || imageMode === "hang") return serverFailure(imageMode);
      if (!editableListing(target)) return json(403, envelope("forbidden", "Forbidden.")); // Sold, Rented, Removed or restricted: view only
      if (imageMode === "not_editable") return json(403, envelope("forbidden", "Forbidden.")); // a valid token, a Draft that cannot be edited
      if (imageMode === "payload_too_large") return json(413, envelope("payload_too_large", "Too large."));
      // The body cap comes first (the real middleware refuses before any parsing).
      if (size > MAX_UPLOAD_BODY) return failFields({ file: ["too_large"] });
      if (imageMode === "unsupported_media" || record.type !== "multipart/form-data") return json(415, envelope("unsupported_media_type", "Unsupported media type."));
      const parts = parseMultipart(Buffer.concat(chunks), req.headers["content-type"]);
      if (!parts) return failFields({ file: ["required"] });
      record.parts = parts.map((part) => part.name);
      const files = parts.filter((part) => part.name === "file");
      if (parts.length !== files.length) return failFields({ non_field_errors: ["unknown_field"] });
      if (files.length === 0) return failFields({ file: ["required"] });
      if (files.length > 1) return failFields({ file: ["invalid"] });
      const data = files[0].data;
      record.fileSize = data.length;
      // The size checks come first (the byte length is read before anything else), then the 10-image limit, then the content.
      if (data.length === 0) return failFields({ file: ["required"] });
      if (data.length > MAX_IMAGE_BYTES) return failFields({ file: ["too_large"] });
      if (target.images.length >= MAX_IMAGES || imageMode === "too_many") return json(409, envelope("too_many_images", "Too many images."));
      const type = sniffType(data);
      record.sniffed = type;
      if (!type) return failFields({ file: ["unsupported_type"] });
      if (imageMode === "too_small") return failFields({ file: ["too_small"] });
      if (imageMode === "too_large_dimensions") return failFields({ file: ["too_large_dimensions"] });
      if (imageMode === "invalid_image") return failFields({ file: ["invalid_image"] });
      if (imageMode === "busy" || imageMode === "busy_no_retry") {
        res.writeHead(503, { "content-type": "application/json", ...(imageMode === "busy" ? { "retry-after": "7" } : {}) });
        return res.end(JSON.stringify(envelope("busy", "Busy.")));
      }
      if (imageMode === "cap") return json(409, envelope("storage_cap_exceeded", "Storage cap."));
      const image = newImage(++imageSeq, target.images.length, target.images.length === 0, type);
      image.bytes = data.length;
      target.images.push(image);
      target.revision += 1;
      if (imageMode === "lost_once" && !imageLostSpent) {
        imageLostSpent = true;
        return req.socket.destroy(); // the image was stored, the answer is lost
      }
      const answer = () => json(201, publicImage(target, image));
      if (imageMode === "hold") return void heldUploadAnswers.push(answer);
      return imageMode === "slow" ? void setTimeout(answer, 600) : answer();
    });
    return;
  }
  if (imagesRoute && req.method === "PATCH") {
    return readBody((parsed) => {
      const sentToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(imageOrderMode, sentToken)) return;
      unsafeCount += 1;
      imageTokens.push(sentToken);
      imageOrderBodies.push(parsed);
      const target = ownDraft(imagesRoute[1]);
      if (!target || imageOrderMode === "not_found") return notFound();
      if (!editableListing(target)) return json(403, envelope("forbidden", "Forbidden."));
      if (imageOrderMode === "error" || imageOrderMode === "broken" || imageOrderMode === "hang") return serverFailure(imageOrderMode);
      if (imageOrderMode === "not_editable") return json(403, envelope("forbidden", "Forbidden."));
      if (imageOrderMode === "revision_invalid") return failFields({ base_revision: ["invalid"] });
      const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      const shape = {};
      if (Object.keys(body).some((key) => !["base_revision", "order", "cover_id"].includes(key))) shape.non_field_errors = ["unknown_field"];
      if (!Number.isInteger(body.base_revision) || body.base_revision < 1) shape.base_revision = [body.base_revision === undefined ? "required" : "invalid"];
      if (body.order === undefined) shape.order = ["required"];
      else if (!Array.isArray(body.order) || body.order.length > MAX_IMAGES || body.order.some((entry) => typeof entry !== "string" || !UUID.test(entry))) shape.order = ["invalid"];
      if (body.cover_id !== undefined && body.cover_id !== null && (typeof body.cover_id !== "string" || !UUID.test(body.cover_id))) shape.cover_id = ["invalid"];
      if (Object.keys(shape).length > 0) return failFields(shape);
      const conflictMessage = "This listing was changed since you loaded it.";
      if (imageOrderMode === "conflict_no_current") return json(409, envelope("stale_revision", conflictMessage));
      if (body.base_revision !== target.revision) {
        const conflict = () => json(409, { ...envelope("stale_revision", conflictMessage), current: publicListing(target) });
        return imageOrderMode === "slow" ? void setTimeout(conflict, 600) : conflict();
      }
      const ids = target.images.map((image) => image.id);
      const problems = {};
      if (imageOrderMode === "order_invalid") problems.order = ["invalid"];
      if (imageOrderMode === "cover_invalid") problems.cover_id = ["invalid"];
      if (imageOrderMode === "order_unknown") problems.order = ["mystery_code"];
      if (body.order.length !== ids.length || new Set(body.order).size !== body.order.length || !body.order.every((entry) => ids.includes(entry))) problems.order = ["invalid"];
      if (typeof body.cover_id === "string" && !ids.includes(body.cover_id)) problems.cover_id = ["invalid"];
      if (Object.keys(problems).length > 0) return failFields(problems);
      const sorted = body.order.map((entry) => target.images.find((image) => image.id === entry));
      const coverId = typeof body.cover_id === "string" ? body.cover_id : (target.images.find((image) => image.is_cover)?.id ?? null);
      const changed = sorted.some((image, index) => image.position !== index) || sorted.some((image) => image.is_cover !== (image.id === coverId));
      if (changed) {
        sorted.forEach((image, index) => {
          image.position = index;
          image.is_cover = image.id === coverId;
        });
        target.images = sorted;
        target.revision += 1;
      }
      if (imageOrderMode === "lost_once" && !imageLostSpent) {
        imageLostSpent = true;
        return req.socket.destroy();
      }
      const answer = () => json(200, imageOrderMode === "unreadable" ? { status: "draft" } : publicListing(target));
      return imageOrderMode === "slow" ? void setTimeout(answer, 600) : answer();
    });
  }
  if (imageFileRoute && (req.method === "GET" || req.method === "HEAD")) {
    if (req.method === "GET") imageFileGets += 1;
    else imageFileHeads += 1;
    res.setHeader("cache-control", "private, no-store");
    // A Visitor, another account, an administrator and an unknown id are one answer.
    const target = hasSession() ? ownDraft(imageFileRoute[1]) : undefined;
    const image = target?.images.find((entry) => entry.id === decodeURIComponent(imageFileRoute[2]));
    if (!image || imageFileMode === "not_found") return notFound();
    if (imageFileMode === "broken") return req.socket.destroy();
    res.writeHead(200, {
      "content-type": "image/png",
      "content-length": String(IMAGE_PNG.length),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      "content-security-policy": "default-src 'none'; sandbox",
    });
    return res.end(req.method === "HEAD" ? undefined : IMAGE_PNG);
  }
  if (imageRoute && req.method === "DELETE") {
    const sentToken = req.headers["x-csrftoken"] ?? null;
    res.setHeader("cache-control", "no-store");
    if (signedInUnsafe(imageDeleteMode, sentToken)) return;
    unsafeCount += 1;
    imageTokens.push(sentToken);
    imageDeletes.push(decodeURIComponent(imageRoute[2]));
    const target = ownDraft(imageRoute[1]);
    const at = target ? target.images.findIndex((entry) => entry.id === decodeURIComponent(imageRoute[2])) : -1;
    if (!target || imageDeleteMode === "not_found" || at < 0) return notFound();
    if (imageDeleteMode === "error" || imageDeleteMode === "broken" || imageDeleteMode === "hang") return serverFailure(imageDeleteMode);
    if (imageDeleteMode === "not_editable" || !editableListing(target)) return json(403, envelope("forbidden", "Forbidden."));
    // A Published Listing can never lose its last image.
    if (statusOf(target) === "published" && target.images.length === 1) return failFields({ images: ["images_required"] });
    const [gone] = target.images.splice(at, 1);
    target.images.forEach((image, index) => (image.position = index));
    // The cover goes: the lowest remaining position takes over (none left: no cover).
    if (gone.is_cover && target.images[0]) target.images[0].is_cover = true;
    target.revision += 1;
    if (imageDeleteMode === "lost_once" && !imageLostSpent) {
      imageLostSpent = true;
      return req.socket.destroy();
    }
    const answer = () => {
      res.writeHead(204);
      res.end();
    };
    return imageDeleteMode === "slow" ? void setTimeout(answer, 600) : answer();
  }
  // ---- Profile picture and Agency logo (Story 2.11): owner upload, remove and file routes, and the public logo, mirroring the backend's rules.
  if (url.pathname === "/__profile-image-mode") {
    return choose("profileImageMode", ["ok", "hold", "slow", "too_small", "too_large_dimensions", "invalid_image", "cap", "busy", "busy_no_retry", "rate_limited", "rate_none", "forbidden", "session_gone", "not_found", "unsupported_media", "payload_too_large", "csrf_once", "csrf_always", "lost_once", "error", "broken", "hang"], (v) => {
      profileImageMode = v;
      profileImageLostSpent = false;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__profile-image-delete-mode") {
    return choose("profileImageDeleteMode", ["ok", "hold", "slow", "not_found", "conflict", "busy", "forbidden", "session_gone", "rate_limited", "csrf_once", "csrf_always", "lost_once", "error", "broken", "hang"], (v) => {
      profileImageDeleteMode = v;
      profileImageLostSpent = false;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__profile-image-file-mode") return choose("profileImageFileMode", ["ok", "not_found", "broken"], (v) => (profileImageFileMode = v));
  if (url.pathname === "/__profile-image-wire-mode") return choose("profileImageWireMode", ["ok", "string_image", "bad_url", "other_route", "bad_type", "zero_dims", "bad_agency_id", "bad_logo_url", "upper_ids"], (v) => (profileImageWireMode = v));
  if (url.pathname === "/__logo-mode") return choose("logoMode", ["active", "suspended"], (v) => (logoMode = v));
  // Test-only: a picture or logo that was stored elsewhere (another tab or device), and the release of held answers.
  if (url.pathname === "/__profile-image-set") {
    const kind = url.searchParams.get("kind") === "agency" ? "agency" : "individual";
    const type = url.searchParams.get("type") ?? "image/png";
    const padding = Number(url.searchParams.get("padding") ?? 0);
    profileImages[kind] = url.searchParams.get("clear") === "1" ? null : { type, data: Buffer.concat([IMAGE_PNG, Buffer.alloc(padding, 0x41)]) };
    return json(200, { kind, stored: profileImages[kind] !== null });
  }
  if (url.pathname === "/__listing-delete-release") {
    const answers = heldDeleteAnswers;
    heldDeleteAnswers = [];
    for (const answer of answers) answer();
    return json(200, { released: answers.length });
  }
  if (url.pathname === "/__image-release") {
    const answers = heldUploadAnswers;
    heldUploadAnswers = [];
    for (const answer of answers) answer();
    return json(200, { released: answers.length });
  }
  if (url.pathname === "/__profile-image-release") {
    const answers = heldImageAnswers;
    heldImageAnswers = [];
    for (const answer of answers) answer();
    return json(200, { released: answers.length });
  }
  if (url.pathname === "/__profile-release") {
    const reads = heldProfileReads;
    heldProfileReads = [];
    for (const read of reads) {
      read.res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      read.res.end(read.body);
    }
    return json(200, { released: reads.length });
  }
  if (url.pathname === "/__profile-image-stats") {
    return json(200, {
      attempts: profileImageAttempts,
      puts: profileImagePuts,
      uploads: profileImageUploads,
      deletes: profileImageDeletes,
      fileGets: profileImageFileGets,
      fileHeads: profileImageFileHeads,
      tokens: profileImageTokens,
      logoRequests,
      held: heldImageAnswers.length,
      aborted: profileImageAborted,
      heldReads: heldProfileReads.length,
      stored: Object.fromEntries(Object.entries(profileImages).map(([kind, value]) => [kind, value ? { type: value.type, bytes: value.data.length } : null])),
    });
  }
  const ownerImageRoute = /^\/api\/v1\/me\/(profile|agency-profile)\/image(\/file)?$/.exec(url.pathname);
  const logoRoute = /^\/api\/v1\/agencies\/([^/]+)\/logo$/.exec(url.pathname);
  const sessionKind = () => (sessionAdmin ? "admin" : meMode.startsWith("agency") ? "agency" : "individual");
  const mediaHeaders = (type, length, cache) => ({
    "content-type": type,
    "content-length": String(length),
    "cache-control": cache,
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
    "content-security-policy": "default-src 'none'; sandbox",
  });
  if (logoRoute && (req.method === "GET" || req.method === "HEAD")) {
    logoRequests.push({ method: req.method, cookie: req.headers.cookie ?? null });
    const stored = profileImages.agency;
    // The public logo: anyone, but only while the Agency is Active; every other case is the same 404.
    if (!stored || logoMode !== "active" || decodeURIComponent(logoRoute[1]) !== AGENCY_PUBLIC_ID) {
      res.setHeader("cache-control", "no-store");
      return json(404, envelope("not_found", "Not found."));
    }
    res.writeHead(200, mediaHeaders(stored.type, stored.data.length, "public, max-age=60"));
    return res.end(req.method === "HEAD" ? undefined : stored.data);
  }
  if (ownerImageRoute && ownerImageRoute[2] && (req.method === "GET" || req.method === "HEAD")) {
    if (req.method === "GET") profileImageFileGets += 1;
    else profileImageFileHeads += 1;
    res.setHeader("cache-control", "private, no-store");
    const kind = ownerImageRoute[1] === "profile" ? "individual" : "agency";
    // A Visitor, another account type, an administrator, no image and a lost file are one answer.
    const stored = hasSession() && sessionKind() === kind ? profileImages[kind] : null;
    if (!stored || profileImageFileMode === "not_found") return notFound();
    if (profileImageFileMode === "broken") return req.socket.destroy();
    res.writeHead(200, mediaHeaders(stored.type, stored.data.length, "private, no-store"));
    return res.end(req.method === "HEAD" ? undefined : stored.data);
  }
  if (ownerImageRoute && !ownerImageRoute[2] && req.method === "PUT") {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_UPLOAD_BODY + 1) chunks.push(chunk);
    });
    req.on("end", () => {
      const sentToken = req.headers["x-csrftoken"] ?? null;
      const kind = ownerImageRoute[1] === "profile" ? "individual" : "agency";
      profileImageAttempts += 1;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(profileImageMode, sentToken)) return;
      unsafeCount += 1;
      profileImageTokens.push(sentToken);
      const record = { kind, size, type: req.headers["content-type"]?.split(";")[0] ?? null, parts: [], fileSize: null, sniffed: null };
      profileImageUploads.push(record);
      // The account type is checked before the body is read, and before the 10-per-hour limit counts.
      if (sessionKind() !== kind) return json(403, envelope("forbidden", "Forbidden."));
      if (profileImageMode === "not_found") return notFound();
      if (profileImageMode === "error" || profileImageMode === "broken" || profileImageMode === "hang") return serverFailure(profileImageMode);
      if (profileImageMode === "payload_too_large") return json(413, envelope("payload_too_large", "Too large."));
      profileImagePuts += 1;
      if (profileImagePuts > 10) {
        res.writeHead(429, { "content-type": "application/json", "retry-after": "3600" });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      // The body cap comes first (the real middleware refuses before any parsing).
      if (size > MAX_UPLOAD_BODY) return failFields({ file: ["too_large"] });
      if (profileImageMode === "unsupported_media" || record.type !== "multipart/form-data") return json(415, envelope("unsupported_media_type", "Unsupported media type."));
      const parts = parseMultipart(Buffer.concat(chunks), req.headers["content-type"]);
      if (!parts) return failFields({ file: ["required"] });
      record.parts = parts.map((part) => part.name);
      const files = parts.filter((part) => part.name === "file");
      if (parts.length !== files.length) return failFields({ non_field_errors: ["unknown_field"] });
      if (files.length === 0) return failFields({ file: ["required"] });
      if (files.length > 1) return failFields({ file: ["invalid"] });
      const data = files[0].data;
      record.fileSize = data.length;
      if (data.length === 0) return failFields({ file: ["required"] });
      if (data.length > MAX_IMAGE_BYTES) return failFields({ file: ["too_large"] });
      const type = sniffType(data);
      record.sniffed = type;
      if (!type) return failFields({ file: ["unsupported_type"] });
      if (profileImageMode === "too_small") return failFields({ file: ["too_small"] });
      if (profileImageMode === "too_large_dimensions") return failFields({ file: ["too_large_dimensions"] });
      if (profileImageMode === "invalid_image") return failFields({ file: ["invalid_image"] });
      if (profileImageMode === "busy" || profileImageMode === "busy_no_retry") {
        res.writeHead(503, { "content-type": "application/json", ...(profileImageMode === "busy" ? { "retry-after": "7" } : {}) });
        return res.end(JSON.stringify(envelope("busy", "Busy.")));
      }
      if (profileImageMode === "cap") return json(409, envelope("storage_cap_exceeded", "Storage cap."));
      const commit = () => {
        profileImages[kind] = { type, data };
      };
      // A held upload is stored only when its answer is released, and not at all when the client gave up on it meanwhile.
      if (profileImageMode === "hold") {
        res.on("close", () => {
          if (!res.writableEnded) profileImageAborted += 1;
        });
        return void heldImageAnswers.push(() => {
          if (res.socket?.destroyed) return;
          commit();
          json(200, wireImage(kind));
        });
      }
      commit();
      if (profileImageMode === "lost_once" && !profileImageLostSpent) {
        profileImageLostSpent = true;
        return req.socket.destroy(); // the image was stored, the answer is lost
      }
      const answer = () => json(200, wireImage(kind));
      return profileImageMode === "slow" ? void setTimeout(answer, 600) : answer();
    });
    return;
  }
  if (ownerImageRoute && !ownerImageRoute[2] && req.method === "DELETE") {
    const sentToken = req.headers["x-csrftoken"] ?? null;
    const kind = ownerImageRoute[1] === "profile" ? "individual" : "agency";
    res.setHeader("cache-control", "no-store");
    if (signedInUnsafe(profileImageDeleteMode, sentToken)) return;
    unsafeCount += 1;
    profileImageTokens.push(sentToken);
    profileImageDeletes.push(kind);
    if (sessionKind() !== kind) return json(403, envelope("forbidden", "Forbidden."));
    if (profileImageDeleteMode === "not_found") return notFound();
    if (profileImageDeleteMode === "conflict") return json(409, envelope("conflict", "Conflict."));
    if (profileImageDeleteMode === "busy") {
      res.writeHead(503, { "content-type": "application/json", "retry-after": "7" });
      return res.end(JSON.stringify(envelope("busy", "Busy.")));
    }
    if (profileImageDeleteMode === "error" || profileImageDeleteMode === "broken" || profileImageDeleteMode === "hang") return serverFailure(profileImageDeleteMode);
    profileImages[kind] = null; // a repeat is a harmless 204
    if (profileImageDeleteMode === "lost_once" && !profileImageLostSpent) {
      profileImageLostSpent = true;
      return req.socket.destroy();
    }
    const answer = () => {
      res.writeHead(204);
      res.end();
    };
    if (profileImageDeleteMode === "hold") return void heldImageAnswers.push(answer);
    return profileImageDeleteMode === "slow" ? void setTimeout(answer, 600) : answer();
  }
  if (url.pathname === "/api/v1/me/listings" && req.method === "GET") {
    listingsGets += 1;
    listingQueries.push(url.search);
    res.setHeader("cache-control", "no-store");
    if (listingsMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    const cursor = url.searchParams.get("cursor");
    if (sessionAdmin) return json(403, envelope("forbidden", "Forbidden."));
    if ((listingsMode === "flaky" || listingsMode === "flaky_slow") && listingsGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (listingsMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (listingsMode === "more_forbidden" && cursor) return json(403, envelope("forbidden", "Forbidden."));
    if (listingsMode === "more_rate_limited" && cursor) return throttled();
    if (listingsMode === "more_fail" && cursor) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (listingsMode === "more_gone" && cursor) {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (listingsMode === "rate_limited") return throttled();
    if (listingsMode === "malformed") return json(200, { results: "none", next: null, previous: null });
    if (listingsMode === "bad_next") return json(200, { results: [], next: `http://${req.headers.host}/api/v1/me/listings?x=1`, previous: null });
    if (listingsMode === "error" || listingsMode === "broken" || listingsMode === "hang") return serverFailure(listingsMode);
    const size = listingsMode === "small_pages" ? 1 : 20;
    // Story 2.17: `status` filters by one of the six statuses; anything else is a validation error.
    const statusFilter = url.searchParams.get("status");
    if (statusFilter !== null && !STATUS_NAMES.includes(statusFilter)) return json(400, envelope("validation_error", "The request contains invalid values.", { status: ["invalid_choice"] }));
    let pool = listings.filter((item) => item.owner === "mine" && (statusFilter === null || statusOf(item) === statusFilter));
    if (cursor) {
      const at = Number(cursor.replace("pos-", ""));
      if (!cursor.startsWith("pos-") || !Number.isFinite(at)) return json(400, envelope("validation_error", "Invalid cursor.", { cursor: ["invalid"] }));
      pool = pool.filter((item) => item.seq < at);
    }
    pool = [...pool].sort((a, b) => b.seq - a.seq);
    const results = pool.slice(0, size);
    // dup: the second page repeats the last item of the first page, so the client must not show it twice.
    if (listingsMode === "dup" && cursor) {
      const again = listings.find((item) => item.seq === Number(cursor.replace("pos-", "")));
      if (again) results.unshift(again);
    }
    const more = pool.length > size;
    const origin = `http://${req.headers.host ?? "127.0.0.1:4010"}/api/v1/me/listings`;
    let next = more ? `${origin}?cursor=pos-${results[results.length - 1].seq}` : null;
    let shown = results.map(publicListing);
    if (listingsMode === "partial") shown.unshift({ status: "draft" }, null);
    if (listingsMode === "inpage_dup" && shown.length > 0) shown = [...shown, shown[0]];
    // bad_first: the first page has only unusable items but a next cursor (the real items follow).
    if (listingsMode === "bad_first" && !cursor) {
      shown = [{ status: "draft" }, null];
      next = `${origin}?cursor=pos-3`;
    }
    // repeat_cursor: every page repeats the same items and the same cursor (the client must stop).
    if (listingsMode === "repeat_cursor" && cursor) {
      shown = pool.length > 0 ? [publicListing(listings.find((item) => item.seq === 25) ?? pool[0])] : [];
      next = `${origin}?cursor=${cursor}`;
    }
    // known_advance: the second page only repeats a known item but moves the cursor on.
    if (listingsMode === "known_advance" && cursor === "pos-6") {
      shown = [publicListing(listings.find((item) => item.seq === 25))];
      next = `${origin}?cursor=pos-5`;
    }
    const answer = () => json(200, { next, previous: null, results: shown });
    if (listingsMode === "flaky_slow") return void setTimeout(answer, 1500);
    return answer();
  }
  // Story 2.17: how many of the caller's Listings are in each status (every status present, 0 when none).
  if (url.pathname === "/api/v1/me/listings/counts" && req.method === "GET") {
    countsGets += 1;
    res.setHeader("cache-control", "no-store");
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (sessionAdmin || countsMode === "forbidden" || listingsMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (countsMode === "error" || countsMode === "hang") return serverFailure(countsMode);
    if (countsMode === "malformed") return json(200, { draft: "many" });
    const counts = Object.fromEntries(STATUS_NAMES.map((name) => [name, 0]));
    for (const item of listings) if (item.owner === "mine") counts[statusOf(item)] += 1;
    return json(200, counts);
  }
  // ---- Notifications (Story 1.24)
  if (url.pathname === "/__notifications-mode") {
    return choose("notificationsMode", ["ok", "flaky", "more_fail", "more_gone", "small_pages", "rate_limited", "forbidden", "dup", "known_only", "partial", "bad_next", "malformed", "session_gone", "error", "broken", "hang"], (v) => {
      notificationsMode = v;
      notificationsGets = 0;
    });
  }
  if (url.pathname === "/__notification-read-mode") {
    return choose("notificationReadMode", ["ok", "gone", "session_gone", "forbidden", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      notificationReadMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__notification-readall-mode") {
    return choose("notificationReadAllMode", ["ok", "session_gone", "forbidden", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"], (v) => {
      notificationReadAllMode = v;
      csrfOnceSpent = false;
    });
  }
  if (url.pathname === "/__unread-count-mode") return choose("unreadCountMode", ["ok", "error", "broken", "hang", "forbidden", "rate_limited", "session_gone"], (v) => (unreadCountMode = v));
  if (url.pathname === "/__allowance-mode") {
    return choose("allowanceMode", ["ok", "empty", "last", "exhausted", "over", "year_end", "cacheable", "error", "broken", "hang", "session_gone", "forbidden", "rate_limited", "malformed", "float", "negative", "remaining_over_limit", "over_with_remaining", "bad_date", "bad_zone", "missing", "remaining_mismatch", "remaining_mismatch_high", "no_offset", "odd_date", "mid_month", "extra_key", "zero"], (v) => (allowanceMode = v));
  }
  if (url.pathname === "/__allowance-stats") return json(200, { gets: allowanceGets });
  if (url.pathname === "/__notifications-cacheable") {
    cacheable = url.searchParams.get("value") === "1";
    return json(200, { cacheable });
  }
  if (url.pathname === "/__account-variant") {
    accountVariant = url.searchParams.get("value") === "2" ? "2" : "1";
    return json(200, { accountVariant });
  }
  if (url.pathname === "/__notifications-preset") {
    const value = url.searchParams.get("value") ?? "default";
    if (!Object.hasOwn(NOTIFICATION_PRESETS, value)) return json(400, { error: "unknown preset" });
    notifications = NOTIFICATION_PRESETS[value]();
    return json(200, { total: notifications.length });
  }
  if (url.pathname === "/__notifications-read-elsewhere") {
    // Test-only: reads the n newest unread notifications as if another tab or device had.
    let left = Number(url.searchParams.get("n") ?? "1");
    notifications = notifications.map((item) => (!item.read && left-- > 0 ? { ...item, read: true } : item));
    return json(200, { unread: notifications.filter((item) => !item.read).length });
  }
  if (url.pathname === "/__notifications-add") {
    // Test-only: a new unread notification arrives (newest) of the given kind.
    const seq = Math.max(0, ...notifications.map((item) => item.seq)) + 1;
    const kind = url.searchParams.get("kind") ?? "account.password_changed";
    let payload = url.searchParams.get("payload") ? { secret_detail: UNKNOWN_SECRET, listing_title: UNKNOWN_SECRET } : {};
    // Story 2.13: `listing.draft_expiring` carries only the draft's id and the days left (set here as `listing_id` and `days_left`).
    if (kind === "listing.draft_expiring") {
      const days = url.searchParams.get("days_left");
      payload = { listing_id: url.searchParams.get("listing_id") ?? listingId(1), days_left: url.searchParams.get("days_text") !== null ? url.searchParams.get("days_text") : days === null ? 5 : Number(days) };
    }
    notifications = [{ seq, id: notificationId(seq), kind, payload, created_at: new Date(Date.UTC(2026, 10, 20, 11, 0, 0)).toISOString(), read: false }, ...notifications];
    return json(200, { total: notifications.length });
  }
  if (url.pathname === "/__notifications-stats") {
    return json(200, {
      gets: notificationsGets,
      queries: notificationQueries,
      countGets: unreadCountGets,
      readCount: notificationReadCount,
      lastReadId: lastNotificationReadId,
      lastReadToken: lastNotificationReadToken,
      readAllCount: notificationReadAllCount,
      lastReadAllToken: lastNotificationReadAllToken,
      unread: notifications.filter((item) => !item.read).length,
      total: notifications.length,
    });
  }
  if (url.pathname === "/api/v1/notifications" && req.method === "GET") {
    notificationsGets += 1;
    notificationQueries.push(url.search);
    res.setHeader("cache-control", cacheable ? "public, max-age=600" : "no-store");
    if (notificationsMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    const cursor = url.searchParams.get("cursor");
    if (notificationsMode === "flaky" && notificationsGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (notificationsMode === "more_fail" && cursor) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (notificationsMode === "more_gone" && cursor) {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (notificationsMode === "rate_limited") return throttled();
    if (notificationsMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (notificationsMode === "malformed") return json(200, { results: "none", next: null, previous: null });
    if (notificationsMode === "bad_next") return json(200, { results: [], next: `http://${req.headers.host}/api/v1/notifications?state=all`, previous: null });
    if (notificationsMode === "error" || notificationsMode === "broken" || notificationsMode === "hang") return serverFailure(notificationsMode);
    const state = url.searchParams.get("state") ?? "all";
    if (!["all", "unread"].includes(state)) return json(400, envelope("validation_error", "Invalid state.", { state: ["invalid"] }));
    const size = notificationsMode === "small_pages" ? 1 : Math.min(50, Math.max(1, Number(url.searchParams.get("page_size")) || 20));
    let pool = notifications.filter((item) => state === "all" || !item.read);
    if (cursor) {
      const at = Number(cursor.replace("pos-", ""));
      if (!cursor.startsWith("pos-") || !Number.isFinite(at)) return json(400, envelope("validation_error", "Invalid cursor.", { cursor: ["invalid"] }));
      pool = pool.filter((item) => item.seq < at);
    }
    const results = pool.slice(0, size);
    // dup: the second page repeats the last item of the first page, so the client must not show it twice.
    if (notificationsMode === "dup" && cursor) {
      const again = notifications.find((item) => item.seq === Number(cursor.replace("pos-", "")));
      if (again) results.unshift(again);
    }
    if (notificationsMode === "known_only" && cursor) {
      // Only an item the client already has, and no further page.
      const again = notifications.find((item) => item.seq === Number(cursor.replace("pos-", "")));
      return json(200, { next: null, previous: null, results: again ? [publicNotification(again)] : [] });
    }
    const more = pool.length > size;
    const next = more ? `http://${req.headers.host ?? "127.0.0.1:4010"}/api/v1/notifications?cursor=pos-${results[results.length - 1].seq}&state=${state}` : null;
    const shown = results.map(publicNotification);
    if (notificationsMode === "partial") shown.unshift({ id: 7 }, null);
    return json(200, { next, previous: null, results: shown });
  }
  if (url.pathname === "/api/v1/notifications/unread-count" && req.method === "GET") {
    unreadCountGets += 1;
    res.setHeader("cache-control", cacheable ? "public, max-age=600" : "no-store");
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (unreadCountMode === "error" || unreadCountMode === "broken" || unreadCountMode === "hang") return serverFailure(unreadCountMode);
    if (unreadCountMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (unreadCountMode === "rate_limited") return throttled();
    return json(200, { unread: notifications.filter((item) => !item.read).length });
  }
  if (url.pathname === "/api/v1/me/publication-allowance" && req.method === "GET") {
    allowanceGets += 1;
    res.setHeader("cache-control", allowanceMode === "cacheable" ? "public, max-age=600" : "no-store");
    if (allowanceMode === "session_gone") liveSession = false;
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (sessionAdmin || allowanceMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (allowanceMode === "error" || allowanceMode === "broken" || allowanceMode === "hang") return serverFailure(allowanceMode);
    if (allowanceMode === "rate_limited") return throttled();
    const limit = account().account_type === "agency" ? 10 : 2;
    const used = (ALLOWANCE_BASE_USED(limit)[allowanceMode] ?? 1) + (publishUsed[accountVariant] ?? 0);
    const body = {
      limit: allowanceMode === "zero" ? 0 : limit,
      used,
      remaining: Math.max((allowanceMode === "zero" ? 0 : limit) - used, 0),
      period_start: "2026-11-01T00:00:00+05:00",
      resets_at: allowanceMode === "year_end" ? "2027-01-01T00:00:00+05:00" : "2026-12-01T00:00:00+05:00",
      timezone: "Asia/Karachi",
    };
    if (allowanceMode === "year_end") body.period_start = "2026-12-01T00:00:00+05:00";
    if (allowanceMode === "malformed") return json(200, { limit: "2" });
    if (allowanceMode === "float") body.used = 0.5;
    if (allowanceMode === "negative") body.used = -1;
    if (allowanceMode === "remaining_over_limit") body.remaining = limit + 1;
    if (allowanceMode === "over_with_remaining") Object.assign(body, { used: limit + 1, remaining: 1 });
    if (allowanceMode === "bad_date") body.resets_at = "next month";
    if (allowanceMode === "bad_zone") body.timezone = "UTC";
    if (allowanceMode === "missing") delete body.remaining;
    if (allowanceMode === "remaining_mismatch") Object.assign(body, { limit: 2, used: 0, remaining: 0 });
    if (allowanceMode === "remaining_mismatch_high") Object.assign(body, { limit: 2, used: 1, remaining: 2 });
    if (allowanceMode === "no_offset") body.resets_at = "2026-12-01T00:00:00";
    if (allowanceMode === "odd_date") body.resets_at = "Dec 1 2026 00:00 +0500";
    if (allowanceMode === "mid_month") body.resets_at = "2026-12-02T00:00:00+05:00";
    if (allowanceMode === "extra_key") body.policy_id = "00000000-0000-4000-8000-000000000001";
    return json(200, body);
  }
  if (url.pathname === "/api/v1/notifications/read-all" && req.method === "POST") {
    return readBody(() => {
      unsafeCount += 1;
      notificationReadAllCount += 1;
      lastNotificationReadAllToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(notificationReadAllMode, lastNotificationReadAllToken)) return;
      if (notificationReadAllMode === "error" || notificationReadAllMode === "broken" || notificationReadAllMode === "hang") return serverFailure(notificationReadAllMode);
      const marked = notifications.filter((item) => !item.read).length;
      notifications = notifications.map((item) => ({ ...item, read: true }));
      return json(200, { marked });
    });
  }
  const readMatch = /^\/api\/v1\/notifications\/([0-9a-f-]+)\/read$/.exec(url.pathname);
  if (readMatch && req.method === "POST") {
    return readBody(() => {
      unsafeCount += 1;
      notificationReadCount += 1;
      lastNotificationReadId = readMatch[1];
      lastNotificationReadToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(notificationReadMode, lastNotificationReadToken)) return;
      if (notificationReadMode === "error" || notificationReadMode === "broken" || notificationReadMode === "hang") return serverFailure(notificationReadMode);
      const found = notifications.find((item) => item.id === readMatch[1]);
      if (notificationReadMode === "gone") {
        notifications = notifications.filter((item) => item !== found);
        return json(404, envelope("not_found", "Not found."));
      }
      if (!found) return json(404, envelope("not_found", "Not found."));
      notifications = notifications.map((item) => (item === found ? { ...item, read: true } : item));
      return json(200, publicNotification({ ...found, read: true }));
    });
  }
  if (url.pathname === "/api/v1/me/profile" && req.method === "PATCH") {
    return readBody((parsed) => {
      unsafeCount += 1;
      profilePatchCount += 1;
      lastProfilePatch = parsed;
      lastProfilePatchToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(profilePatchMode, lastProfilePatchToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (profilePatchMode === "fields") return fail({ full_name: ["invalid_name"], phone: ["invalid_phone"] });
      if (profilePatchMode === "required") return fail({ full_name: ["required"], phone: ["required"] });
      if (profilePatchMode === "sentences") return fail({ full_name: ["Enter a valid name."], phone: ["mystery_code"], role: ["Some server sentence."] });
      if (profilePatchMode === "proto") return fail({ full_name: ["constructor"], phone: ["__proto__"], non_field_errors: ["toString"] });
      if (profilePatchMode === "empty_ok") {
        if (parsed && typeof parsed.full_name === "string") profile = { ...profile, full_name: parsed.full_name };
        if (parsed && typeof parsed.phone === "string") profile = { ...profile, phone: parsed.phone };
        return json(200, {});
      }
      if (profilePatchMode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (profilePatchMode === "unknown_code") return fail({ phone: ["mystery_code"] });
      if (profilePatchMode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (profilePatchMode === "error" || profilePatchMode === "broken" || profilePatchMode === "hang") return serverFailure(profilePatchMode);
      if (parsed && typeof parsed.full_name === "string") profile = { ...profile, full_name: parsed.full_name };
      if (parsed && typeof parsed.phone === "string") profile = { ...profile, phone: parsed.phone };
      return json(200, profileBody());
    });
  }
  if (url.pathname === "/api/v1/me/email-change" && req.method === "POST") {
    return readBody((parsed) => {
      unsafeCount += 1;
      emailChangeCount += 1;
      lastEmailChange = parsed;
      lastEmailChangeToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(emailChangeMode, lastEmailChangeToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      if (emailChangeMode === "wrong_password") return fail({ current_password: ["incorrect"] });
      if (emailChangeMode === "invalid_email") return fail({ new_email: ["invalid_email"] });
      if (emailChangeMode === "required") return fail({ new_email: ["required"], current_password: ["required"] });
      if (emailChangeMode === "sentences") return fail({ new_email: ["This address is already registered."], current_password: ["The password you entered is wrong."], role: ["Some server sentence."] });
      if (emailChangeMode === "proto") return fail({ new_email: ["__proto__"], current_password: ["constructor"] });
      if (emailChangeMode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (emailChangeMode === "unknown_code") return fail({ current_password: ["mystery_code"] });
      if (emailChangeMode === "error" || emailChangeMode === "broken" || emailChangeMode === "hang") return serverFailure(emailChangeMode);
      // Free, taken and unchanged addresses all answer alike, and the profile shows the pending address for every one.
      if (parsed && typeof parsed.new_email === "string") profile = { ...profile, pending_email: parsed.new_email };
      return json(202, { status: "check_your_email" });
    });
  }
  if (url.pathname === "/api/v1/email-changes/confirm" && req.method === "POST") {
    return readBody((parsed) => {
      emailConfirmCount += 1;
      lastEmailConfirm = parsed;
      res.setHeader("cache-control", "no-store");
      if (emailConfirmMode === "ok" || (emailConfirmMode === "flaky" && emailConfirmCount > 1)) {
        profile = { ...profile, email: profile.pending_email ?? "ayesha.new@example.com", pending_email: null };
        return json(200, { status: "email_changed" });
      }
      if (emailConfirmMode === "flaky") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (emailConfirmMode === "expired") return json(410, envelope("link_expired", "This link has expired."));
      if (emailConfirmMode === "used") return json(409, envelope("link_used", "This link was already used."));
      if (emailConfirmMode === "invalid") return json(400, envelope("link_invalid", "This link is not valid."));
      if (emailConfirmMode === "other_400") return json(400, envelope("validation_error", "Raw server text that must not show.", { token: ["invalid"] }));
      if (emailConfirmMode === "unknown_code") return json(410, envelope("something_else", "Raw server text that must not show."));
      if (emailConfirmMode === "rate_limited") return throttled();
      return serverFailure(emailConfirmMode);
    });
  }
  if (url.pathname === "/__agency-profile-mode") {
    return choose("agencyProfileMode", ["ok", "forbidden", "flaky", "session_gone", "malformed", "inactive_city", "verified", "odd_status", "hold", "error", "broken", "hang"], (v) => {
      agencyProfileMode = v;
      agencyProfileGets = 0;
      if (v === "inactive_city") agencyProfile = { ...agencyProfile, city_id: INACTIVE_CITY }; // a later save of another city replaces it
    });
  }
  if (url.pathname === "/__agency-profile-patch-mode") {
    return choose(
      "agencyProfilePatchMode",
      ["ok", "fields", "required", "contact", "description_codes", "invalid_city", "sentences", "proto", "empty_ok", "non_field", "unknown_code", "empty_fields", "session_gone", "forbidden", "rate_limited", "csrf_once", "csrf_always", "error", "broken", "hang"],
      (v) => {
        agencyProfilePatchMode = v;
        csrfOnceSpent = false;
      },
    );
  }
  if (url.pathname === "/__agency-profile-set") {
    // Test-only: changes the stored profile as if another tab or device had saved it.
    for (const name of Object.keys(AGENCY_PROFILE_START)) {
      const value = url.searchParams.get(name);
      if (value !== null) agencyProfile = { ...agencyProfile, [name]: value };
    }
    return json(200, agencyProfile);
  }
  if (url.pathname === "/__last-agency-profile") return json(200, { gets: agencyProfileGets, profile: agencyProfile });
  if (url.pathname === "/__last-agency-profile-patch") {
    return json(200, { count: agencyProfilePatchCount, body: lastAgencyProfilePatch, token: lastAgencyProfilePatchToken });
  }
  const agencyProfileBody = () => ({
    ...agencyProfile,
    image: wireImage("agency"),
    ...agencyIdentifiers(),
    email: profile.email,
    pending_email: profile.pending_email,
    verification_status: agencyProfileMode === "verified" ? "verified" : agencyProfileMode === "odd_status" ? "<b>Odd Status</b>" : "unverified",
  });
  if (url.pathname === "/api/v1/me/agency-profile" && req.method === "GET") {
    agencyProfileGets += 1;
    res.setHeader("cache-control", "no-store");
    if (agencyProfileMode === "session_gone") {
      liveSession = false;
      return json(401, envelope("unauthenticated", "Authentication is required."));
    }
    if (!hasSession()) return json(401, envelope("unauthenticated", "Authentication is required."));
    if (agencyProfileMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
    if (agencyProfileMode === "flaky" && agencyProfileGets === 1) return json(500, envelope("server_error", "Internal detail that must not show."));
    if (agencyProfileMode === "malformed") return json(200, { agency_name: 7 });
    if (agencyProfileMode === "error" || agencyProfileMode === "broken" || agencyProfileMode === "hang") return serverFailure(agencyProfileMode);
    if (agencyProfileMode === "hold") {
      heldProfileReads.push({ res, body: JSON.stringify(agencyProfileBody()) }); // the answer as it is NOW, sent when released
      return;
    }
    return json(200, agencyProfileBody());
  }
  if (url.pathname === "/api/v1/me/agency-profile" && req.method === "PATCH") {
    return readBody((parsed) => {
      unsafeCount += 1;
      agencyProfilePatchCount += 1;
      lastAgencyProfilePatch = parsed;
      lastAgencyProfilePatchToken = req.headers["x-csrftoken"] ?? null;
      res.setHeader("cache-control", "no-store");
      if (signedInUnsafe(agencyProfilePatchMode, lastAgencyProfilePatchToken)) return;
      const fail = (fields) => json(400, envelope("validation_error", "The request contains invalid values.", fields));
      const mode = agencyProfilePatchMode;
      if (mode === "fields") {
        return fail({ agency_name: ["invalid_name"], business_phone: ["invalid_phone"], office_address: ["invalid_address"], city_id: ["invalid"] });
      }
      if (mode === "required") {
        const required = ["required"];
        return fail({ agency_name: required, business_phone: required, office_address: required, city_id: required });
      }
      if (mode === "contact") return fail({ description: ["contains_contact_details"] });
      if (mode === "description_codes") return fail({ description: ["invalid_description", "invalid"] });
      if (mode === "invalid_city") return fail({ city_id: ["invalid_city"] });
      if (mode === "sentences") return fail({ agency_name: ["Enter a valid name."], description: ["mystery_code"], role: ["Some server sentence."] });
      if (mode === "proto") return fail({ agency_name: ["constructor"], description: ["__proto__"], non_field_errors: ["toString"] });
      if (mode === "non_field") return fail({ non_field_errors: ["unknown_field"] });
      if (mode === "unknown_code") return fail({ business_phone: ["mystery_code"] });
      if (mode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (mode === "error" || mode === "broken" || mode === "hang") return serverFailure(mode);
      for (const name of Object.keys(AGENCY_PROFILE_START)) {
        if (parsed && typeof parsed[name] === "string") {
          // The backend collapses all whitespace in the description.
          agencyProfile = { ...agencyProfile, [name]: name === "description" ? parsed[name].replace(/\s+/g, " ").trim() : parsed[name] };
        }
      }
      if (mode === "empty_ok") return json(200, {});
      return json(200, agencyProfileBody());
    });
  }
  if (url.pathname === "/__cities-mode") {
    return choose("citiesMode", ["ok", "empty", "error", "flaky", "hang", "slow", "other", "malformed", "partial"], (v) => {
      citiesMode = v;
      citiesCount = 0;
    });
  }
  if (url.pathname === "/__last-cities") return json(200, { count: citiesCount });
  if (url.pathname === "/api/v1/reference/cities" && req.method === "GET") {
    citiesCount += 1;
    if (citiesMode === "ok") return json(200, { items: CITIES });
    if (citiesMode === "empty") return json(200, { items: [] });
    if (citiesMode === "other") return json(200, { items: [{ id: "44444444-4444-4444-8444-444444444444", name: "Multan" }, { id: "55555555-5555-4555-8555-555555555555", name: "Peshawar" }] });
    if (citiesMode === "malformed") return json(200, { items: [{ id: 7, name: "Numeric id" }, { id: "66666666-6666-4666-8666-666666666666", name: "  " }, null] });
    if (citiesMode === "partial") {
      return json(200, { items: [CITIES[0], { id: CITIES[0].id, name: "Duplicate id" }, { id: 7, name: "Numeric id" }, { id: "66666666-6666-4666-8666-666666666666", name: "" }, CITIES[1]] });
    }
    if (citiesMode === "flaky") return citiesCount === 1 ? json(500, envelope("server_error", "Internal detail that must not show.")) : json(200, { items: CITIES });
    if (citiesMode === "slow") return void setTimeout(() => json(200, { items: CITIES }), 1500);
    return serverFailure(citiesMode);
  }
  if (url.pathname === "/__amenities-mode") {
    return choose("amenitiesMode", ["ok", "empty", "error", "flaky", "fail_then_slow", "hang", "slow", "malformed", "partial", "html", "long_label", "short_label", "padded_label", "bad_group", "dup_code"], (v) => {
      amenitiesMode = v;
      amenitiesCount = 0;
    });
  }
  if (url.pathname === "/__last-amenities") return json(200, { count: amenitiesCount });
  // Public, like the backend's reference lists: no cookie needed, and (like the backend) no Cache-Control header.
  if (url.pathname === "/api/v1/reference/amenities" && req.method === "GET") {
    amenitiesCount += 1;
    if (amenitiesMode === "ok") return json(200, { items: AMENITIES });
    if (amenitiesMode === "empty") return json(200, { items: [] });
    if (amenitiesMode === "malformed") return json(200, { items: [{ code: 7, label: "Numeric code", kind: "nearby", group: "nearby" }, { code: "Bad Code", label: "Odd", kind: "community", group: "x" }, { code: "no_kind", label: "No kind", kind: "district", group: "x" }, null] });
    if (amenitiesMode === "partial") {
      return json(200, { items: [AMENITIES[6], { ...AMENITIES[6], label: "Duplicate code" }, { code: "no_label", label: "  ", kind: "community", group: "x" }, { code: "bad_group", label: "Bad group", kind: "community", group: "Bad Group" }, { code: "bad_kind", label: "Bad kind", kind: "other", group: "x" }, AMENITIES[7], AMENITIES[21]] });
    }
    if (amenitiesMode === "long_label") return json(200, { items: [...AMENITIES.slice(0, 3), { ...AMENITIES[3], label: "x".repeat(81) }] });
    if (amenitiesMode === "short_label") return json(200, { items: [...AMENITIES.slice(0, 3), { ...AMENITIES[3], label: "x" }] });
    if (amenitiesMode === "padded_label") return json(200, { items: [...AMENITIES.slice(0, 3), { ...AMENITIES[3], label: " Elevator " }] });
    if (amenitiesMode === "bad_group") return json(200, { items: [...AMENITIES.slice(0, 3), { ...AMENITIES[3], group: "a" }] });
    if (amenitiesMode === "dup_code") return json(200, { items: [AMENITIES[0], { ...AMENITIES[1], code: AMENITIES[0].code }] });
    if (amenitiesMode === "fail_then_slow") return amenitiesCount === 1 ? json(500, envelope("server_error", "Internal detail that must not show.")) : void setTimeout(() => json(200, { items: AMENITIES }), 1500);
    if (amenitiesMode === "html") return void (res.writeHead(200, { "Content-Type": "text/html" }), res.end("<html>not json</html>"));
    if (amenitiesMode === "flaky") return amenitiesCount === 1 ? json(500, envelope("server_error", "Internal detail that must not show.")) : json(200, { items: AMENITIES });
    if (amenitiesMode === "slow") return void setTimeout(() => json(200, { items: AMENITIES }), 1500);
    return serverFailure(amenitiesMode);
  }
  if (url.pathname === "/__localities-mode") {
    return choose("localitiesMode", ["ok", "error", "flaky", "slow", "hang", "malformed", "partial", "empty", "html404", "emoji"], (v) => {
      localitiesMode = v;
      localitiesCount = 0;
      localitiesAnswered = 0;
      localityCityIds = [];
    });
  }
  if (url.pathname === "/__last-localities") return json(200, { count: localitiesCount, answered: localitiesAnswered, cityIds: localityCityIds });
  const localitiesMatch = /^\/api\/v1\/reference\/cities\/([^/]+)\/localities$/.exec(url.pathname);
  if (localitiesMatch && req.method === "GET") {
    localitiesCount += 1;
    const cityId = decodeURIComponent(localitiesMatch[1]);
    localityCityIds.push(cityId);
    if (!Object.hasOwn(LOCALITIES, cityId)) return json(404, envelope("not_found", "Not found."));
    const list = LOCALITIES[cityId];
    if (localitiesMode === "html404") {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end("<html><body>Not Found</body></html>");
    }
    if (localitiesMode === "emoji") {
      return json(200, { items: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", name: "😀".repeat(50), kind: "area" }, { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002", name: "😀".repeat(81), kind: "area" }, list[0]] });
    }
    if (localitiesMode === "slow") return void setTimeout(() => { localitiesAnswered += 1; json(200, { items: list }); }, 1200);
    localitiesAnswered += 1;
    if (localitiesMode === "ok") return json(200, { items: list });
    if (localitiesMode === "empty") return json(200, { items: [] });
    if (localitiesMode === "malformed") return json(200, { items: [{ id: 7, name: "Numeric id", kind: "area" }, { id: list[0]?.id ?? "x", name: "Bad kind", kind: "district" }, null] });
    if (localitiesMode === "partial") return json(200, { items: [...list.slice(0, 1), { id: "not-an-id", name: "Odd", kind: "area" }, { ...list[0] }, { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", name: "Wrong kind", kind: "other" }, ...list.slice(1)] });
    if (localitiesMode === "flaky") return localitiesCount === 1 ? json(500, envelope("server_error", "Internal detail that must not show.")) : json(200, { items: list });
    return serverFailure(localitiesMode);
  }
  if (url.pathname === "/__agency-mode") {
    return choose("agencyMode", [
      "accepted", "existing", "ok_200", "email_sentence", "fields", "required", "sentences", "invalid_city", "mixed", "non_field", "empty_fields",
      "bad_json", "signed_in", "bad_gateway", "rate_limited", "rate_20", "rate_90", "rate_none", "rate_abc", "error", "broken", "hang",
    ], (v) => (agencyMode = v));
  }
  if (url.pathname === "/__last-agency") return json(200, { count: agencyCount, body: lastAgency });
  if (url.pathname === "/api/v1/registrations/agencies" && req.method === "POST") {
    return readBody((parsed) => {
      agencyCount += 1;
      lastAgency = parsed;
      const fail = (fields) => json(400, envelope("validation_error", "Some fields are invalid.", fields));
      if (agencyMode === "accepted" || agencyMode === "existing") return json(202, { status: "check_your_email" });
      if (agencyMode === "ok_200") return json(200, { status: "check_your_email" });
      if (agencyMode === "email_sentence") return fail({ email: ["This address is already registered."] });
      if (agencyMode === "fields") {
        return fail({
          agency_name: ["invalid_name"],
          email: ["invalid_email"],
          phone: ["invalid_phone"],
          office_address: ["invalid_address"],
          city_id: ["invalid"],
          password: ["password_too_short", "password_too_common"],
        });
      }
      if (agencyMode === "required") {
        const required = ["required"];
        return fail({ agency_name: required, email: required, phone: required, office_address: required, city_id: required, password: required });
      }
      if (agencyMode === "sentences") return fail({ agency_name: ["Enter a valid agency name."], phone: ["mystery_code"] });
      if (agencyMode === "invalid_city") return fail({ city_id: ["invalid_city"] });
      if (agencyMode === "mixed") return fail({ email: ["invalid_email"], role: ["Unknown field."], non_field_errors: ["unknown_field"] });
      if (agencyMode === "non_field") return fail({ non_field_errors: ["Unexpected field."] });
      if (agencyMode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (agencyMode === "bad_json") {
        res.writeHead(400, { "content-type": "text/plain" });
        return res.end("not json");
      }
      if (agencyMode === "signed_in") return json(403, envelope("forbidden", "Forbidden."));
      if (agencyMode === "bad_gateway") {
        res.writeHead(502, { "content-type": "text/html" });
        return res.end("<html><body>Bad gateway</body></html>");
      }
      if (agencyMode.startsWith("rate_")) {
        const retry = { rate_limited: "1800", rate_20: "20", rate_90: "90", rate_abc: "soon" }[agencyMode];
        res.writeHead(429, { "content-type": "application/json", ...(retry ? { "retry-after": retry } : {}) });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      return serverFailure(agencyMode);
    });
  }
  if (url.pathname === "/__ping") return json(200, {});
  if (url.pathname === "/__mode") {
    const value = url.searchParams.get("value") ?? "up";
    if (!["up", "down", "broken", "hang"].includes(value)) return json(400, { error: "unknown mode" });
    mode = value;
    return json(200, { mode });
  }
  if (url.pathname === "/__reset") {
    mode = "up";
    quotaPolicy = quotaRows();
    quotaMode = "ok";
    quotaStats = { policyGets: 0, usageGets: 0, puts: [] };
    adminAccount = adminAccountRow();
    accountsMode = "ok";
    accountsPosts = [];
    suspensionReason = SUSPENSION_REASON;
    lastCookie = "";
    registrationMode = "accepted";
    lastRegistration = null;
    registrationCount = 0;
    confirmMode = "ok";
    confirmCount = 0;
    lastConfirm = null;
    resendMode = "accepted";
    resendCount = 0;
    lastResend = null;
    signInMode = "ok";
    meMode = "up";
    signOutMode = "ok";
    liveSession = false;
    sessionAdmin = false;
    adminSignInMode = "ok";
    adminMeMode = "up";
    adminSignInCount = adminMeCount = 0;
    lastAdminSignIn = lastAdminSignInToken = null;
    csrfSeed = 0;
    csrfFetches = signInCount = signOutCount = meCount = unsafeCount = 0;
    lastSignIn = lastSignInToken = lastSignOutToken = null;
    csrfOnceSpent = false;
    csrfMode = "ok";
    forgotMode = "accepted";
    forgotCount = 0;
    lastForgot = null;
    resetMode = "ok";
    resetCount = 0;
    lastReset = null;
    changeMode = "ok";
    changeCount = 0;
    lastChange = lastChangeToken = null;
    agencyMode = "accepted";
    agencyCount = 0;
    lastAgency = null;
    wireMode = "sentences";
    citiesMode = "ok";
    citiesCount = 0;
    localitiesMode = "ok";
    localitiesCount = 0;
    localitiesAnswered = 0;
    localityCityIds = [];
    amenitiesMode = "ok";
    amenitiesCount = 0;
    profile = { ...PROFILE_START };
    profileMode = profilePatchMode = emailChangeMode = emailConfirmMode = "ok";
    profileGets = profilePatchCount = emailChangeCount = emailConfirmCount = 0;
    agencyProfile = { ...AGENCY_PROFILE_START };
    agencyProfileMode = agencyProfilePatchMode = "ok";
    agencyProfileGets = agencyProfilePatchCount = 0;
    lastAgencyProfilePatch = lastAgencyProfilePatchToken = null;
    lastProfilePatch = lastProfilePatchToken = lastEmailChange = lastEmailChangeToken = lastEmailConfirm = null;
    notifications = NOTIFICATION_PRESETS.default();
    notificationsMode = notificationReadMode = notificationReadAllMode = unreadCountMode = "ok";
    notificationsGets = notificationReadCount = notificationReadAllCount = unreadCountGets = 0;
    notificationQueries = [];
    allowanceMode = "ok";
    allowanceGets = 0;
    publishMode = "ok";
    publishUsed = {};
    publishRecords = new Map();
    publishAttempts = [];
    publishLostSpent = publishReuseSpent = false;
    heldPublishAnswers = [];
    accountVariant = "1";
    cacheable = false;
    lastNotificationReadId = lastNotificationReadToken = lastNotificationReadAllToken = null;
    listings = LISTING_PRESETS.empty();
    taxonomyName = "default";
    fieldsName = "default";
    patchMode = "ok";
    patchCount = 0;
    previewMode = deleteMode = "ok";
    previewGets = 0;
    lastPreviewId = null;
    previewIds = [];
    listingDeletes = [];
    listingDeleteTokens = [];
    for (const answer of heldDeleteAnswers) answer();
    heldDeleteAnswers = [];
    patchBodies = [];
    patchTokens = [];
    patchLostSpent = false;
    imageMode = imageOrderMode = imageDeleteMode = imageFileMode = imageWireMode = "ok";
    imageSeq = 100;
    imageLostSpent = false;
    imageAttempts = 0;
    heldUploadAnswers = [];
    imageUploads = [];
    imageOrderBodies = [];
    imageDeletes = [];
    imageFileGets = imageFileHeads = 0;
    imageTokens = [];
    profileImages = { individual: null, agency: null };
    profileImageMode = profileImageDeleteMode = profileImageFileMode = profileImageWireMode = "ok";
    logoMode = "active";
    profileImageAttempts = profileImagePuts = profileImageFileGets = profileImageFileHeads = 0;
    profileImageUploads = [];
    profileImageDeletes = [];
    profileImageTokens = [];
    profileImageLostSpent = false;
    profileImageAborted = 0;
    logoRequests = [];
    for (const answer of heldImageAnswers) answer();
    heldImageAnswers = [];
    for (const read of heldProfileReads) read.res.end(read.body);
    heldProfileReads = [];
    countsMode = statusMode = "ok";
    countsGets = 0;
    statusAttempts = [];
    statusLostSpent = false;
    correctionMode = "ok";
    correctionAttempts = [];
    correctionGets = 0;
    for (const answer of heldCorrectionAnswers) answer();
    heldCorrectionAnswers = [];
    for (const answer of heldStatusAnswers) answer();
    heldStatusAnswers = [];
    registryMode = listingsMode = createMode = detailMode = "ok";
    registryGets = registryNotModified = listingsGets = createCount = detailGets = 0;
    lastRegistryConditional = lastCreate = lastCreateToken = lastDetailId = null;
    listingQueries = [];
    while (pending.length) pending.pop().end();
    return json(200, { mode });
  }
  if (url.pathname === "/__registration-mode") {
    const value = url.searchParams.get("value") ?? "accepted";
    if (![
      "accepted", "ok_200", "fields", "required", "empty_fields", "bad_json", "mixed", "forbidden", "bad_gateway",
      "non_field", "rate_limited", "rate_20", "rate_90", "rate_none", "rate_abc", "error", "broken", "hang",
    ].includes(value)) {
      return json(400, { error: "unknown mode" });
    }
    registrationMode = value;
    return json(200, { registrationMode });
  }
  if (url.pathname === "/__last-registration") return json(200, { count: registrationCount, body: lastRegistration });
  if (url.pathname === "/api/v1/registrations/individuals" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      registrationCount += 1;
      try {
        lastRegistration = JSON.parse(raw);
      } catch {
        lastRegistration = null;
      }
      const envelope = (code, message, fields = {}) => ({ error: { code, message, fields: wireFields(fields), request_id: "stub" } });
      if (registrationMode === "accepted") return json(202, { status: "check_your_email" });
      if (registrationMode === "ok_200") return json(200, { status: "check_your_email" });
      if (registrationMode === "fields") {
        return json(
          400,
          envelope("validation_error", "Some fields are invalid.", {
            full_name: ["Enter your full name using letters only."],
            email: ["Enter a valid email address."],
            password: ["Choose a password that is at least 8 characters long."],
            phone: ["Enter a valid Pakistani mobile or international number."],
          }),
        );
      }
      if (registrationMode === "required") {
        const message = ["This field is required."];
        return json(400, envelope("validation_error", "Some fields are invalid.", { full_name: message, email: message, password: message, phone: message }));
      }
      if (registrationMode === "empty_fields") return json(400, envelope("bad_request", "The server rejected this request."));
      if (registrationMode === "bad_json") {
        res.writeHead(400, { "content-type": "text/plain" });
        return res.end("not json");
      }
      if (registrationMode === "mixed") {
        return json(400, envelope("validation_error", "Invalid.", { email: ["Enter a valid email address."], role: ["Unknown field."], non_field_errors: ["Unexpected field."] }));
      }
      if (registrationMode === "forbidden") return json(403, envelope("forbidden", "Forbidden."));
      if (registrationMode === "bad_gateway") {
        res.writeHead(502, { "content-type": "text/html" });
        return res.end("<html><body>Bad gateway</body></html>");
      }
      if (registrationMode.startsWith("rate_") && registrationMode !== "rate_limited") {
        const retry = { rate_20: "20", rate_90: "90", rate_abc: "soon" }[registrationMode];
        res.writeHead(429, { "content-type": "application/json", ...(retry ? { "retry-after": retry } : {}) });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      if (registrationMode === "non_field") {
        return json(400, envelope("validation_error", "Invalid request.", { non_field_errors: ["Unexpected field."] }));
      }
      if (registrationMode === "rate_limited") {
        res.writeHead(429, { "content-type": "application/json", "retry-after": "1800" });
        return res.end(JSON.stringify(envelope("throttled", "Too many requests.")));
      }
      if (registrationMode === "error") return json(500, envelope("server_error", "Internal detail that must not show."));
      if (registrationMode === "broken") return req.socket.destroy();
      // hang: keep the response open; /__reset or server close ends it
      pending.push(res);
    });
    return;
  }
  if (url.pathname === "/__last-cookie") return json(200, { cookie: lastCookie });
  if (url.pathname === "/api/v1/health") {
    lastCookie = req.headers.cookie ?? "";
    if (mode === "down") return json(503, { status: "unavailable" });
    if (mode === "broken") return req.socket.destroy();
    if (mode === "hang") return; // accept the connection, never answer
    return json(200, { status: "ok" });
  }
  json(404, { error: { code: "not_found", message: "Not found.", fields: {}, request_id: "stub" } });
})
  .on("close", () => {
    while (pending.length) pending.pop().end();
  })
  .listen(Number(process.env.STUB_PORT ?? 4010), "127.0.0.1");
