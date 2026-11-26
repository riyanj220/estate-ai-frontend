/**
 * GENERATED FILE - DO NOT EDIT.
 * Generated from src/api/openapi.yaml by scripts/sync-api.mjs (npm run api:sync).
 */

export interface paths {
    "/api/v1/admin-session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in as an administrator
         * @description The only door to an administrator session; the ordinary sign-in refuses administrator accounts. Needs `X-CSRFToken`. Anything but an active administrator with the right password (wrong password, unknown email, an Individual or Agency account, a disabled administrator, a throttled attempt) answers the same `401 invalid_credentials`; the throttle is silent, never 429. Administrator sessions expire after 30 idle minutes or 8 hours.
         */
        post: operations["admin_sign_in"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/accounts/{account_id}/reactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reactivate a suspended account
         * @description `reason` is 5 to 500 characters after trimming, one line, without contact details, else `400 validation_error`. An unknown id or an administrator account is `404 not_found`. An account that is not Suspended is `409 conflict`. The state becomes `active`, or `email_unverified` if the email was never verified. Needs `X-CSRFToken`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["reactivate_admin_account"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/accounts/{account_id}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suspend an account
         * @description `reason` is 5 to 500 characters after trimming, one line, without contact details, else `400 validation_error`. An unknown id or an administrator account is `404 not_found`. A Suspended or Deactivated account is `409 conflict`. The account sees the reason; its Listings leave public view. Needs `X-CSRFToken`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["suspend_admin_account"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/accounts/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Look up an account by email, with a reason
         * @description A reasoned private read: `reason` (10 to 300 characters, one line, no contact details) is recorded in the audit trail. Only Individual and Agency accounts; an unknown or administrator address is `404 not_found`. Needs `X-CSRFToken`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["lookup_admin_account"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in administrator
         * @description Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`, so the admin area is not confirmed to them.
         */
        get: operations["get_admin_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/quota-policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The monthly publication limits in force now
         * @description Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["get_admin_quota_policy"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/quota-policy/{account_type}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Change one account type's monthly publication limit
         * @description Needs `X-CSRFToken`. Applies to later publication attempts only. `monthly_limit` is a whole number from 0 to 1000, else `400 validation_error`; the current limit again changes nothing (`200`, the unchanged row). An account type other than `individual` or `agency` is `404 not_found`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        put: operations["set_admin_quota_limit"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/quota-usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * This month's publication usage by account
         * @description Accounts with at least one counted publication in the Asia/Karachi calendar month, newest usage first, with cursor pagination (`next` link, `previous` is always null; 20 per page, `page_size` up to 50, an invalid `page_size` falls back to the default). A bad cursor, or one from an earlier month, is `validation_error` (`fields.cursor`). Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["list_admin_quota_usage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agencies/{agency_id}/logo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * An Agency's public logo
         * @description `agency_id` is the public Agency profile id (never the account id), as given in `logo_url`. Served to anyone, a Visitor included, ONLY while the Agency account is Active; a Suspended, Deactivated or Email-unverified Agency, an Agency without a logo, an unknown id and a malformed id all get the identical `404 not_found`. The `200` carries the stored `Content-Type`, `Content-Length`, `Cache-Control: public, max-age=60` (a suspended Agency's logo may stay in a cache for up to a minute), `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` and `Content-Security-Policy: default-src 'none'; sandbox`; no cookie is set and nothing varies by cookie. `HEAD` answers the same headers without a body. `Range` and `Accept` are ignored; there is no `ETag`.
         */
        get: operations["get_agency_logo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fetch a CSRF token
         * @description Sets the (HttpOnly) CSRF cookie and returns the matching token, which the client sends back as `X-CSRFToken` on sign-in and sign-out. Never cached.
         */
        get: operations["get_csrf_token"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/email-changes/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm an email-change link
         * @description POST, not GET, so link prefetchers cannot consume the single-use token. Public: no session or CSRF token needed, so the link works in any browser. Errors: `link_invalid` (also when the address was taken meanwhile), `link_expired` (410), `link_used` (409). On success the sign-in address is replaced and verified; sessions stay open. Limited per client (429 with `Retry-After`).
         */
        post: operations["confirm_email_change"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/email-verification-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Request a new verification link
         * @description Always answers the same 202 whether or not the address is registered; the limit applies to every request alike.
         */
        post: operations["request_email_verification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/email-verifications/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm an email verification link
         * @description POST, not GET, so link prefetchers cannot consume the single-use token. Errors: `link_invalid`, `link_expired` (410), `link_used` (409).
         */
        post: operations["confirm_email_verification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness plus database reachability
         * @description Liveness plus database reachability. Never reveals connection details.
         */
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start a Draft
         * @description Needs `X-CSRFToken`. Body: `purpose`, `category` and `subtype`; any other field (`owner_account_id`, `status`, `revision`) is `validation_error` (`unknown_field`). Failing fields are reported at once (`required`, `invalid`, `invalid_choice`, `subtype_not_in_category`). Only Active and Email-unverified Individual and Agency accounts may start one (`forbidden` otherwise, administrators included). The Draft belongs to the account. At 20 open Drafts the answer is `429 throttled` without `Retry-After` (a cap clears when a Draft is removed). Never cached.
         */
        post: operations["create_listing_draft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings/{listing_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One of the signed-in account's own Listings
         * @description Owner only. Another account's, an unknown and a malformed id are all `404 not_found`, so existence is never confirmed. Never cached.
         */
        get: operations["get_listing"];
        put?: never;
        post?: never;
        /**
         * Delete one of the signed-in account's own Drafts
         * @description Needs `X-CSRFToken`. Deletes the Draft and everything of it: its images (the stored files go and the bytes are given back to the account's storage), its fields, private address and revision history. This cannot be undone. `204` has no body. Only a `draft` can be deleted here: any other status is `409 conflict` and nothing changes. Another account's, an administrator's, an unknown, a malformed and an already deleted id are all `404 not_found`; an account that may not edit (Suspended, Deactivated) is `403 forbidden`. Never cached.
         */
        delete: operations["delete_listing"];
        options?: never;
        head?: never;
        /**
         * Edit one of the signed-in account's own Listings
         * @description Needs `X-CSRFToken`. Body: `{base_revision, fields}` and nothing else (any other key, `origin` and `confirmed` included, is `validation_error` `unknown_field`). `fields` holds registry ids: `title`, `description`, `asking_price` (a decimal string in PKR, at most two decimals), `price_basis`, `rental_period`, `area_value` (a decimal string, at most four decimals, above zero; never a JSON number), `area_unit` and `marla_basis` (`"225"`, `"250"` or `"272.25"` square feet per marla, only while the unit is marla or kanal; changing the unit away clears it) and the House and Apartment details (`bedrooms`, `bathrooms`, `construction_year`, `condition`, `furnishing`, `parking_spaces`, `occupancy_status`, `covered_area_sqft` (a decimal string in square feet), the House set `total_floors`, `kitchens`, `construction_status`, room counts and `basement`, and the Apartment set `floor_number`, `building_floors`, `lift`, `backup_electricity`, `building_security`, `balcony_or_terrace`, `building_lobby`, `intercom` and `maintenance_charges` (PKR per month)), the details Shops and Offices share with them (`condition`, `furnishing`, `parking_spaces`, `occupancy_status`, floors, `lift`, `building_security`, `building_lobby`, `maintenance_charges`), the utilities `electricity`, `water` and `gas`, the Plot and Plot File details (`plot_width`, `plot_depth` and `road_width_ft` as decimal strings in feet with at most two decimals, `possession_status`, `corner_plot`, `balloting_status`, `sewerage`, `development_status`, `approval_authority`, `park_facing`, `main_boulevard`, `boundary_wall`, `orientation`, `plot_file_status`) and the Shop and Office details (`business_use`, `frontage_ft`, `road_access`, `ceiling_height_ft`, `power_load_kw`, `three_phase_electricity`, `conference_rooms`, `business_centre_facilities`) and the sale and rent terms (`price_negotiable` for both; sale only `possession_availability`; rent only `security_deposit` and `advance_rent` as decimal strings in PKR with at most two decimals, `availability_date` as text `YYYY-MM-DD` between 2000-01-01 and 2100-12-31, `minimum_lease_months`, `notice_period_days`, the four `utility_*_included` answers, `pets_allowed` and `occupant_restrictions`; the rent terms are `not_applicable` on a sale Draft and the other way round; a rental period is never assumed) and the location: `city` and `locality` as uuid text of an active city and one of its localities (`/api/v1/reference/cities` and `/api/v1/reference/cities/{city_id}/localities`; a locality of another city is `locality_not_in_city`, a locality without a city `invalid`; changing or clearing `city` clears the stored `locality` in the same write), the public location text `society`, `phase`, `sector` and `block` (up to 60 characters, no phone numbers or email addresses) and the PRIVATE address `street` (up to 120 characters), `house_number` (up to 30) and `latitude` and `longitude` (decimal strings with at most six decimals, -90 to 90 and -180 to 180, both or neither; `out_of_range` otherwise): the private fields are returned only to the owner and never appear in any public response. `amenities` is the map `{code: "present" | "none"}` of catalogue codes (`/api/v1/reference/amenities`): the sent map replaces the whole stored one, `null` or `{}` clears it, a code that is left out is unanswered (never `none`), an unknown or inactive code, another state, a non-object or more than 40 entries is `invalid`; nearby facilities are seller-declared (no distance, no verification). Installment, payment type, down payment and title or approval document terms are not supported yet (`unknown_field`). Possession, balloting, development, approval and plot file status are seller-declared (registry flag `seller_declared`): the owner's claim, never verified by EstateAI. A Plot File allows only `file_only` for `possession_status` and the other Subtypes refuse it (`invalid_choice`). Ids the registry does not define (for example installment, down payment, title document or mortgage attributes) are `unknown_field`. Counts are JSON integers and yes/no answers are JSON `true`/`false`, never text; unanswered is `null`, never 0 or false. The registry says which apply to which Subtype (`not_applicable` otherwise); `null` clears a field. `area_sqft` is computed by the server and is `not_editable` as input. Saving never needs complete data. Every saved field is recorded as `manual` and confirmed; the client never chooses provenance. A `base_revision` that is not the current `revision` is `409 stale_revision` with the current Listing under `current` and nothing written (a retried PATCH after it succeeded is also a 409: reload). An edit that changes nothing is `200` and keeps the revision. `400` carries codes keyed by registry field id (`invalid`, `too_short`, `too_long`, `invalid_price`, `invalid_area`, `invalid_range`, `invalid_floor`, `invalid_date`, `invalid_choice`, `not_applicable`, `invalid_measure`, `out_of_range`, `locality_not_in_city`, `contains_contact_details`, `not_editable` (also an identity field of a `published` Listing: `city`, `locality`, `area_value` and `area_unit` are locked while it is published, editable as a Draft or Archived; `locality` and the area may be corrected once, see `/correction`; `marla_basis` stays editable); unknown ids are `unknown_field` under `non_field_errors`) and never echoes a value. Another account's, an unknown or a malformed id is `404 not_found`; an account that may not edit (Suspended, Deactivated) is `403 forbidden`, and so is a `sold`, `rented` or `removed` Listing or a restricted one (view only). A `draft`, `published` and `archived` Listing may be edited. An edit of a `published` Listing must leave it complete (the same rules as publication): otherwise `400 validation_error` names every missing or invalid item at once (clearing the title or a price, a locality outside the city) and nothing is written; an edit of an `archived` one is judged like a Draft edit. These edits use no publication and write no event. Never cached.
         */
        patch: operations["update_listing"];
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/correction": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Whether one of the signed-in account's own Listings may still be corrected
         * @description Owner only. `available` is true only for a `published`, not restricted Listing of an account that may edit it, whose last counted publication is less than 24 hours old and not yet used for a correction; `expires_at` then says when the window closes (+05:00). In every other case `available` is false and `expires_at` null. Another account's, an administrator's, an unknown and a malformed id are `404 not_found`; a Visitor gets `401`. Reads only. Never cached.
         */
        get: operations["get_listing_correction"];
        put?: never;
        /**
         * Correct the locality and area of a recently published Listing, once
         * @description Needs `X-CSRFToken`. Body: `{base_revision, fields}` and nothing else; `fields` holds only what changes among `locality`, `area_value`, `area_unit` and `marla_basis` (any other id, `city`, `category`, `subtype` and `purpose` included, is `400 validation_error` and nothing is written). It can be done ONCE per counted publication, within 24 hours of it (exactly 24 hours is closed); it uses no publication, and a later republication in the same Karachi month with the corrected details unchanged is free. Order of refusals: another account's, an administrator's, an unknown and a malformed id are `404 not_found`; a Visitor is `401`; a `base_revision` that is not the current `revision` is `409 stale_revision` with the Listing under `current`; a Listing that is not `published` is `409 conflict`; a restricted Listing, a Suspended or a Deactivated account is `403 forbidden`; a closed or used window is `409 correction_unavailable`. Then the values are judged as for any edit of a published Listing, all at once (`400`, codes keyed by field id, for example `locality_not_in_city`, `invalid_area`, `required`, `not_applicable`). A `marla_basis` that differs while neither `area_value` nor `area_unit` does is `not_editable` (change it with an ordinary edit). A request that changes nothing is `400` with `non_field_errors` (`no_change`). A refused request does not use up the correction. Never cached.
         */
        post: operations["correct_listing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add an image to one of the signed-in account's own editable Listings
         * @description Needs `X-CSRFToken` and a `multipart/form-data` body with exactly one part, `file` (any other part, a non-file `file` or more than one file is `validation_error`). The request body may be at most 6 MB and the image at most 5 MB (5,242,880 bytes). The file name and declared content type are ignored and never stored: the type is decided from the decoded image (JPEG, PNG or WebP only; animated images, GIF, SVG, TIFF, BMP, HEIC and the like are refused). The image is decoded, rotated by its EXIF orientation, stripped of ALL metadata (EXIF, GPS, XMP, comments, colour profile) and encoded again, with its long side at most 2,048 px; the response describes that stored file. `400 validation_error` carries a code under `fields.file`: `too_large`, `unsupported_type`, `too_large_dimensions` (above 10,000 px on a side or 40 megapixels), `too_small` (below 200 x 200), `invalid_image`, `required` or `invalid`. Another account's, an unknown or a malformed Listing is `404 not_found`; an account that may not edit, or a Listing that is not editable (sold, rented, removed or restricted), is `403 forbidden`. `409` carries `too_many_images` (a Listing holds at most 10) or `storage_cap_exceeded` (200 MB for an Individual, 1 GB for an Agency, counted on the stored size). `429` is the upload limit (30 per hour per account) with `Retry-After`. `503 busy` (with `Retry-After`) means image processing is at capacity or too slow: retry. The Listing `revision` rises by one, so a concurrent editor gets `409 stale_revision`. Never cached. The first image of a Listing becomes its cover; a later upload never changes it.
         */
        post: operations["upload_listing_image"];
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Reorder the images of an own Draft and/or choose its cover
         * @description Needs `X-CSRFToken`. Body: `{base_revision, order, cover_id?}` and nothing else (any other key is `validation_error` `unknown_field`). `order` is the full list of the Listing's image ids in the wanted order, each exactly once; the positions become 0..n-1 in that order. `cover_id` (optional; null or omitted keeps the cover) must be one of the Listing's images. The Listing always has exactly one cover while it has images. `400 validation_error` carries `invalid` under `fields.order` (a missing, duplicate, unknown or another Listing's id, or not a list of ids), `fields.cover_id` or `fields.base_revision` (`required` or `invalid`). A `base_revision` that is not the current `revision` is `409 stale_revision` with the current Listing under `current` and nothing written (a replay is also a 409: reload). A request that changes nothing is `200` and keeps the revision; otherwise the revision rises by one. Another account's, an unknown or a malformed Listing is `404 not_found`; an account that may not edit, or a Listing that is not editable (sold, rented, removed or restricted), is `403 forbidden`. The body may be at most 64 KiB (`400` with `fields.order` `invalid`) and the `image_order` limit (120 per hour per account) applies: `429` with `Retry-After`. Files are never touched. Never cached.
         */
        patch: operations["set_listing_image_order"];
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/images/{image_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove an image from one of the signed-in account's own Drafts
         * @description Needs `X-CSRFToken`. Deletes the image and its stored file, gives its bytes back to the account's storage, renumbers the other images 0..n-1 (removing the cover makes the image with the lowest remaining position the cover) and raises the Listing `revision` by one. `204` has no body. Another account's, an unknown or an already removed image or Listing is `404 not_found`; an account that may not edit, or a Listing that is not editable (sold, rented, removed or restricted), is `403 forbidden`. A `published` Listing can never lose its last image: `400 validation_error` with `images_required` under `fields.images`, nothing changed. Images of a Draft, Published or Archived Listing may be removed. Never cached.
         */
        delete: operations["delete_listing_image"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/images/{image_id}/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The bytes of one image of a Listing the caller may see
         * @description The media endpoint: the only place an image is served, decided at request time by the single visibility policy. An image of a public Listing (Published, not restricted, owner Active) goes to anyone, a Visitor and an administrator included, with `Cache-Control: public, max-age=60` (so it may stay in a cache for up to a minute after the Listing stops being public), no cookie and nothing varying by cookie, whatever cookies the request carries. An image of any other Listing (a Draft, a restricted one, one whose owner is Suspended or Deactivated) goes only to the owning account (Suspended and Email-unverified owners included, a Deactivated one not) with `Cache-Control: private, no-store`. Anyone else (another account, an administrator, a Visitor), an unknown or malformed id and another Listing's image get the same `404 not_found` (a Visitor gets 404, never 401). The body is the stored, re-encoded image with its stored `Content-Type` (`image/jpeg`, `image/png` or `image/webp`), `Content-Length`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` (no file name) and `Content-Security-Policy: default-src 'none'; sandbox`. `HEAD` answers the same headers without a body. `Range` is ignored (always `200`, the whole file) and there is no `ETag`. `Accept` is ignored.
         */
        get: operations["get_listing_image_file"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Preview what the public will see of one of the signed-in account's own Listings
         * @description Owner only, for the account's own Listing in any status (draft, published, archived, sold, rented, removed). The body is the public projection (the same fields a visitor would get, built by the same function): never a private address, coordinates, a phone number, the revision, the provenance or the status. `media` lists the images in the public shape; their `url` is the media endpoint, which serves a Draft's image to its owner only. `estimate` is always `null` until the valuation feature exists. Another account's, an administrator's, an unknown and a malformed id are all `404 not_found`. A Visitor gets `401`. Opening the preview counts as opening the Draft (it postpones the idle-Draft notice). Never cached.
         */
        get: operations["preview_listing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publish one of the signed-in account's own Drafts
         * @description Needs `X-CSRFToken` and an `Idempotency-Key` header (1 to 128 characters from `A-Za-z0-9._:-`; a missing or malformed one is `400 validation_error` under `fields.idempotency_key`). Body: `{base_revision}` and nothing else. Publishing is immediate (no approval) and all-or-nothing: it uses one of the owner's monthly publications and makes the Listing public if its owner is Active. The same key with the same body within 24 hours returns the Listing as it is now with no second publication; the same key with another body is `422 idempotency_key_reused`. Refusals, in order: another account's, an administrator's, an unknown and a malformed id are `404 not_found`; a Visitor is `401`; a `base_revision` that is not the current `revision` is `409 stale_revision` with the Listing under `current`; a Listing that is not a `draft` is `409 conflict`; a restricted Listing is `403 forbidden`; an Email-unverified account is `403 email_not_verified` and a Suspended one `403 publishing_unavailable`; every missing or invalid required item is `400 validation_error`, all at once, keyed by registry field id (`required` and the field's own codes), `images` (`images_required`: at least one image) and a field of class `private` or of the quota identity that the Assistant filled in and the owner has not confirmed (`confirm_required`); a used-up allowance is `409 quota_exhausted` with the caller's own `limit`, `used` and `resets_at` under `details`. A refused attempt consumes nothing. Never cached.
         */
        post: operations["publish_listing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/republish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Republish one of the signed-in account's own Archived Listings
         * @description Needs `X-CSRFToken` and an `Idempotency-Key` header (same rules as publishing). Body: `{base_revision}` and nothing else. The Listing becomes `published` and public again if its owner is Active, after the same complete validation as publishing (every stored value is judged again, all problems at once). `publication_kind` says how it was recorded: `republish_free` (no publication used) only when the Listing's last counted publication is from the same Karachi calendar month as now and none of the purpose, category, subtype, city, locality, area value or area unit has changed; otherwise `republish_counted`, which uses one monthly publication. The same key with the same body within 24 hours returns the Listing as it is now with the original `publication_kind` and no second publication; the same key with another body is `422 idempotency_key_reused`. Refusals, in order: another account's, an administrator's, an unknown and a malformed id are `404 not_found`; a Visitor is `401`; a `base_revision` that is not the current `revision` is `409 stale_revision` with the Listing under `current`; a Listing that is not `archived` (a Sold or Rented one must be archived first; a Removed one never returns) is `409 conflict`; a restricted Listing is `403 forbidden`; an Email-unverified account is `403 email_not_verified` and a Suspended one `403 publishing_unavailable`; every missing or invalid item is `400 validation_error`, all at once, as for publishing; a counted republication with no allowance left is `409 quota_exhausted` with the caller's own `limit`, `used` and `resets_at` under `details`. A refused attempt consumes nothing. Never cached.
         */
        post: operations["republish_listing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/listings/{listing_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Archive, mark sold or mark rented one of the signed-in account's own Listings
         * @description Needs `X-CSRFToken`. Body: `{base_revision, status}` and nothing else; `status` is `archived`, `sold` or `rented` (anything else is `400 validation_error`, `fields.status`). Allowed moves: `published` to `archived`, `sold` or `rented`; `sold` and `rented` to `archived`. Every other move (from a `draft`, an `archived` or the same status) is `409 conflict` and nothing is written; a Listing never returns to `published` here. `sold` is only for a Listing with purpose `sale` and `rented` only for purpose `rent` (`409 conflict` otherwise). No publication is used and no key is needed. `200` is the updated Listing; it is no longer public. A Suspended owner may only archive (`403 forbidden` for `sold` and `rented`); a restricted Listing may only be archived by its owner (`403 forbidden` otherwise) and a `removed` one cannot be changed (`403 forbidden`). A `base_revision` that is not the current `revision` is `409 stale_revision` with the Listing under `current`. Another account's, an administrator's, an unknown and a malformed id are `404 not_found`; a Visitor gets `401`. Never cached.
         */
        post: operations["change_listing_status"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The signed-in actor */
        get: operations["get_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/agency-profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Agency's business profile
         * @description Agency accounts only (any other type is `403 forbidden`). The business phone and office address are private and appear only in this route's answers, to their owner. Name, description and city are the public-class fields. Never cached.
         */
        get: operations["get_agency_profile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change the signed-in Agency's business details
         * @description Needs `X-CSRFToken`. Only `agency_name`, `description`, `city_id`, `business_phone` and `office_address` are accepted, at least one; any other field (the email and verification status included) is `validation_error` (`unknown_field`). Name, phone, address and city stay mandatory (blank or null is `required`); a blank or null description clears it. A description with phone numbers, email addresses or street addresses is `fields.description = contains_contact_details`. All failing fields are reported at once. An unchanged submission succeeds and records nothing.
         */
        patch: operations["update_agency_profile"];
        trace?: never;
    };
    "/api/v1/me/agency-profile/image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Upload or replace the signed-in Agency's logo
         * @description Agency accounts only. The logo is then public through `GET /api/v1/agencies/{agency_id}/logo`, but only while the Agency account is Active. Needs `X-CSRFToken` and a `multipart/form-data` body with exactly one part, `file` (any other part, a non-file `file` or more than one file is `validation_error`). The request body may be at most 6 MB and the image at most 5 MB (5,242,880 bytes). Same pipeline and `fields.file` codes as the Listing image upload (`too_large`, `unsupported_type`, `too_large_dimensions`, `too_small`, `invalid_image`, `required`, `invalid`): the file name and declared type are ignored and never stored, the image is decoded, stripped of ALL metadata and encoded again (long side at most 2,048 px). Uploading again replaces the previous image, whose file and storage bytes are released in the same step. The account type is checked before the body (`403 forbidden` for the other type and administrators, `401` for a Visitor); a Deactivated account has no session. The account state follows the profile update (Active, Email-unverified and Suspended may change it). `409 storage_cap_exceeded` (counted on the stored size, replacement counted at its net size), `429` is the upload limit (10 per hour per account) with `Retry-After`, `503 busy` (with `Retry-After`) means image processing is at capacity: retry. Never cached.
         */
        put: operations["put_agency_logo"];
        post?: never;
        /**
         * Remove the signed-in Agency's logo
         * @description Needs `X-CSRFToken`. Deletes the logo and its stored file and gives its bytes back to the account's storage. `204` has no body, also when there is no logo. Same account refusals as the upload. Never cached.
         */
        delete: operations["delete_agency_logo"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/agency-profile/image/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Agency's own logo
         * @description The bytes of the stored, re-encoded image with its stored `Content-Type` (`image/jpeg`, `image/png` or `image/webp`), `Content-Length`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` (no file name) and `Content-Security-Policy: default-src 'none'; sandbox`; no cookie is set. `HEAD` answers the same headers without a body. Only the owning account gets it (a Suspended or Email-unverified owner included, a Deactivated one not); everyone else (another account, the other account type, an administrator, a Visitor), an account without an image and a lost file get the same `404 not_found`. `Range` and `Accept` are ignored; there is no `ETag`.
         */
        get: operations["get_agency_logo_file"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/email-change": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ask to change the sign-in email
         * @description Needs `X-CSRFToken`; not available to administrators. A wrong current password is `validation_error` with `fields.current_password = incorrect` (shared with the password change: after repeated failures the same answer returns without checking; never 429). A malformed address is `fields.new_email = invalid_email`. Otherwise ALWAYS the same `202`, whether the address is free, registered, the current one or unusable. A single-use link goes only to a free new address, after commit; the current address keeps signing in until it is used. Every accepted request also sends a heads-up to the current address. Only requests with the right password count against the per-account hourly limit (429 with `Retry-After`).
         */
        post: operations["request_email_change"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/listings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in account's own Listings, newest first
         * @description Own Listings only, newest first, with cursor pagination (`next` link, `previous` is always null; 20 per page, `page_size` up to 50, an invalid `page_size` falls back to the default). `status` filters by one of the six statuses. A bad `cursor` or `status` is `validation_error` (`fields.cursor`, `fields.status`). Never cached.
         */
        get: operations["list_my_listings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/listings/counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * How many Listings the signed-in account has in each status
         * @description The caller's own Listings only, one count per status (every status is present, 0 when none): `draft`, `published`, `archived`, `sold`, `rented`, `removed`. Same rules as the list: a Visitor gets `401`, an administrator or a Deactivated account `403 forbidden`, a Suspended owner may read it. Never cached.
         */
        get: operations["get_my_listing_counts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change the signed-in account's password
         * @description Needs `X-CSRFToken`. A wrong current password is `validation_error` with `fields.current_password = incorrect` (after repeated failures the same answer is returned without checking; never 429). Ends every other session; the current one stays signed in.
         */
        post: operations["change_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Individual's profile
         * @description Individual accounts only (any other type is `403 forbidden`). The phone is private and appears only in this route's answers, to its owner. Never cached.
         */
        get: operations["get_profile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change the signed-in Individual's name and/or phone
         * @description Needs `X-CSRFToken`. Only `full_name` and `phone` are accepted, at least one; any other field (the email included) is `validation_error` (`unknown_field`). The phone stays mandatory: blank or null is `fields.phone = required`. All failing fields are reported at once. An unchanged submission succeeds and records nothing.
         */
        patch: operations["update_profile"];
        trace?: never;
    };
    "/api/v1/me/profile/image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Upload or replace the signed-in Individual's profile picture
         * @description Individual accounts only. Needs `X-CSRFToken` and a `multipart/form-data` body with exactly one part, `file` (any other part, a non-file `file` or more than one file is `validation_error`). The request body may be at most 6 MB and the image at most 5 MB (5,242,880 bytes). Same pipeline and `fields.file` codes as the Listing image upload (`too_large`, `unsupported_type`, `too_large_dimensions`, `too_small`, `invalid_image`, `required`, `invalid`): the file name and declared type are ignored and never stored, the image is decoded, stripped of ALL metadata and encoded again (long side at most 2,048 px). Uploading again replaces the previous image, whose file and storage bytes are released in the same step. The account type is checked before the body (`403 forbidden` for the other type and administrators, `401` for a Visitor); a Deactivated account has no session. The account state follows the profile update (Active, Email-unverified and Suspended may change it). `409 storage_cap_exceeded` (counted on the stored size, replacement counted at its net size), `429` is the upload limit (10 per hour per account) with `Retry-After`, `503 busy` (with `Retry-After`) means image processing is at capacity: retry. Never cached.
         */
        put: operations["put_profile_image"];
        post?: never;
        /**
         * Remove the signed-in Individual's profile picture
         * @description Needs `X-CSRFToken`. Deletes the image and its stored file and gives its bytes back to the account's storage. `204` has no body, also when there is no picture (a repeat is harmless). Same account refusals as the upload. Never cached.
         */
        delete: operations["delete_profile_image"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/profile/image/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Individual's own profile picture
         * @description The bytes of the stored, re-encoded image with its stored `Content-Type` (`image/jpeg`, `image/png` or `image/webp`), `Content-Length`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` (no file name) and `Content-Security-Policy: default-src 'none'; sandbox`; no cookie is set. `HEAD` answers the same headers without a body. Only the owning account gets it (a Suspended or Email-unverified owner included, a Deactivated one not); everyone else (another account, the other account type, an administrator, a Visitor), an account without an image and a lost file get the same `404 not_found`. `Range` and `Accept` are ignored; there is no `ETag`. An Individual's picture has no public route.
         */
        get: operations["get_profile_image_file"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/publication-allowance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in owner's publication allowance this month
         * @description Individual and Agency accounts (Active, Email-unverified or Suspended). The month is the calendar month in Asia/Karachi; `period_start` and `resets_at` carry the +05:00 offset. `used` counts only this account's counted publications and can exceed `limit` after a later limit decrease, `remaining` never goes below 0. A Visitor and a Deactivated account (which has no session) get `unauthenticated` (401); an administrator gets `forbidden` (403). Never cached.
         */
        get: operations["get_my_publication_allowance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in account's notifications, newest first
         * @description Own notifications only, with cursor pagination (`next` and `previous` links, 20 per page by default, `page_size` up to 50; an invalid `page_size` falls back to the default). A bad `cursor` is `validation_error` (`fields.cursor`). `state` is `all` (default) or `unread`; anything else is `validation_error`. Never cached.
         */
        get: operations["list_notifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{notification_id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark one notification read
         * @description Needs `X-CSRFToken`. Idempotent: a second call keeps the first read time. Another account's, an unknown and a malformed id are all `404 not_found`.
         */
        post: operations["mark_notification_read"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark every unread notification read
         * @description Needs `X-CSRFToken`. Only the caller's own notifications change.
         */
        post: operations["mark_all_notifications_read"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/unread-count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * How many notifications are unread
         * @description Every answer of the view, errors included, is `no-store`.
         */
        get: operations["get_unread_notification_count"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/password-reset-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Request a password reset link
         * @description Always answers the same 202 whether or not the address is registered. The limit is per client and applies to every request alike (429 with `Retry-After`); a per-account cap is silent.
         */
        post: operations["request_password_reset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/password-resets/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Set a new password with a reset link
         * @description POST, not GET, so link prefetchers cannot consume the single-use token. Link errors: `link_invalid`, `link_expired` (410), `link_used` (409). A password the policy refuses is `validation_error` with `fields.password` set, only for a valid link, and does not use up the link. On success every session of the account ends. Limited per client (429 with `Retry-After`).
         */
        post: operations["confirm_password_reset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/filters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The filters of the public list
         * @description Public. Generated from the Field registry and the amenity catalogue: what `GET /api/v1/public/listings` accepts. `Cache-Control: public, max-age=60`.
         */
        get: operations["get_public_filters"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/listings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Browse and filter the published Listings
         * @description Public; the answer is the same for every caller. Only publicly visible Listings (published, not restricted, owner Active). Every filter given must hold; a Listing that has not answered an attribute never matches a filter on it. A `prefer_` parameter excludes nothing: it only ranks under `sort=relevance` (the default when one is given; otherwise `newest`). Prices are compared as stored, so give `purpose` to keep sale and rent apart. Area is in square feet. `GET /api/v1/public/filters` describes the parameters. `limit` is 1 to 50 (default 20); `next` is the link to the following page and carries an opaque `cursor`, valid only with the same filters and sort. An unknown, repeated or bad parameter is `400 validation_error` under its name in `fields`. `200` has `Cache-Control: public, max-age=60` and no cookie (so a Listing may stay in a cache for up to a minute after it stops being public); errors are `no-store`.
         */
        get: operations["list_public_listings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/listings/{listing_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One published Listing
         * @description Public; the answer is the same for every caller, the owner included. The public projection only: never a private address, coordinates, a phone number, the owner, the status, the revision or the provenance. `nearby` amenities are the seller's own declaration. A Listing that is not publicly visible, an unknown and a malformed id are the same `404 not_found`. `200` has `Cache-Control: public, max-age=60` and no cookie; errors are `no-store`.
         */
        get: operations["get_public_listing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reference/amenities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The amenity and nearby facility catalogue
         * @description Public. The active catalogue ordered by `kind` (`on_property`, `community`, `nearby`) and then by display order. `code` is the stable identifier a listing stores; `label` and `group` are for display. A `nearby` entry is the seller's own declaration: clients must label it "Seller-declared"; there is no distance and no verification. Unpaginated: the list is small and bounded.
         */
        get: operations["list_amenities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reference/cities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Cities available for selection
         * @description Unpaginated: the list is small and bounded.
         */
        get: operations["list_cities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reference/cities/{city_id}/localities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Areas and societies of a city
         * @description Public. The active localities of an active city, ordered by name. An unknown, inactive or malformed city id is `404 not_found`. Unpaginated: the list is small and bounded.
         */
        get: operations["list_localities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/registrations/agencies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register an Agency account
         * @description The answer is the same whether or not the email is already registered; an existing address receives an 'already registered' notice by email instead. The account starts Email-unverified with agency verification status 'unverified'. All six fields are mandatory; the business phone and office address are private.
         */
        post: operations["register_agency"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/registrations/individuals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register an Individual account
         * @description The answer is the same whether or not the email is already registered; an existing address receives an 'already registered' notice by email instead.
         */
        post: operations["register_individual"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/registry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The Field registry and taxonomy
         * @description Public. The versioned definition of every Listing field, with the purposes, Categories and Subtypes. Strong `ETag` from the version and content hash; send `If-None-Match` to get `304`. `Cache-Control: public, max-age=300`.
         */
        get: operations["get_registry"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in
         * @description Needs an `X-CSRFToken` header (fetch it from `GET /api/v1/csrf`). On success sets the HttpOnly `estate_session` cookie. Wrong password, unknown email, a Deactivated account and a throttled attempt all answer the same `401 invalid_credentials`.
         */
        post: operations["sign_in"];
        /**
         * Sign out
         * @description Ends only the current session and clears the cookie. Needs `X-CSRFToken`. Without a valid session the answer is `401 unauthenticated`.
         */
        delete: operations["sign_out"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AccountLookupRequest: {
            reason: string;
            /** @description Matched ignoring case. */
            email: string;
        };
        AccountReasonRequest: {
            /** @description One line, without contact details. */
            reason: string;
        };
        AccountStatus: {
            /** Format: uuid */
            id: string;
            account_type: components["schemas"]["OwnerAccountTypeEnum"];
            state: components["schemas"]["StateEnum"];
            /** @description Empty when none. */
            suspension_reason: string;
            /** Format: date-time */
            suspended_at: string | null;
        };
        ActorSummary: {
            /** Format: uuid */
            id: string;
            account_type: components["schemas"]["ActorSummaryAccountTypeEnum"];
            state: components["schemas"]["StateEnum"];
            /** @description The account's own email. Private: owner only. */
            email: string;
            /** @description Individual profile name; empty when none. */
            full_name: string;
            /** @description Agency name (public); empty for non-agency accounts. */
            agency_name: string;
            capabilities: components["schemas"]["CapabilitiesEnum"][];
            /** @description Why the account is Suspended; null otherwise. Private: owner only. */
            suspension_reason: string | null;
        };
        /**
         * @description * `individual` - individual
         *     * `agency` - agency
         *     * `admin` - admin
         * @enum {string}
         */
        ActorSummaryAccountTypeEnum: "individual" | "agency" | "admin";
        AdminAccount: {
            /** Format: uuid */
            id: string;
            account_type: components["schemas"]["OwnerAccountTypeEnum"];
            state: components["schemas"]["StateEnum"];
            /** @description Empty when none. */
            suspension_reason: string;
            /** Format: date-time */
            suspended_at: string | null;
            /** @description Private. */
            email: string;
            /** @description Full name or agency name; empty when there is no profile. */
            display_name: string;
            email_verified: boolean;
        };
        AdminMe: {
            /** Format: uuid */
            id: string;
            account_type: components["schemas"]["AdminMeAccountTypeEnum"];
            state: components["schemas"]["StateEnum"];
        };
        /**
         * @description * `admin` - admin
         * @enum {string}
         */
        AdminMeAccountTypeEnum: "admin";
        AgencyProfile: {
            /** @description Public. */
            agency_name: string;
            /** @description Public. Empty when not set. */
            description: string;
            /**
             * Format: uuid
             * @description Public. An active City reference id.
             */
            city_id: string;
            /** @description The owner's own business phone in E.164. Private: returned only here. */
            business_phone: string;
            /** @description The owner's own office address. Private: returned only here. */
            office_address: string;
            /** @description The current sign-in address. Private. */
            email: string;
            /** @description The address of the newest unused, unexpired email-change request, or null. */
            pending_email: string | null;
            /** @description Read-only Agency Verification status (`unverified` until a later story). */
            verification_status: string;
            /** @description The logo as the owner sees it, or null (none, or its file was lost). */
            image: components["schemas"]["ProfileImage"] | null;
            /**
             * Format: uuid
             * @description The public Agency profile id (not the account id), used in `logo_url`. Returned only in the owner's own response.
             */
            agency_id: string;
            /** @description The public logo route `/api/v1/agencies/{agency_id}/logo`, or null without a logo. It answers 404 unless the Agency account is Active. */
            logo_url: string | null;
        };
        /**
         * @description Strict allowlist of the six fields; the account type and verification status are never
         *     client-chosen. Rules come from `identity.validation`; every failing field is reported at
         *     once.
         */
        AgencyRegistrationRequest: {
            /** @description 2 to 100 letters, digits, spaces and & , . - ' ( ) /. Shown publicly. */
            agency_name: string;
            /** @description The business email. At most 254 characters. */
            email: string;
            /** @description Business phone (private): Pakistani mobile or international number. */
            phone: string;
            /** @description 5 to 300 characters. Private. */
            office_address: string;
            /** @description Id of an active city from the City reference list. */
            city_id: string;
            /** @description 8 to 1024 characters, not a common password, not the email address. */
            password: string;
        };
        /**
         * @description Allowlist. Codes, labels and groups are plain strings (managed in the database, never
         *     OpenAPI enums). `kind` is the closed vocabulary the form groups by; `nearby` entries are
         *     declared by the seller and are never verified.
         */
        Amenity: {
            code: string;
            label: string;
            kind: components["schemas"]["AmenityKindEnum"];
            group: string;
        };
        /**
         * @description * `on_property` - on_property
         *     * `community` - community
         *     * `nearby` - nearby
         * @enum {string}
         */
        AmenityKindEnum: "on_property" | "community" | "nearby";
        AmenityList: {
            items: components["schemas"]["Amenity"][];
        };
        Applicability: {
            purposes: string[];
            categories: string[];
            subtypes: string[];
        };
        /**
         * @description * `lda` - lda
         *     * `cda` - cda
         *     * `kda` - kda
         *     * `rda` - rda
         *     * `fda` - fda
         *     * `mda` - mda
         *     * `gda` - gda
         *     * `bda` - bda
         *     * `peshawar_development_authority` - peshawar_development_authority
         *     * `private_society` - private_society
         *     * `none` - none
         *     * `other` - other
         * @enum {string}
         */
        ApprovalAuthorityEnum: "lda" | "cda" | "kda" | "rda" | "fda" | "mda" | "gda" | "bda" | "peshawar_development_authority" | "private_society" | "none" | "other";
        /**
         * @description * `sqft` - sqft
         *     * `sqyd` - sqyd
         *     * `marla` - marla
         *     * `kanal` - kanal
         *     * `acre` - acre
         * @enum {string}
         */
        AreaUnitEnum: "sqft" | "sqyd" | "marla" | "kanal" | "acre";
        /**
         * @description * `not_applicable` - not_applicable
         *     * `balloting_pending` - balloting_pending
         *     * `balloted` - balloted
         * @enum {string}
         */
        BallotingStatusEnum: "not_applicable" | "balloting_pending" | "balloted";
        /**
         * @description * `retail` - retail
         *     * `restaurant` - restaurant
         *     * `office_work` - office_work
         *     * `clinic` - clinic
         *     * `warehouse` - warehouse
         *     * `showroom` - showroom
         *     * `mixed` - mixed
         *     * `other` - other
         * @enum {string}
         */
        BusinessUseEnum: "retail" | "restaurant" | "office_work" | "clinic" | "warehouse" | "showroom" | "mixed" | "other";
        /**
         * @description * `sign_in` - sign_in
         *     * `browse` - browse
         *     * `view_drafts` - view_drafts
         *     * `edit_drafts` - edit_drafts
         *     * `publish` - publish
         *     * `send_messages` - send_messages
         *     * `read_conversations` - read_conversations
         *     * `report` - report
         *     * `request_support` - request_support
         *     * `request_deactivation` - request_deactivation
         * @enum {string}
         */
        CapabilitiesEnum: "sign_in" | "browse" | "view_drafts" | "edit_drafts" | "publish" | "send_messages" | "read_conversations" | "report" | "request_support" | "request_deactivation";
        /**
         * @description * `house` - house
         *     * `apartment` - apartment
         *     * `plot` - plot
         *     * `commercial` - commercial
         * @enum {string}
         */
        CategoryEnum: "house" | "apartment" | "plot" | "commercial";
        ChangePasswordRequest: {
            /** @description The password in use now. */
            current_password: string;
            /** @description 8 to 1024 characters, not common, not the email address, not the current one. */
            new_password: string;
        };
        /** @description Allowlist. Names are plain strings: city values are managed in the database. */
        City: {
            /** Format: uuid */
            id: string;
            name: string;
        };
        CityList: {
            items: components["schemas"]["City"][];
        };
        /**
         * @description * `bad_request` - bad_request
         *     * `validation_error` - validation_error
         *     * `link_invalid` - link_invalid
         *     * `unauthenticated` - unauthenticated
         *     * `invalid_credentials` - invalid_credentials
         *     * `forbidden` - forbidden
         *     * `email_not_verified` - email_not_verified
         *     * `publishing_unavailable` - publishing_unavailable
         *     * `not_found` - not_found
         *     * `method_not_allowed` - method_not_allowed
         *     * `not_acceptable` - not_acceptable
         *     * `stale_revision` - stale_revision
         *     * `conflict` - conflict
         *     * `quota_exhausted` - quota_exhausted
         *     * `correction_unavailable` - correction_unavailable
         *     * `storage_cap_exceeded` - storage_cap_exceeded
         *     * `too_many_images` - too_many_images
         *     * `link_used` - link_used
         *     * `link_expired` - link_expired
         *     * `unsupported_media_type` - unsupported_media_type
         *     * `idempotency_key_reused` - idempotency_key_reused
         *     * `throttled` - throttled
         *     * `server_error` - server_error
         *     * `busy` - busy
         * @enum {string}
         */
        CodeEnum: "bad_request" | "validation_error" | "link_invalid" | "unauthenticated" | "invalid_credentials" | "forbidden" | "email_not_verified" | "publishing_unavailable" | "not_found" | "method_not_allowed" | "not_acceptable" | "stale_revision" | "conflict" | "quota_exhausted" | "correction_unavailable" | "storage_cap_exceeded" | "too_many_images" | "link_used" | "link_expired" | "unsupported_media_type" | "idempotency_key_reused" | "throttled" | "server_error" | "busy";
        /**
         * @description * `new` - new
         *     * `excellent` - excellent
         *     * `good` - good
         *     * `needs_renovation` - needs_renovation
         * @enum {string}
         */
        ConditionEnum: "new" | "excellent" | "good" | "needs_renovation";
        ConfirmEmailRequest: {
            /** @description The token from the verification link. */
            token: string;
        };
        /**
         * @description * `completed` - completed
         *     * `under_construction` - under_construction
         *     * `grey_structure` - grey_structure
         * @enum {string}
         */
        ConstructionStatusEnum: "completed" | "under_construction" | "grey_structure";
        /**
         * @description * `image/jpeg` - image/jpeg
         *     * `image/png` - image/png
         *     * `image/webp` - image/webp
         * @enum {string}
         */
        ContentTypeEnum: "image/jpeg" | "image/png" | "image/webp";
        /** @description `409`: the error envelope plus, for `stale_revision`, the Listing as it is now. */
        CorrectionConflict: {
            error: components["schemas"]["ErrorBody"];
            /** @description With `stale_revision` only. */
            current?: components["schemas"]["Listing"];
        };
        CorrectionWindow: {
            /** @description Whether the owner may correct the locality and area now. */
            available: boolean;
            /**
             * Format: date-time
             * @description When the open window closes, +05:00; null when `available` is false.
             */
            expires_at: string | null;
        };
        CsrfToken: {
            csrf_token: string;
        };
        /**
         * @description * `developed` - developed
         *     * `partially_developed` - partially_developed
         *     * `undeveloped` - undeveloped
         * @enum {string}
         */
        DevelopmentStatusEnum: "developed" | "partially_developed" | "undeveloped";
        DraftCreateRequest: {
            /**
             * @description From the registry.
             *
             *     * `sale` - sale
             *     * `rent` - rent
             */
            purpose: components["schemas"]["PurposeEnum"];
            /**
             * @description From the registry.
             *
             *     * `house` - house
             *     * `apartment` - apartment
             *     * `plot` - plot
             *     * `commercial` - commercial
             */
            category: components["schemas"]["CategoryEnum"];
            /**
             * @description A Subtype of the chosen Category.
             *
             *     * `house` - house
             *     * `apartment` - apartment
             *     * `residential_plot` - residential_plot
             *     * `commercial_plot` - commercial_plot
             *     * `plot_file` - plot_file
             *     * `shop` - shop
             *     * `office` - office
             */
            subtype: components["schemas"]["SubtypeEnum"];
        };
        EmailChangeConfirmRequest: {
            /** @description The token from the email-change link. */
            token: string;
        };
        EmailChangeRequest: {
            /** @description The address to sign in with after confirming. */
            new_email: string;
            /** @description The password in use now. */
            current_password: string;
        };
        EmailChanged: {
            status: components["schemas"]["EmailChangedStatusEnum"];
        };
        /**
         * @description * `email_changed` - email_changed
         * @enum {string}
         */
        EmailChangedStatusEnum: "email_changed";
        /**
         * @description * `verified` - verified
         * @enum {string}
         */
        EmailVerifiedStatusEnum: "verified";
        ErrorBody: {
            code: components["schemas"]["ErrorCode"];
            message: string;
            fields: {
                [key: string]: string[];
            };
            request_id: string;
        };
        /**
         * @description * `public` - public
         *     * `private` - private
         * @enum {string}
         */
        FieldClassEnum: "public" | "private";
        /**
         * @description * `required_for_publication` - required_for_publication
         *     * `recommended` - recommended
         *     * `optional` - optional
         * @enum {string}
         */
        FieldRequirementEnum: "required_for_publication" | "recommended" | "optional";
        /**
         * @description * `unfurnished` - unfurnished
         *     * `semi_furnished` - semi_furnished
         *     * `furnished` - furnished
         * @enum {string}
         */
        FurnishingEnum: "unfurnished" | "semi_furnished" | "furnished";
        Health: {
            status: components["schemas"]["HealthStatusEnum"];
        };
        /**
         * @description * `ok` - ok
         * @enum {string}
         */
        HealthStatusEnum: "ok";
        HealthUnavailable: {
            status: components["schemas"]["HealthUnavailableStatusEnum"];
        };
        /**
         * @description * `unavailable` - unavailable
         * @enum {string}
         */
        HealthUnavailableStatusEnum: "unavailable";
        /**
         * @description An attached image (AD-24). `url` is the relative path of the media endpoint; the asset id,
         *     the storage key and the owner never appear.
         */
        Image: {
            /** Format: uuid */
            id: string;
            /** @description 0-based and contiguous: 0 is the first image. */
            position: number;
            /** @description Exactly one image of a Listing is the cover. */
            is_cover: boolean;
            content_type: components["schemas"]["ContentTypeEnum"];
            width: number;
            height: number;
            /** @description Size of the stored (re-encoded) file. */
            bytes: number;
            /** @description Relative path of the media endpoint, `/api/v1/listings/{id}/images/{image_id}/file`. */
            url: string;
        };
        ImageOrderRequest: {
            /** @description The `revision` of the Listing the client last read. */
            base_revision: number;
            /** @description Every image id of the Listing, exactly once, in the wanted order. */
            order: string[];
            /**
             * Format: uuid
             * @description The image to make the cover; null or omitted keeps the current cover.
             */
            cover_id?: string | null;
        };
        /** @description Documentation of the multipart body: exactly one part, named `file`. */
        ImageUploadRequest: {
            /**
             * Format: binary
             * @description A JPEG, PNG or WebP image of up to 5 MB (5,242,880 bytes).
             */
            file: string;
        };
        /**
         * @description Strict allowlist of the four fields. Rules come from `identity.validation`; every failing
         *     field is reported at once, and an unknown field (such as `role`) is refused.
         */
        IndividualRegistrationRequest: {
            /** @description 2 to 80 letters, spaces, hyphens, apostrophes, full stops. */
            full_name: string;
            /** @description At most 254 characters. */
            email: string;
            /** @description 8 to 1024 characters, not a common password, not the email address. */
            password: string;
            /** @description Pakistani mobile (03xx xxxxxxx) or international number (+, 8 to 15 digits). */
            phone: string;
        };
        Listing: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["ListingStatusEnum"];
            visibility: components["schemas"]["VisibilityEnum"];
            revision: number;
            registry_version: number;
            fields: components["schemas"]["ListingFields"];
            /** @description Registry field id -> where the value came from; set fields only. */
            provenance: {
                [key: string]: components["schemas"]["ProvenanceEntry"];
            };
            /** @description The images in `position` order; empty when there are none. */
            media: components["schemas"]["Image"][];
            /** @description Set by moderation: a restricted Listing is never public and the owner cannot edit it (it may still be archived). Owner resource only, never in a public shape. */
            restricted: boolean;
            /** @description A short plain-text reason for a restricted or removed Listing, shown to the owner only; null otherwise. */
            restriction_reason: string | null;
        };
        /** @description `409 stale_revision`: the error envelope plus the Listing as it is now. */
        ListingConflict: {
            error: components["schemas"]["ErrorBody"];
            /** @description The current Listing, to reload and reapply the edit. */
            current: components["schemas"]["Listing"];
        };
        /** @description What a correction accepts: send only what changes. `marla_basis` only changes together with `area_value` or `area_unit`. */
        ListingCorrectionFieldsRequest: {
            /**
             * Format: uuid
             * @description The uuid of an active locality from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            locality?: string | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            area_value?: string | null;
            area_unit?: (components["schemas"]["AreaUnitEnum"] | components["schemas"]["NullEnum"]) | null;
            marla_basis?: (components["schemas"]["MarlaBasisEnum"] | components["schemas"]["NullEnum"]) | null;
        };
        ListingCorrectionRequest: {
            /** @description The `revision` of the Listing the client last read. */
            base_revision: number;
            fields: components["schemas"]["ListingCorrectionFieldsRequest"];
        };
        ListingCounts: {
            draft: number;
            published: number;
            archived: number;
            sold: number;
            rented: number;
            removed: number;
        };
        /** @description Flat registry ids. Null means unknown. */
        ListingFields: {
            purpose: (components["schemas"]["PurposeEnum"] | components["schemas"]["NullEnum"]) | null;
            category: (components["schemas"]["CategoryEnum"] | components["schemas"]["NullEnum"]) | null;
            subtype: (components["schemas"]["SubtypeEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description 10 to 100 characters. */
            title: string | null;
            /** @description Up to 5000 characters. */
            description: string | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            asking_price: string | null;
            price_basis: (components["schemas"]["PriceBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            rental_period: (components["schemas"]["RentalPeriodEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            area_value: string | null;
            area_unit: (components["schemas"]["AreaUnitEnum"] | components["schemas"]["NullEnum"]) | null;
            marla_basis: (components["schemas"]["MarlaBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bedrooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bathrooms: number | null;
            /** @description Whole number from 1900 to 2100, a JSON integer (never text). Null clears it. */
            construction_year: number | null;
            condition: (components["schemas"]["ConditionEnum"] | components["schemas"]["NullEnum"]) | null;
            furnishing: (components["schemas"]["FurnishingEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            parking_spaces: number | null;
            occupancy_status: (components["schemas"]["OccupancyStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            covered_area_sqft: string | null;
            /** @description Whole number from 1 to 200, a JSON integer (never text). Null clears it. */
            total_floors: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            kitchens: number | null;
            construction_status: (components["schemas"]["ConstructionStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            drawing_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            dining_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            tv_lounges: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            study_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            prayer_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            store_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            laundry_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            powder_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            servant_quarters: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            basement: boolean | null;
            /** @description Whole number from 0 to 200, a JSON integer (never text). Null clears it. */
            floor_number: number | null;
            /** @description Whole number from 1 to 200, a JSON integer (never text). Null clears it. */
            building_floors: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            lift: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            backup_electricity: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            building_security: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            balcony_or_terrace: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            building_lobby: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            intercom: boolean | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            maintenance_charges: string | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            electricity: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            water: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            gas: boolean | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            plot_width: string | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            plot_depth: string | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI. The choices depend on the Subtype (see the registry).
             *
             *     * `possession_ready` - possession_ready
             *     * `possession_pending` - possession_pending
             *     * `file_only` - file_only
             */
            possession_status: (components["schemas"]["PossessionStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            corner_plot: boolean | null;
            /** @description Decimal string with up to 2 decimals (`1.00` to `999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            road_width_ft: string | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `not_applicable` - not_applicable
             *     * `balloting_pending` - balloting_pending
             *     * `balloted` - balloted
             */
            balloting_status: (components["schemas"]["BallotingStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            sewerage: boolean | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `developed` - developed
             *     * `partially_developed` - partially_developed
             *     * `undeveloped` - undeveloped
             */
            development_status: (components["schemas"]["DevelopmentStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `lda` - lda
             *     * `cda` - cda
             *     * `kda` - kda
             *     * `rda` - rda
             *     * `fda` - fda
             *     * `mda` - mda
             *     * `gda` - gda
             *     * `bda` - bda
             *     * `peshawar_development_authority` - peshawar_development_authority
             *     * `private_society` - private_society
             *     * `none` - none
             *     * `other` - other
             */
            approval_authority: (components["schemas"]["ApprovalAuthorityEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            park_facing: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            main_boulevard: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            boundary_wall: boolean | null;
            orientation: (components["schemas"]["OrientationEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `open_file` - open_file
             *     * `allocation_letter` - allocation_letter
             *     * `possession_letter` - possession_letter
             */
            plot_file_status: (components["schemas"]["PlotFileStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            business_use: (components["schemas"]["BusinessUseEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `9999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            frontage_ft: string | null;
            road_access: (components["schemas"]["RoadAccessEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 2 decimals (`1.00` to `99.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            ceiling_height_ft: string | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            power_load_kw: string | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            three_phase_electricity: boolean | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            conference_rooms: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            business_centre_facilities: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            price_negotiable: boolean | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `available_now` - available_now
             *     * `within_one_month` - within_one_month
             *     * `within_three_months` - within_three_months
             *     * `after_three_months` - after_three_months
             */
            possession_availability: (components["schemas"]["PossessionAvailabilityEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            security_deposit: string | null;
            /**
             * Format: date
             * @description A calendar date as text `YYYY-MM-DD` (`2000-01-01` to `2100-12-31`), never a timestamp or a JSON number. Returned the same way.
             */
            availability_date: string | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            advance_rent: string | null;
            /** @description Whole number from 1 to 120, a JSON integer (never text). Null clears it. */
            minimum_lease_months: number | null;
            /** @description Whole number from 0 to 365, a JSON integer (never text). Null clears it. */
            notice_period_days: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_electricity_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_gas_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_water_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_internet_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            pets_allowed: boolean | null;
            occupant_restrictions: (components["schemas"]["OccupantRestrictionsEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * Format: uuid
             * @description The uuid of an active city from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            city: string | null;
            /**
             * Format: uuid
             * @description The uuid of an active locality from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            locality: string | null;
            /** @description Up to 60 characters. */
            society: string | null;
            /** @description Up to 60 characters. */
            phase: string | null;
            /** @description Up to 60 characters. */
            sector: string | null;
            /** @description Up to 60 characters. */
            block: string | null;
            /** @description Up to 120 characters. */
            street: string | null;
            /** @description Up to 30 characters. */
            house_number: string | null;
            /** @description Decimal string with up to 6 decimals (`-90` to `90`), digits and a point only, a leading minus sign, never a JSON number. Returned with 6 decimals. */
            latitude: string | null;
            /** @description Decimal string with up to 6 decimals (`-180` to `180`), digits and a point only, a leading minus sign, never a JSON number. Returned with 6 decimals. */
            longitude: string | null;
            /** @description An object `{code: state}` with catalogue codes (`/api/v1/reference/amenities`) and the state `"present"` or `"none"`, at most 40 entries. It REPLACES the whole map; `null` or `{}` clears it. A code left out is unanswered, never `none`. `nearby` entries are the seller's own declaration: show them as seller-declared; there is no distance and no verification. Returned as the answered codes only, or `null` when none is answered. */
            amenities: {
                [key: string]: string;
            } | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. Computed by the server; read-only. */
            area_sqft: string | null;
        };
        /** @description The editable fields; the service judges every value (null clears a field). */
        ListingFieldsUpdateRequest: {
            /** @description 10 to 100 characters. */
            title?: string | null;
            /** @description Up to 5000 characters. */
            description?: string | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            asking_price?: string | null;
            price_basis?: (components["schemas"]["PriceBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            rental_period?: (components["schemas"]["RentalPeriodEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            area_value?: string | null;
            area_unit?: (components["schemas"]["AreaUnitEnum"] | components["schemas"]["NullEnum"]) | null;
            marla_basis?: (components["schemas"]["MarlaBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bedrooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bathrooms?: number | null;
            /** @description Whole number from 1900 to 2100, a JSON integer (never text). Null clears it. */
            construction_year?: number | null;
            condition?: (components["schemas"]["ConditionEnum"] | components["schemas"]["NullEnum"]) | null;
            furnishing?: (components["schemas"]["FurnishingEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            parking_spaces?: number | null;
            occupancy_status?: (components["schemas"]["OccupancyStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            covered_area_sqft?: string | null;
            /** @description Whole number from 1 to 200, a JSON integer (never text). Null clears it. */
            total_floors?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            kitchens?: number | null;
            construction_status?: (components["schemas"]["ConstructionStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            drawing_rooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            dining_rooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            tv_lounges?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            study_rooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            prayer_rooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            store_rooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            laundry_rooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            powder_rooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            servant_quarters?: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            basement?: boolean | null;
            /** @description Whole number from 0 to 200, a JSON integer (never text). Null clears it. */
            floor_number?: number | null;
            /** @description Whole number from 1 to 200, a JSON integer (never text). Null clears it. */
            building_floors?: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            lift?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            backup_electricity?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            building_security?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            balcony_or_terrace?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            building_lobby?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            intercom?: boolean | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            maintenance_charges?: string | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            electricity?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            water?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            gas?: boolean | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            plot_width?: string | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            plot_depth?: string | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI. The choices depend on the Subtype (see the registry).
             *
             *     * `possession_ready` - possession_ready
             *     * `possession_pending` - possession_pending
             *     * `file_only` - file_only
             */
            possession_status?: (components["schemas"]["PossessionStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            corner_plot?: boolean | null;
            /** @description Decimal string with up to 2 decimals (`1.00` to `999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            road_width_ft?: string | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `not_applicable` - not_applicable
             *     * `balloting_pending` - balloting_pending
             *     * `balloted` - balloted
             */
            balloting_status?: (components["schemas"]["BallotingStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            sewerage?: boolean | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `developed` - developed
             *     * `partially_developed` - partially_developed
             *     * `undeveloped` - undeveloped
             */
            development_status?: (components["schemas"]["DevelopmentStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `lda` - lda
             *     * `cda` - cda
             *     * `kda` - kda
             *     * `rda` - rda
             *     * `fda` - fda
             *     * `mda` - mda
             *     * `gda` - gda
             *     * `bda` - bda
             *     * `peshawar_development_authority` - peshawar_development_authority
             *     * `private_society` - private_society
             *     * `none` - none
             *     * `other` - other
             */
            approval_authority?: (components["schemas"]["ApprovalAuthorityEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            park_facing?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            main_boulevard?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            boundary_wall?: boolean | null;
            orientation?: (components["schemas"]["OrientationEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `open_file` - open_file
             *     * `allocation_letter` - allocation_letter
             *     * `possession_letter` - possession_letter
             */
            plot_file_status?: (components["schemas"]["PlotFileStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            business_use?: (components["schemas"]["BusinessUseEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `9999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            frontage_ft?: string | null;
            road_access?: (components["schemas"]["RoadAccessEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 2 decimals (`1.00` to `99.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            ceiling_height_ft?: string | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            power_load_kw?: string | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            three_phase_electricity?: boolean | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            conference_rooms?: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            business_centre_facilities?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            price_negotiable?: boolean | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `available_now` - available_now
             *     * `within_one_month` - within_one_month
             *     * `within_three_months` - within_three_months
             *     * `after_three_months` - after_three_months
             */
            possession_availability?: (components["schemas"]["PossessionAvailabilityEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            security_deposit?: string | null;
            /**
             * Format: date
             * @description A calendar date as text `YYYY-MM-DD` (`2000-01-01` to `2100-12-31`), never a timestamp or a JSON number. Returned the same way.
             */
            availability_date?: string | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            advance_rent?: string | null;
            /** @description Whole number from 1 to 120, a JSON integer (never text). Null clears it. */
            minimum_lease_months?: number | null;
            /** @description Whole number from 0 to 365, a JSON integer (never text). Null clears it. */
            notice_period_days?: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_electricity_included?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_gas_included?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_water_included?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_internet_included?: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            pets_allowed?: boolean | null;
            occupant_restrictions?: (components["schemas"]["OccupantRestrictionsEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * Format: uuid
             * @description The uuid of an active city from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            city?: string | null;
            /**
             * Format: uuid
             * @description The uuid of an active locality from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            locality?: string | null;
            /** @description Up to 60 characters. */
            society?: string | null;
            /** @description Up to 60 characters. */
            phase?: string | null;
            /** @description Up to 60 characters. */
            sector?: string | null;
            /** @description Up to 60 characters. */
            block?: string | null;
            /** @description Up to 120 characters. */
            street?: string | null;
            /** @description Up to 30 characters. */
            house_number?: string | null;
            /** @description Decimal string with up to 6 decimals (`-90` to `90`), digits and a point only, a leading minus sign, never a JSON number. Returned with 6 decimals. */
            latitude?: string | null;
            /** @description Decimal string with up to 6 decimals (`-180` to `180`), digits and a point only, a leading minus sign, never a JSON number. Returned with 6 decimals. */
            longitude?: string | null;
            /** @description An object `{code: state}` with catalogue codes (`/api/v1/reference/amenities`) and the state `"present"` or `"none"`, at most 40 entries. It REPLACES the whole map; `null` or `{}` clears it. A code left out is unanswered, never `none`. `nearby` entries are the seller's own declaration: show them as seller-declared; there is no distance and no verification. Returned as the answered codes only, or `null` when none is answered. */
            amenities?: {
                [key: string]: string;
            } | null;
        };
        ListingPage: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["Listing"][];
        };
        /**
         * @description What the public will see of the owner's own Listing, plus an `estimate` that is always
         *     null until the valuation feature exists.
         */
        ListingPreview: {
            /** Format: uuid */
            id: string;
            purpose: components["schemas"]["PurposeEnum"];
            category: components["schemas"]["CategoryEnum"];
            subtype: components["schemas"]["SubtypeEnum"];
            title: string | null;
            description: string | null;
            fields: components["schemas"]["PublicFields"];
            /** @description The images in `position` order. */
            media: components["schemas"]["PublicImage"][];
            registry_version: number;
            /** @description Always null for now; reserved for the valuation estimate. */
            readonly estimate: {
                [key: string]: unknown;
            } | null;
        };
        /**
         * @description * `draft` - draft
         *     * `published` - published
         *     * `archived` - archived
         *     * `sold` - sold
         *     * `rented` - rented
         *     * `removed` - removed
         * @enum {string}
         */
        ListingStatusEnum: "draft" | "published" | "archived" | "sold" | "rented" | "removed";
        ListingUpdateRequest: {
            /** @description The `revision` of the Listing the client last read. */
            base_revision: number;
            fields: components["schemas"]["ListingFieldsUpdateRequest"];
        };
        /**
         * @description Allowlist. Names are plain strings: locality values are managed in the database. `kind`
         *     is `area` or `society`, a closed vocabulary the form groups by.
         */
        Locality: {
            /** Format: uuid */
            id: string;
            name: string;
            kind: components["schemas"]["LocalityKindEnum"];
        };
        /**
         * @description * `area` - area
         *     * `society` - society
         * @enum {string}
         */
        LocalityKindEnum: "area" | "society";
        LocalityList: {
            items: components["schemas"]["Locality"][];
        };
        Marked: {
            marked: number;
        };
        /**
         * @description * `225` - 225
         *     * `250` - 250
         *     * `272.25` - 272.25
         * @enum {string}
         */
        MarlaBasisEnum: "225" | "250" | "272.25";
        /**
         * @description * `choice` - choice
         *     * `range` - range
         *     * `boolean` - boolean
         *     * `amenities` - amenities
         * @enum {string}
         */
        MatchEnum: "choice" | "range" | "boolean" | "amenities";
        Notification: {
            /** Format: uuid */
            id: string;
            /** @description `domain.verb`, registered by the producing feature. */
            kind: string;
            /** @description Public values only, shaped by the kind's registered schema. */
            payload: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            created_at: string;
            read: boolean;
        };
        NotificationPage: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["Notification"][];
        };
        /** @enum {unknown} */
        NullEnum: null;
        /**
         * @description * `owner_occupied` - owner_occupied
         *     * `tenant_occupied` - tenant_occupied
         *     * `vacant` - vacant
         * @enum {string}
         */
        OccupancyStatusEnum: "owner_occupied" | "tenant_occupied" | "vacant";
        /**
         * @description * `no_restriction` - no_restriction
         *     * `families_only` - families_only
         *     * `bachelors_only` - bachelors_only
         * @enum {string}
         */
        OccupantRestrictionsEnum: "no_restriction" | "families_only" | "bachelors_only";
        /**
         * @description * `north` - north
         *     * `south` - south
         *     * `east` - east
         *     * `west` - west
         *     * `north_east` - north_east
         *     * `north_west` - north_west
         *     * `south_east` - south_east
         *     * `south_west` - south_west
         * @enum {string}
         */
        OrientationEnum: "north" | "south" | "east" | "west" | "north_east" | "north_west" | "south_east" | "south_west";
        /**
         * @description * `manual` - manual
         *     * `ai` - ai
         * @enum {string}
         */
        OriginEnum: "manual" | "ai";
        /**
         * @description * `individual` - individual
         *     * `agency` - agency
         * @enum {string}
         */
        OwnerAccountTypeEnum: "individual" | "agency";
        PasswordChanged: {
            status: components["schemas"]["PasswordChangedStatusEnum"];
        };
        /**
         * @description * `password_changed` - password_changed
         * @enum {string}
         */
        PasswordChangedStatusEnum: "password_changed";
        PasswordResetConfirmRequest: {
            /** @description The token from the reset link. */
            token: string;
            /** @description The new password: 8 to 1024 characters, not common, not the email address. */
            password: string;
        };
        PasswordResetDone: {
            status: components["schemas"]["PasswordResetDoneStatusEnum"];
        };
        /**
         * @description * `password_reset` - password_reset
         * @enum {string}
         */
        PasswordResetDoneStatusEnum: "password_reset";
        PasswordResetRequestRequest: {
            /** @description The address to send a reset link to. */
            email: string;
        };
        PatchedAgencyProfileUpdateRequest: {
            /** @description 2 to 100 characters, no phone numbers or email addresses. */
            agency_name?: string;
            /** @description Optional, up to 1000 characters, no phone numbers, email addresses or street addresses. Blank or null clears it. */
            description?: string | null;
            /**
             * Format: uuid
             * @description An active City reference id.
             */
            city_id?: string;
            /** @description Pakistani mobile or international number. Mandatory: blank or null is refused. */
            business_phone?: string;
            /** @description 5 to 300 characters. Mandatory: blank or null is refused. */
            office_address?: string;
        };
        PatchedProfileUpdateRequest: {
            /** @description 2 to 80 characters. */
            full_name?: string;
            /** @description Pakistani mobile or international number. Mandatory: blank or null is refused. */
            phone?: string;
        };
        Place: {
            /** Format: uuid */
            id: string;
            name: string;
        };
        /**
         * @description * `open_file` - open_file
         *     * `allocation_letter` - allocation_letter
         *     * `possession_letter` - possession_letter
         * @enum {string}
         */
        PlotFileStatusEnum: "open_file" | "allocation_letter" | "possession_letter";
        /**
         * @description * `available_now` - available_now
         *     * `within_one_month` - within_one_month
         *     * `within_three_months` - within_three_months
         *     * `after_three_months` - after_three_months
         * @enum {string}
         */
        PossessionAvailabilityEnum: "available_now" | "within_one_month" | "within_three_months" | "after_three_months";
        /**
         * @description * `possession_ready` - possession_ready
         *     * `possession_pending` - possession_pending
         *     * `file_only` - file_only
         * @enum {string}
         */
        PossessionStatusEnum: "possession_ready" | "possession_pending" | "file_only";
        /**
         * @description * `total` - total
         *     * `per_unit` - per_unit
         *     * `rental_period` - rental_period
         * @enum {string}
         */
        PriceBasisEnum: "total" | "per_unit" | "rental_period";
        Profile: {
            full_name: string;
            /** @description The owner's own phone number in E.164. Private: returned only here. */
            phone: string;
            /** @description The current sign-in address. */
            email: string;
            /** @description The address of the newest unused, unexpired email-change request, or null. */
            pending_email: string | null;
            /** @description The profile picture, or null (none, or its file was lost). Private to the owner: `url` is the owner-only route. */
            image: components["schemas"]["ProfileImage"] | null;
        };
        ProfileImage: {
            content_type: components["schemas"]["ContentTypeEnum"];
            width: number;
            height: number;
            /** @description The stored size. */
            bytes: number;
            /** @description The owner-only route that serves the image (relative). Never a public URL. */
            url: string;
        };
        ProvenanceEntry: {
            origin: components["schemas"]["OriginEnum"];
            confirmed: boolean;
        };
        /** @description Price, area and room facts by registry id. Null means unknown or not applicable. */
        PublicCardFields: {
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            asking_price: string | null;
            price_basis: (components["schemas"]["PriceBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            rental_period: (components["schemas"]["RentalPeriodEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            area_value: string | null;
            area_unit: (components["schemas"]["AreaUnitEnum"] | components["schemas"]["NullEnum"]) | null;
            marla_basis: (components["schemas"]["MarlaBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. Computed by the server; read-only. */
            area_sqft: string | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bedrooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bathrooms: number | null;
        };
        /** @description The registry fields of class `public`, flat by registry id. Null means unknown. */
        PublicFields: {
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            asking_price: string | null;
            price_basis: (components["schemas"]["PriceBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            rental_period: (components["schemas"]["RentalPeriodEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            area_value: string | null;
            area_unit: (components["schemas"]["AreaUnitEnum"] | components["schemas"]["NullEnum"]) | null;
            marla_basis: (components["schemas"]["MarlaBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bedrooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bathrooms: number | null;
            /** @description Whole number from 1900 to 2100, a JSON integer (never text). Null clears it. */
            construction_year: number | null;
            condition: (components["schemas"]["ConditionEnum"] | components["schemas"]["NullEnum"]) | null;
            furnishing: (components["schemas"]["FurnishingEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            parking_spaces: number | null;
            occupancy_status: (components["schemas"]["OccupancyStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            covered_area_sqft: string | null;
            /** @description Whole number from 1 to 200, a JSON integer (never text). Null clears it. */
            total_floors: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            kitchens: number | null;
            construction_status: (components["schemas"]["ConstructionStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            drawing_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            dining_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            tv_lounges: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            study_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            prayer_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            store_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            laundry_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            powder_rooms: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            servant_quarters: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            basement: boolean | null;
            /** @description Whole number from 0 to 200, a JSON integer (never text). Null clears it. */
            floor_number: number | null;
            /** @description Whole number from 1 to 200, a JSON integer (never text). Null clears it. */
            building_floors: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            lift: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            backup_electricity: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            building_security: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            balcony_or_terrace: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            building_lobby: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            intercom: boolean | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            maintenance_charges: string | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            electricity: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            water: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            gas: boolean | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            plot_width: string | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            plot_depth: string | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI. The choices depend on the Subtype (see the registry).
             *
             *     * `possession_ready` - possession_ready
             *     * `possession_pending` - possession_pending
             *     * `file_only` - file_only
             */
            possession_status: (components["schemas"]["PossessionStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            corner_plot: boolean | null;
            /** @description Decimal string with up to 2 decimals (`1.00` to `999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            road_width_ft: string | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `not_applicable` - not_applicable
             *     * `balloting_pending` - balloting_pending
             *     * `balloted` - balloted
             */
            balloting_status: (components["schemas"]["BallotingStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            sewerage: boolean | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `developed` - developed
             *     * `partially_developed` - partially_developed
             *     * `undeveloped` - undeveloped
             */
            development_status: (components["schemas"]["DevelopmentStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `lda` - lda
             *     * `cda` - cda
             *     * `kda` - kda
             *     * `rda` - rda
             *     * `fda` - fda
             *     * `mda` - mda
             *     * `gda` - gda
             *     * `bda` - bda
             *     * `peshawar_development_authority` - peshawar_development_authority
             *     * `private_society` - private_society
             *     * `none` - none
             *     * `other` - other
             */
            approval_authority: (components["schemas"]["ApprovalAuthorityEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            park_facing: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            main_boulevard: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            boundary_wall: boolean | null;
            orientation: (components["schemas"]["OrientationEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `open_file` - open_file
             *     * `allocation_letter` - allocation_letter
             *     * `possession_letter` - possession_letter
             */
            plot_file_status: (components["schemas"]["PlotFileStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            business_use: (components["schemas"]["BusinessUseEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `9999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            frontage_ft: string | null;
            road_access: (components["schemas"]["RoadAccessEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string with up to 2 decimals (`1.00` to `99.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            ceiling_height_ft: string | null;
            /** @description Decimal string with up to 2 decimals (`0.01` to `99999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            power_load_kw: string | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            three_phase_electricity: boolean | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            conference_rooms: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            business_centre_facilities: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            price_negotiable: boolean | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `available_now` - available_now
             *     * `within_one_month` - within_one_month
             *     * `within_three_months` - within_three_months
             *     * `after_three_months` - after_three_months
             */
            possession_availability: (components["schemas"]["PossessionAvailabilityEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            security_deposit: string | null;
            /**
             * Format: date
             * @description A calendar date as text `YYYY-MM-DD` (`2000-01-01` to `2100-12-31`), never a timestamp or a JSON number. Returned the same way.
             */
            availability_date: string | null;
            /** @description Decimal string in PKR with two decimals, e.g. `1500000.00`. */
            advance_rent: string | null;
            /** @description Whole number from 1 to 120, a JSON integer (never text). Null clears it. */
            minimum_lease_months: number | null;
            /** @description Whole number from 0 to 365, a JSON integer (never text). Null clears it. */
            notice_period_days: number | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_electricity_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_gas_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_water_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            utility_internet_included: boolean | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            pets_allowed: boolean | null;
            occupant_restrictions: (components["schemas"]["OccupantRestrictionsEnum"] | components["schemas"]["NullEnum"]) | null;
            /**
             * Format: uuid
             * @description The uuid of an active city from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            city: string | null;
            /**
             * Format: uuid
             * @description The uuid of an active locality from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            locality: string | null;
            /** @description Up to 60 characters. */
            society: string | null;
            /** @description Up to 60 characters. */
            phase: string | null;
            /** @description Up to 60 characters. */
            sector: string | null;
            /** @description Up to 60 characters. */
            block: string | null;
            /** @description An object `{code: state}` with catalogue codes (`/api/v1/reference/amenities`) and the state `"present"` or `"none"`, at most 40 entries. It REPLACES the whole map; `null` or `{}` clears it. A code left out is unanswered, never `none`. `nearby` entries are the seller's own declaration: show them as seller-declared; there is no distance and no verification. Returned as the answered codes only, or `null` when none is answered. */
            amenities: {
                [key: string]: string;
            } | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. Computed by the server; read-only. */
            area_sqft: string | null;
        };
        PublicFilter: {
            /** @description The registry field id. */
            id: string;
            type: components["schemas"]["TypeEnum"];
            /**
             * @description `choice`: comma-separated, any of them. `range`: inclusive `_min` and `_max`. `boolean`: `true` or `false`. `amenities`: comma-separated codes, all of them.
             *
             *     * `choice` - choice
             *     * `range` - range
             *     * `boolean` - boolean
             *     * `amenities` - amenities
             */
            match: components["schemas"]["MatchEnum"];
            /** @description The query parameter names. */
            params: string[];
            /** @description Enums only. */
            allowed_values: string[] | null;
            /** @description Amenities only: the active catalogue. A `nearby` entry is the seller's own declaration. */
            options: components["schemas"]["Amenity"][] | null;
            /** @description `city` or `locality`: values are ids from the reference lists. */
            reference: string | null;
            /** @description Ranges: the registry's smallest. */
            min: string | null;
            /** @description Ranges: the largest bound accepted. */
            max: string | null;
            seller_declared: boolean;
            /** @description Applicability; empty means all. */
            purposes: string[];
            categories: string[];
            subtypes: string[];
        };
        PublicFilters: {
            registry_version: number;
            /** @description `relevance` only with a preference. */
            sorts: string[];
            /** @description Put before any filter parameter to make it a preference. */
            preference_prefix: string;
            filters: components["schemas"]["PublicFilter"][];
        };
        /** @description An image as the public sees it: no asset id, storage key, owner or stored size. */
        PublicImage: {
            /** Format: uuid */
            id: string;
            position: number;
            is_cover: boolean;
            content_type: components["schemas"]["ContentTypeEnum"];
            width: number;
            height: number;
            /** @description Relative path of the media endpoint, `/api/v1/listings/{id}/images/{image_id}/file`. */
            url: string;
        };
        PublicListingCard: {
            /** Format: uuid */
            id: string;
            purpose: components["schemas"]["PurposeEnum"];
            category: components["schemas"]["CategoryEnum"];
            subtype: components["schemas"]["SubtypeEnum"];
            title: string | null;
            fields: components["schemas"]["PublicCardFields"];
            city: components["schemas"]["Place"] | null;
            locality: components["schemas"]["Place"] | null;
            /** @description Relative path of the cover image on the media endpoint. */
            cover_url: string | null;
            /**
             * Format: date
             * @description The Asia/Karachi date of the first publication.
             */
            published_on: string;
        };
        /** @description The public projection plus the publication date and the names of the city and locality. */
        PublicListingDetail: {
            /** Format: uuid */
            id: string;
            purpose: components["schemas"]["PurposeEnum"];
            category: components["schemas"]["CategoryEnum"];
            subtype: components["schemas"]["SubtypeEnum"];
            title: string | null;
            description: string | null;
            fields: components["schemas"]["PublicFields"];
            /** @description The images in `position` order. */
            media: components["schemas"]["PublicImage"][];
            registry_version: number;
            city: components["schemas"]["Place"] | null;
            locality: components["schemas"]["Place"] | null;
            /**
             * Format: date
             * @description The Asia/Karachi date of the first publication.
             */
            published_on: string;
        };
        PublicListingPage: {
            results: components["schemas"]["PublicListingCard"][];
            /**
             * Format: uri
             * @description The next page; null on the last.
             */
            next: string | null;
        };
        PublicationAllowance: {
            /** @description The monthly limit in force now. */
            limit: number;
            /** @description Counted publications this Karachi month. */
            used: number;
            /** @description `max(limit - used, 0)`. */
            remaining: number;
            /**
             * Format: date-time
             * @description Start of the month, +05:00.
             */
            period_start: string;
            /**
             * Format: date-time
             * @description Start of the next month, +05:00.
             */
            resets_at: string;
            timezone: components["schemas"]["TimezoneEnum"];
        };
        /**
         * @description * `republish_counted` - republish_counted
         *     * `republish_free` - republish_free
         * @enum {string}
         */
        PublicationKindEnum: "republish_counted" | "republish_free";
        PublishBodyRequest: {
            /** @description The `revision` of the Draft the client last read. */
            base_revision: number;
        };
        /**
         * @description `409`: the error envelope plus, for `stale_revision`, the Listing as it is now under
         *     `current` and, for `quota_exhausted`, the caller's own numbers under `details`.
         */
        PublishConflict: {
            error: components["schemas"]["ErrorBody"];
            /** @description With `stale_revision` only. */
            current?: components["schemas"]["Listing"];
            /** @description With `quota_exhausted` only. */
            details?: components["schemas"]["QuotaDetails"];
        };
        /**
         * @description * `sale` - sale
         *     * `rent` - rent
         * @enum {string}
         */
        PurposeEnum: "sale" | "rent";
        QuotaDetails: {
            /** @description The caller's monthly limit. */
            limit: number;
            /** @description The caller's counted publications this month. */
            used: number;
            /**
             * Format: date-time
             * @description Start of the next Karachi month, +05:00.
             */
            resets_at: string;
        };
        QuotaLimitBodyRequest: {
            monthly_limit: number;
        };
        QuotaPolicy: {
            account_type: components["schemas"]["OwnerAccountTypeEnum"];
            monthly_limit: number;
            /**
             * Format: date-time
             * @description When this limit started, +05:00.
             */
            effective_from: string;
        };
        QuotaPolicyList: {
            items: components["schemas"]["QuotaPolicy"][];
        };
        QuotaUsage: {
            /** Format: uuid */
            account_id: string;
            /** @description Masked, such as `j***@example.com`. */
            email: string;
            account_type: components["schemas"]["OwnerAccountTypeEnum"];
            /** @description Counted publications this Karachi month. */
            used: number;
            /** @description The limit in force now for the account type. */
            limit: number;
        };
        QuotaUsagePage: {
            /**
             * Format: date-time
             * @description Start of the month, +05:00.
             */
            period_start: string;
            /**
             * Format: date-time
             * @description Start of the next month, +05:00.
             */
            resets_at: string;
            next: string | null;
            previous: string | null;
            results: components["schemas"]["QuotaUsage"][];
        };
        RegistrationAccepted: {
            status: components["schemas"]["RegistrationAcceptedStatusEnum"];
        };
        /**
         * @description * `check_your_email` - check_your_email
         * @enum {string}
         */
        RegistrationAcceptedStatusEnum: "check_your_email";
        Registry: {
            version: number;
            taxonomy: components["schemas"]["Taxonomy"];
            fields: components["schemas"]["RegistryField"][];
        };
        RegistryField: {
            /** @description Stable snake_case id. */
            id: string;
            type: components["schemas"]["TypeEnum"];
            requirement: components["schemas"]["FieldRequirementEnum"];
            /** @description Empty lists mean all values. */
            applicability: components["schemas"]["Applicability"];
            /** @description Enums only; null otherwise. */
            allowed_values: string[] | null;
            /** @description Enums narrowed by Listing purpose (purpose -> allowed values); else null. */
            allowed_values_by_purpose: {
                [key: string]: string[];
            } | null;
            /** @description Enums narrowed by Listing Subtype (Subtype -> allowed values, one entry per Subtype the field applies to); else null. When present it takes precedence over the choices in `allowed_values` for that Subtype. */
            allowed_values_by_subtype: {
                [key: string]: string[];
            } | null;
            /** @description A claim the seller makes (legal, approval, possession): show it as "Seller-declared", never as verified by EstateAI. */
            seller_declared: boolean;
            /**
             * @description Where a form groups the field: `terms` (price, sale and rent terms), `location` (city, locality, the public location text and the private address; group by `class`), `amenities` (the amenity map, from the catalogue at `/api/v1/reference/amenities`) or `details`. Read this, never guess from applicability.
             *
             *     * `details` - details
             *     * `terms` - terms
             *     * `location` - location
             *     * `amenities` - amenities
             */
            section: components["schemas"]["SectionEnum"];
            /** @description Text only: minimum characters after normalisation. */
            min_length: number | null;
            /** @description Text only: maximum characters after normalisation. */
            max_length: number | null;
            /** @description Money, decimal and integer: smallest value, a decimal string. Date: the earliest date, `YYYY-MM-DD`. */
            min: string | null;
            /** @description Money, decimal and integer: largest value, a decimal string. Date: the latest date, `YYYY-MM-DD`. */
            max: string | null;
            /** @description Money only: `PKR`. */
            currency: string | null;
            /** @description Decimal only: the number of decimals stored and returned. */
            scale: number | null;
            /** @description Reference fields only: what the stored uuid points at, `city` or `locality`. The lists are `/api/v1/reference/cities` and `/api/v1/reference/cities/{city_id}/localities`; the value is the uuid, never a name. */
            reference: string | null;
            /** @description Computed by the server from other fields; read-only, never accepted as input. */
            derived: boolean;
            /** @description What the value means, for the form; null when not needed. */
            description: string | null;
            /** Class */
            class_: components["schemas"]["FieldClassEnum"];
            searchable: boolean;
            sortable: boolean;
            ai_extractable: boolean;
            valuation_input: boolean;
            quota_identity: boolean;
        };
        /**
         * @description * `day` - day
         *     * `week` - week
         *     * `month` - month
         *     * `year` - year
         * @enum {string}
         */
        RentalPeriodEnum: "day" | "week" | "month" | "year";
        /** @description The owner Listing plus how the republication was recorded (Story 2.18). */
        RepublishedListing: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["ListingStatusEnum"];
            visibility: components["schemas"]["VisibilityEnum"];
            revision: number;
            registry_version: number;
            fields: components["schemas"]["ListingFields"];
            /** @description Registry field id -> where the value came from; set fields only. */
            provenance: {
                [key: string]: components["schemas"]["ProvenanceEntry"];
            };
            /** @description The images in `position` order; empty when there are none. */
            media: components["schemas"]["Image"][];
            /** @description Set by moderation: a restricted Listing is never public and the owner cannot edit it (it may still be archived). Owner resource only, never in a public shape. */
            restricted: boolean;
            /** @description A short plain-text reason for a restricted or removed Listing, shown to the owner only; null otherwise. */
            restriction_reason: string | null;
            /**
             * @description `republish_counted` used one of the owner's monthly publications; `republish_free` used none (same Karachi month as the last counted publication, identity unchanged).
             *
             *     * `republish_counted` - republish_counted
             *     * `republish_free` - republish_free
             */
            publication_kind: components["schemas"]["PublicationKindEnum"];
        };
        /**
         * @description * `main_road` - main_road
         *     * `secondary_road` - secondary_road
         *     * `inner_street` - inner_street
         * @enum {string}
         */
        RoadAccessEnum: "main_road" | "secondary_road" | "inner_street";
        /**
         * @description * `details` - details
         *     * `terms` - terms
         *     * `location` - location
         *     * `amenities` - amenities
         * @enum {string}
         */
        SectionEnum: "details" | "terms" | "location" | "amenities";
        /** @description Exactly `email` and `password`, both strings. Nothing else is accepted. */
        SignInRequest: {
            /** @description The account email; matched case-insensitively. */
            email: string;
            /** @description The account password. */
            password: string;
        };
        /**
         * @description * `email_unverified` - email_unverified
         *     * `active` - active
         *     * `suspended` - suspended
         *     * `deactivated` - deactivated
         * @enum {string}
         */
        StateEnum: "email_unverified" | "active" | "suspended" | "deactivated";
        StatusBodyRequest: {
            /** @description The `revision` of the Listing the client last read. */
            base_revision: number;
            /**
             * @description The status to move to: `archived`, `sold` or `rented`.
             *
             *     * `archived` - archived
             *     * `sold` - sold
             *     * `rented` - rented
             */
            status: components["schemas"]["StatusBodyStatusEnum"];
        };
        /**
         * @description * `archived` - archived
         *     * `sold` - sold
         *     * `rented` - rented
         * @enum {string}
         */
        StatusBodyStatusEnum: "archived" | "sold" | "rented";
        /**
         * @description * `house` - house
         *     * `apartment` - apartment
         *     * `residential_plot` - residential_plot
         *     * `commercial_plot` - commercial_plot
         *     * `plot_file` - plot_file
         *     * `shop` - shop
         *     * `office` - office
         * @enum {string}
         */
        SubtypeEnum: "house" | "apartment" | "residential_plot" | "commercial_plot" | "plot_file" | "shop" | "office";
        Taxonomy: {
            categories: components["schemas"]["TaxonomyCategory"][];
            purposes: string[];
        };
        TaxonomyCategory: {
            id: string;
            subtypes: string[];
        };
        /**
         * @description * `Asia/Karachi` - Asia/Karachi
         * @enum {string}
         */
        TimezoneEnum: "Asia/Karachi";
        /**
         * @description * `enum` - enum
         *     * `text` - text
         *     * `money` - money
         *     * `integer` - integer
         *     * `decimal` - decimal
         *     * `boolean` - boolean
         *     * `date` - date
         *     * `reference` - reference
         *     * `amenities` - amenities
         * @enum {string}
         */
        TypeEnum: "enum" | "text" | "money" | "integer" | "decimal" | "boolean" | "date" | "reference" | "amenities";
        UnreadCount: {
            unread: number;
        };
        VerificationRequestRequest: {
            /** @description The address to send a new link to. */
            email: string;
        };
        Verified: {
            status: components["schemas"]["EmailVerifiedStatusEnum"];
        };
        /**
         * @description * `private` - PRIVATE
         *     * `public` - PUBLIC
         * @enum {string}
         */
        VisibilityEnum: "private" | "public";
        /**
         * @description Stable error code catalogue.
         * @enum {string}
         */
        ErrorCode: "bad_request" | "validation_error" | "link_invalid" | "unauthenticated" | "invalid_credentials" | "forbidden" | "email_not_verified" | "publishing_unavailable" | "not_found" | "method_not_allowed" | "not_acceptable" | "stale_revision" | "conflict" | "quota_exhausted" | "correction_unavailable" | "storage_cap_exceeded" | "too_many_images" | "link_used" | "link_expired" | "unsupported_media_type" | "idempotency_key_reused" | "throttled" | "server_error" | "busy";
        ErrorEnvelope: {
            error: components["schemas"]["ErrorBody"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    admin_sign_in: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignInRequest"];
            };
        };
        responses: {
            /** @description Signed in */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActorSummary"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    reactivate_admin_account: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountReasonRequest"];
            };
        };
        responses: {
            /** @description Reactivated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountStatus"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    suspend_admin_account: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountReasonRequest"];
            };
        };
        responses: {
            /** @description Suspended */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountStatus"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    lookup_admin_account: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountLookupRequest"];
            };
        };
        responses: {
            /** @description The account */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminAccount"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_admin_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The administrator */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminMe"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_admin_quota_policy: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The limits */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuotaPolicyList"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    set_admin_quota_limit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_type: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["QuotaLimitBodyRequest"];
            };
        };
        responses: {
            /** @description The current limit */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuotaPolicy"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_admin_quota_usage: {
        parameters: {
            query?: {
                cursor?: string;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuotaUsagePage"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_agency_logo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agency_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The stored image bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/webp": string;
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_csrf_token: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The token */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CsrfToken"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    confirm_email_change: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailChangeConfirmRequest"];
            };
        };
        responses: {
            /** @description Email changed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailChanged"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    request_email_verification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationRequestRequest"];
            };
        };
        responses: {
            /** @description Check your email */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegistrationAccepted"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    confirm_email_verification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfirmEmailRequest"];
            };
        };
        responses: {
            /** @description Email verified */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Verified"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service and database are reachable */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Database unreachable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthUnavailable"];
                };
            };
        };
    };
    create_listing_draft: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DraftCreateRequest"];
            };
        };
        responses: {
            /** @description The new Draft */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Listing"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_listing: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The Listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Listing"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    delete_listing: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: Suspended, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found` */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `conflict`: the Listing is not a Draft */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    update_listing: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ListingUpdateRequest"];
            };
        };
        responses: {
            /** @description The updated Listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Listing"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Stale revision: the Listing changed; `current` holds it */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingConflict"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_listing_correction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The window */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionWindow"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `unauthenticated` */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `not_found` */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    correct_listing: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ListingCorrectionRequest"];
            };
        };
        responses: {
            /** @description The corrected Listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Listing"];
                };
            };
            /** @description `validation_error` */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `unauthenticated` */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: restricted, Suspended, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found` */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `stale_revision` (with `current`), `conflict` or `correction_unavailable` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionConflict"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    upload_listing_image: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["ImageUploadRequest"];
            };
        };
        responses: {
            /** @description The stored image */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Image"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `too_many_images` or `storage_cap_exceeded` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `busy`: image processing is at capacity; retry */
            503: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    set_listing_image_order: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImageOrderRequest"];
            };
        };
        responses: {
            /** @description The Listing, with its media */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Listing"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Stale revision: the Listing changed; `current` holds it */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingConflict"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    delete_listing_image: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                image_id: string;
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_listing_image_file: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                image_id: string;
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The stored image bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/webp": string;
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    preview_listing: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingPreview"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    publish_listing: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishBodyRequest"];
            };
        };
        responses: {
            /** @description The published Listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Listing"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `stale_revision`, `conflict` or `quota_exhausted` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublishConflict"];
                };
            };
            /** @description `idempotency_key_reused` */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    republish_listing: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishBodyRequest"];
            };
        };
        responses: {
            /** @description The republished Listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RepublishedListing"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `stale_revision`, `conflict` or `quota_exhausted` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublishConflict"];
                };
            };
            /** @description `idempotency_key_reused` */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    change_listing_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StatusBodyRequest"];
            };
        };
        responses: {
            /** @description The updated Listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Listing"];
                };
            };
            /** @description `validation_error` */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `unauthenticated` */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: Suspended, restricted, removed, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found` */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `stale_revision` (with `current`) or `conflict` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingConflict"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The caller */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActorSummary"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_agency_profile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The business profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgencyProfile"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    update_agency_profile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["PatchedAgencyProfileUpdateRequest"];
            };
        };
        responses: {
            /** @description The updated business profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgencyProfile"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    put_agency_logo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["ImageUploadRequest"];
            };
        };
        responses: {
            /** @description The stored image */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileImage"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `storage_cap_exceeded` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `busy`: image processing is at capacity; retry */
            503: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    delete_agency_logo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed (or there was none) */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_agency_logo_file: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The stored image bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/webp": string;
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    request_email_change: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailChangeRequest"];
            };
        };
        responses: {
            /** @description Check your email */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegistrationAccepted"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_my_listings: {
        parameters: {
            query?: {
                cursor?: string;
                page_size?: number;
                status?: "archived" | "draft" | "published" | "removed" | "rented" | "sold";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingPage"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_my_listing_counts: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The counts */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingCounts"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `unauthenticated` */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden` */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    change_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordRequest"];
            };
        };
        responses: {
            /** @description Password changed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasswordChanged"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_profile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Profile"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    update_profile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["PatchedProfileUpdateRequest"];
            };
        };
        responses: {
            /** @description The updated profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Profile"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    put_profile_image: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["ImageUploadRequest"];
            };
        };
        responses: {
            /** @description The stored image */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileImage"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `storage_cap_exceeded` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `busy`: image processing is at capacity; retry */
            503: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    delete_profile_image: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed (or there was none) */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_profile_image_file: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The stored image bytes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/webp": string;
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_my_publication_allowance: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The allowance */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationAllowance"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `unauthenticated` */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: administrator */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_notifications: {
        parameters: {
            query?: {
                cursor?: string;
                page_size?: number;
                state?: "all" | "unread";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPage"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    mark_notification_read: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                notification_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The notification */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Notification"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    mark_all_notifications_read: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description How many changed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Marked"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_unread_notification_count: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The count */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnreadCount"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    request_password_reset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordResetRequestRequest"];
            };
        };
        responses: {
            /** @description Check your email */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegistrationAccepted"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    confirm_password_reset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordResetConfirmRequest"];
            };
        };
        responses: {
            /** @description Password reset */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasswordResetDone"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_public_filters: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The filters */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicFilters"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_public_listings: {
        parameters: {
            query?: {
                /** @description Filter (amenities). */
                amenities?: string;
                /** @description Filter (range). */
                area_sqft_max?: string;
                /** @description Filter (range). */
                area_sqft_min?: string;
                /** @description Filter (range). */
                asking_price_max?: string;
                /** @description Filter (range). */
                asking_price_min?: string;
                /** @description Filter (range). */
                bathrooms_max?: number;
                /** @description Filter (range). */
                bathrooms_min?: number;
                /** @description Filter (range). */
                bedrooms_max?: number;
                /** @description Filter (range). */
                bedrooms_min?: number;
                /** @description Filter (choice). */
                category?: string;
                /** @description Filter (choice). */
                city?: string;
                cursor?: string;
                /** @description Filter (choice). */
                furnishing?: string;
                limit?: number;
                /** @description Filter (choice). */
                locality?: string;
                /** @description Filter (range). */
                parking_spaces_max?: number;
                /** @description Filter (range). */
                parking_spaces_min?: number;
                /** @description Preference: ranks, never excludes. */
                prefer_amenities?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_area_sqft_max?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_area_sqft_min?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_asking_price_max?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_asking_price_min?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_bathrooms_max?: number;
                /** @description Preference: ranks, never excludes. */
                prefer_bathrooms_min?: number;
                /** @description Preference: ranks, never excludes. */
                prefer_bedrooms_max?: number;
                /** @description Preference: ranks, never excludes. */
                prefer_bedrooms_min?: number;
                /** @description Preference: ranks, never excludes. */
                prefer_category?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_city?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_furnishing?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_locality?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_parking_spaces_max?: number;
                /** @description Preference: ranks, never excludes. */
                prefer_parking_spaces_min?: number;
                /** @description Preference: ranks, never excludes. */
                prefer_price_basis?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_purpose?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_rental_period?: string;
                /** @description Preference: ranks, never excludes. */
                prefer_subtype?: string;
                /** @description Filter (choice). */
                price_basis?: string;
                /** @description Filter (choice). */
                purpose?: string;
                /** @description Filter (choice). */
                rental_period?: string;
                sort?: "newest" | "price_asc" | "price_desc" | "relevance";
                /** @description Filter (choice). */
                subtype?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicListingPage"];
                };
            };
            /** @description `validation_error` */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_public_listing: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                listing_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The Listing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicListingDetail"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description `not_found` */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_amenities: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active amenities */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AmenityList"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_cities: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active cities by name */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CityList"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    list_localities: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                city_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active localities by name */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalityList"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    register_agency: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AgencyRegistrationRequest"];
            };
        };
        responses: {
            /** @description Check your email to continue */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegistrationAccepted"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    register_individual: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IndividualRegistrationRequest"];
            };
        };
        responses: {
            /** @description Check your email to continue */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegistrationAccepted"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    get_registry: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The registry */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Registry"];
                };
            };
            /** @description Not modified */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    sign_in: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignInRequest"];
            };
        };
        responses: {
            /** @description Signed in */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActorSummary"];
                };
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    sign_out: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed out */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request or validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Too many requests */
            429: {
                headers: {
                    /** @description Seconds to wait before retrying, when known. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
}
