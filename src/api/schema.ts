/**
 * GENERATED FILE - DO NOT EDIT.
 * Generated from src/api/openapi.yaml by scripts/sync-api.mjs (npm run api:sync).
 */

export interface paths {
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
        /**
         * @description * `individual` - individual
         *     * `agency` - agency
         *     * `admin` - admin
         * @enum {string}
         */
        AccountTypeEnum: "individual" | "agency" | "admin";
        ActorSummary: {
            /** Format: uuid */
            id: string;
            account_type: components["schemas"]["AccountTypeEnum"];
            state: components["schemas"]["StateEnum"];
            /** @description The account's own email. Private: owner only. */
            email: string;
            /** @description Individual profile name; empty when none. */
            full_name: string;
            /** @description Agency name (public); empty for non-agency accounts. */
            agency_name: string;
            capabilities: components["schemas"]["CapabilitiesEnum"][];
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
        ConfirmEmailRequest: {
            /** @description The token from the verification link. */
            token: string;
        };
        CsrfToken: {
            csrf_token: string;
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
        PatchedProfileUpdateRequest: {
            /** @description 2 to 80 characters. */
            full_name?: string;
            /** @description Pakistani mobile or international number. Mandatory: blank or null is refused. */
            phone?: string | null;
        };
        Profile: {
            full_name: string;
            /** @description The owner's own phone number in E.164. Private: returned only here. */
            phone: string;
            /** @description The current sign-in address. */
            email: string;
            /** @description The address of the newest unused, unexpired email-change request, or null. */
            pending_email: string | null;
        };
        RegistrationAccepted: {
            status: components["schemas"]["RegistrationAcceptedStatusEnum"];
        };
        /**
         * @description * `check_your_email` - check_your_email
         * @enum {string}
         */
        RegistrationAcceptedStatusEnum: "check_your_email";
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
        VerificationRequestRequest: {
            /** @description The address to send a new link to. */
            email: string;
        };
        Verified: {
            status: components["schemas"]["EmailVerifiedStatusEnum"];
        };
        /**
         * @description Stable error code catalogue.
         * @enum {string}
         */
        ErrorCode: "bad_request" | "validation_error" | "link_invalid" | "unauthenticated" | "invalid_credentials" | "forbidden" | "not_found" | "method_not_allowed" | "not_acceptable" | "stale_revision" | "link_used" | "link_expired" | "unsupported_media_type" | "idempotency_key_reused" | "throttled" | "server_error";
        ErrorBody: {
            code: components["schemas"]["ErrorCode"];
            message: string;
            fields: {
                [key: string]: string[];
            };
            request_id: string;
        };
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
