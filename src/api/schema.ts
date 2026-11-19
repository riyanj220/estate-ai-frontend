/**
 * GENERATED FILE - DO NOT EDIT.
 * Generated from src/api/openapi.yaml by scripts/sync-api.mjs (npm run api:sync).
 */

export interface paths {
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Allowlist. Names are plain strings: city values are managed in the database. */
        City: {
            /** Format: uuid */
            id: string;
            name: string;
        };
        CityList: {
            items: components["schemas"]["City"][];
        };
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
        RegistrationAccepted: {
            status: components["schemas"]["RegistrationAcceptedStatusEnum"];
        };
        /**
         * @description * `check_your_email` - check_your_email
         * @enum {string}
         */
        RegistrationAcceptedStatusEnum: "check_your_email";
        /**
         * @description Stable error code catalogue.
         * @enum {string}
         */
        ErrorCode: "bad_request" | "validation_error" | "unauthenticated" | "forbidden" | "not_found" | "method_not_allowed" | "not_acceptable" | "stale_revision" | "unsupported_media_type" | "idempotency_key_reused" | "throttled" | "server_error";
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
}
