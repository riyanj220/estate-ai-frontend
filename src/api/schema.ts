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
    "/api/v1/admin/closure-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Closure requests in one status, oldest first
         * @description 20 per page; `next` is a link, `previous` is always null. `status` defaults to `pending`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["list_admin_closure_requests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/closure-requests/{request_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve: deactivate and erase the account
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a decided request is `409 conflict`. Cannot be undone. In one transaction the account is deactivated and anonymised and its Listings archived; it is emailed. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["approve_admin_closure_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/closure-requests/{request_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reject: the account stays as it is
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a decided request is `409 conflict`. The account is told in-app and by email. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["reject_admin_closure_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/flags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Advisory duplicate and suspicious Listing flags, newest first
         * @description 20 per page; `next` is a link, `previous` is always null. Flags change nothing. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["list_admin_flags"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listings for review, newest first
         * @description 20 per page; `next` is a link, `previous` is always null. Without `status` every non-Draft Listing; `status=draft` lists Drafts without their content. `owner` is an account id; the dates are Karachi calendar days, inclusive. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["list_admin_listings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings/{listing_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One non-Draft Listing with its content, images, actions and history
         * @description A Draft is `404 not_found` here: use the reasoned read. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["get_admin_listing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings/{listing_id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Move a removed Listing to archived
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; an action not open for this Listing now is `409 conflict`. The owner is notified with the reason. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["archive_admin_listing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings/{listing_id}/lift-restriction": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Lift a restriction
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; an action not open for this Listing now is `409 conflict`. The owner is notified with the reason. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["lift_admin_listing_restriction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings/{listing_id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Read a Draft's content, with a reason
         * @description Needs `X-CSRFToken`. A reasoned private read recorded in the audit trail. Images are counted, not served. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["read_admin_draft_listing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings/{listing_id}/remove": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Remove a published Listing
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; an action not open for this Listing now is `409 conflict`. The owner is notified with the reason. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["take_down_admin_listing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings/{listing_id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restore a removed Listing to published
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; an action not open for this Listing now is `409 conflict`. The owner is notified with the reason. Consumes no publication; a restriction stays in force. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["restore_admin_listing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/listings/{listing_id}/restrict": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restrict a published or archived Listing
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; an action not open for this Listing now is `409 conflict`. The owner is notified with the reason. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["restrict_admin_listing"];
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
    "/api/v1/admin/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Reports in one status, oldest first, with unresolved counts
         * @description 20 per page; `next` is a link, `previous` is always null. `status` defaults to `pending`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["list_admin_reports"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reports/{report_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One Report with its snapshot and review history
         * @description Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["get_admin_report"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reports/{report_id}/dismiss": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Dismiss a Report being reviewed, with notes
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a Report in another status is `409 conflict`. The Listing is not changed. The reporter is notified. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["dismiss_admin_report"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reports/{report_id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Read the reported Messages of a Conversation Report, with a recorded reason
         * @description Needs `X-CSRFToken`. Every read is audited with its reason. Returns the reported Messages and the few before them, never the rest of the Conversation. A Listing Report or an unknown id is `404 not_found`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["read_admin_report_messages"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reports/{report_id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve a Report being reviewed, with notes
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a Report in another status is `409 conflict`. The Listing is not changed. The reporter is notified. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["resolve_admin_report"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reports/{report_id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start reviewing a pending Report
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a Report in another status is `409 conflict`. The Listing is not changed. The Listing shows as under review. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["start_admin_report_review"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/verification-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Verification requests in one status, oldest first
         * @description 20 per page; `next` is a link, `previous` is always null. `status` defaults to `pending`; `verified` lists the approvals that can be revoked. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        get: operations["list_admin_verification_requests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/verification-requests/{request_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve a pending request
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a request in another status is `409 conflict`. The Agency is notified. A Suspended or Deactivated Agency is `409`. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["approve_admin_verification_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/verification-requests/{request_id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Read one request's submitted details and history, with a reason
         * @description Needs `X-CSRFToken`. A reasoned private read: `reason` (10 to 300 characters, one line, no contact details) is recorded in the audit trail. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["read_admin_verification_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/verification-requests/{request_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reject a pending request, with a reason
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a request in another status is `409 conflict`. The Agency is notified. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["reject_admin_verification_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/verification-requests/{request_id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke an approval, with a reason
         * @description Needs `X-CSRFToken`. An unknown id is `404 not_found`; a request in another status is `409 conflict`. The Agency is notified. The Agency's Listings stay published. Visitors get `401 unauthenticated`; signed-in non-administrators get `404 not_found`. Never cached.
         */
        post: operations["revoke_admin_verification"];
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
    "/api/v1/assistant/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create or open the assistant session of a Draft
         * @description Needs `X-CSRFToken`. One open session per Draft.
         */
        post: operations["open_assistant_session"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assistant/sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * An assistant session and its history
         * @description Every answer of the view, errors included, is `no-store`.
         */
        get: operations["get_assistant_session"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assistant/sessions/{session_id}/description": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Write the description from the confirmed details
         * @description Needs `X-CSRFToken`. One model call; counts as an assistant message. The text is saved to the Draft as an unconfirmed assistant value. Nothing is published.
         */
        post: operations["write_assistant_description"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assistant/sessions/{session_id}/turns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send one message to the assistant
         * @description Needs `X-CSRFToken`. May take up to about 30 seconds. When the assistant cannot answer it is `200` with an `outcome` other than `success`, `turn` null and a message to show; the Draft and the history are unchanged, and the same `client_turn_id` may be sent again. Repeating an answered `client_turn_id` returns that turn without processing it again; `next_step` and `summary` show the Draft as it is now. At most 30 messages an hour.
         */
        post: operations["send_assistant_turn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The caller's inbox, or its own inquiry about a Listing
         * @description Without `listing_id`: every Conversation the caller takes part in, latest activity first, 20 a page (`cursor` = the previous `next`). With `listing_id`: `results` holds at most the one Conversation the caller started about that Listing. No Message text. Never cached.
         */
        get: operations["list_conversations"];
        put?: never;
        /**
         * Send an inquiry about a Listing
         * @description Needs `X-CSRFToken` and an `Idempotency-Key` header, which is the client message id: the same key and body again answers with the Message already saved, another body is `422 idempotency_key_reused`. `body` is 1 to 2,000 characters. A Message in a response is saved. 60 Messages a minute per account. At most one Conversation per Listing and account: starting again sends into it (`200`), or only returns it with `message: null` when it is read-only. 20 new Conversations a day per account.
         */
        post: operations["start_conversation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations/{conversation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One Conversation of the caller's
         * @description Participants only; anyone else gets `not_found`. Never cached.
         */
        get: operations["get_conversation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations/{conversation_id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The Messages of a Conversation, oldest first
         * @description Those with `seq` above `after` (default 0), at most 200. Participants only. Never cached.
         */
        get: operations["list_messages"];
        put?: never;
        /**
         * Send a Message in a Conversation
         * @description Needs `X-CSRFToken` and an `Idempotency-Key` header, which is the client message id: the same key and body again answers with the Message already saved, another body is `422 idempotency_key_reused`. `body` is 1 to 2,000 characters. A Message in a response is saved. 60 Messages a minute per account.
         */
        post: operations["send_message"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations/{conversation_id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * The caller has read a Conversation up to a Message
         * @description Needs `X-CSRFToken`. Participants only. The mark never goes back, nor past the newest Message. A suspended participant may mark too.
         */
        post: operations["mark_conversation_read"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations/{conversation_id}/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Report Messages of a Conversation the caller takes part in
         * @description Needs `X-CSRFToken`. The Report keeps the selected Messages and up to 5 sent just before them. A Visitor is `401`; a Suspended account or an administrator `403 forbidden`; a Conversation the caller is not in `404 not_found`; an id that is not a Message of the other participant is a `message_ids` error; one of yours already open `409 conflict`; at most 10 Reports a day (`429 throttled`). Never cached.
         */
        post: operations["report_conversation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations/unread-count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * How many of the caller's Conversations have unread Messages
         * @description Every answer of the view, errors included, is `no-store`.
         */
        get: operations["get_unread_conversation_count"];
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
    "/api/v1/estimates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * AI Price Estimate for entered property details
         * @description Needs `X-CSRFToken`. An unsupported property is `200` with `status: unavailable`. Shares the limit of 20 requests an hour with the Draft route. Never cached.
         */
        post: operations["request_estimate"];
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
    "/api/v1/listings/{listing_id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm values on one of the signed-in account's own Drafts
         * @description Needs `X-CSRFToken`. Marks the stored value of each named field as confirmed by the owner. An unconfirmed assistant value of a sensitive field blocks publication.
         */
        post: operations["confirm_listing_fields"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
    "/api/v1/listings/{listing_id}/estimate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * AI Price Estimate for one of the account's own Drafts or Published Listings
         * @description Needs `X-CSRFToken`. No body. Uses the saved Listing; for a Published one this is the owner's recompute. The Asking price is neither read nor changed. Never cached.
         */
        post: operations["request_listing_estimate"];
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
         * @description The media endpoint: the only place an image is served, decided at request time by the single visibility policy. An image of a public Listing (Published, not restricted, owner Active) goes to anyone, a Visitor and an administrator included, with `Cache-Control: public, max-age=60` (so it may stay in a cache for up to a minute after the Listing stops being public), no cookie and nothing varying by cookie, whatever cookies the request carries. An image of any other Listing (a Draft, a restricted one, one whose owner is Suspended or Deactivated) goes only to the owning account (Suspended and Email-unverified owners included, a Deactivated one not) with `Cache-Control: private, no-store`; an administrator also gets non-Draft images for moderation review, never cached. Anyone else (another account, a Visitor), an unknown or malformed id and another Listing's image get the same `404 not_found` (a Visitor gets 404, never 401). The body is the stored, re-encoded image with its stored `Content-Type` (`image/jpeg`, `image/png` or `image/webp`), `Content-Length`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` (no file name) and `Content-Security-Policy: default-src 'none'; sandbox`. `HEAD` answers the same headers without a body. `Range` is ignored (always `200`, the whole file) and there is no `ETag`. `Accept` is ignored.
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
         * @description Owner only, for the account's own Listing in any status (draft, published, archived, sold, rented, removed). The body is the public projection (the same fields a visitor would get, built by the same function): never a private address, coordinates, a phone number, the revision, the provenance or the status. `media` lists the images in the public shape; their `url` is the media endpoint, which serves a Draft's image to its owner only. `estimate` is the latest AI Price Estimate requested for the Listing, or `null` when there is none or the saved details changed since; reading it computes nothing. Another account's, an administrator's, an unknown and a malformed id are all `404 not_found`. A Visitor gets `401`. Opening the preview counts as opening the Draft (it postpones the idle-Draft notice). Never cached.
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
    "/api/v1/listings/{listing_id}/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Report a publicly visible Listing
         * @description Needs `X-CSRFToken`. A Visitor is `401`; a Suspended account or an administrator `403 forbidden`; a Listing that is not public `404 not_found`; your own `403 forbidden`; one of yours already open `409 conflict`; at most 10 Reports a day (`429 throttled`). The Listing is not changed. Never cached.
         */
        post: operations["report_listing"];
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
    "/api/v1/me/agency-dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Agency's totals
         * @description Agency accounts only (a Suspended one may read). Listings by status and in total, inquiries received and detail views. The publication allowance is `/me/publication-allowance` and the inbox `/conversations`. Never cached.
         */
        get: operations["get_agency_dashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/agency-dashboard/listings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Agency's Listings with views and inquiries
         * @description The Agency's own Listings only, newest first, 20 per page (`page_size` up to 50). The filters combine; an empty one is ignored. The dates are Asia/Karachi dates of creation, both inclusive. A bad value is `validation_error`; so is a `cursor` issued for other filters. Never cached.
         */
        get: operations["list_agency_dashboard_listings"];
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
    "/api/v1/me/agency-verification": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in Agency's Verification status and latest request
         * @description Agency accounts only: others get `403 forbidden`, a Visitor `401`. Never cached. A Suspended Agency may read.
         */
        get: operations["get_agency_verification"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/agency-verification/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Request Verification
         * @description Agency accounts only: others get `403 forbidden`, a Visitor `401`. Never cached. Needs `X-CSRFToken`. No document is uploaded. `409 conflict` while a request is pending or the Agency is already verified; a Suspended Agency is `403`.
         */
        post: operations["submit_agency_verification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/agency-verification/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Withdraw the pending Verification request
         * @description Agency accounts only: others get `403 forbidden`, a Visitor `401`. Never cached. Needs `X-CSRFToken`. `409 conflict` when none is pending.
         */
        post: operations["withdraw_agency_verification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/closure-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The caller's latest closure request
         * @description Individual and Agency accounts, Suspended ones included; an administrator is `403 forbidden`, a Visitor `401 unauthenticated`. Never cached.
         */
        get: operations["get_own_closure"];
        put?: never;
        /**
         * Ask for the account to be deactivated or deleted
         * @description Needs `X-CSRFToken`. The account stays as it is until an administrator decides; `409 conflict` while a request is pending. Individual and Agency accounts, Suspended ones included; an administrator is `403 forbidden`, a Visitor `401 unauthenticated`. Never cached.
         */
        post: operations["request_own_closure"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/closure-requests/{request_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One of the caller's closure requests
         * @description Another account's or an unknown id is `404 not_found`. Individual and Agency accounts, Suspended ones included; an administrator is `403 forbidden`, a Visitor `401 unauthenticated`. Never cached.
         */
        get: operations["get_own_closure_request"];
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
    "/api/v1/me/favourites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in account's favourites, latest saved first
         * @description Own favourites only (Individual and Agency accounts; `forbidden` for others). A saved Listing that is no longer publicly visible has `listing: null` and nothing else about it. 20 per page, `page_size` up to 50; a bad `cursor` is `validation_error`. Never cached.
         */
        get: operations["list_favourites"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/favourites/{listing_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Save a Listing to favourites
         * @description Needs `X-CSRFToken`. No body. Idempotent: saving a saved Listing is `204` again. Only a publicly visible Listing can be newly saved; anything else is `not_found`.
         */
        put: operations["save_favourite"];
        post?: never;
        /**
         * Remove a Listing from favourites
         * @description Needs `X-CSRFToken`. The Listing itself is not touched. A Listing the account has not saved is `not_found`.
         */
        delete: operations["remove_favourite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/favourites/ids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The ids of the Listings the account has saved
         * @description All of them (at most 500), for the Save buttons. Never cached.
         */
        get: operations["list_favourite_ids"];
        put?: never;
        post?: never;
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
    "/api/v1/me/reports/{report_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One of the caller's own Reports
         * @description Another account's, an unknown and a malformed id are `404 not_found`. The review notes are never shown. Never cached.
         */
        get: operations["get_own_report"];
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
    "/api/v1/public/agencies/{agency_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * An Agency's public profile
         * @description Public; the answer is the same for every caller. Only the name, logo route, description and verification: never the business phone, office address, email, city or account. `agency_id` is `advertiser.agency_id` of a Listing. Only an Active Agency: a Suspended, Deactivated or unverified one, an unknown, malformed or non-agency id are the same `404 not_found`. `200` has `Cache-Control: public, max-age=60` and no cookie (so a profile may stay in a cache for up to a minute); errors are `no-store`.
         */
        get: operations["get_public_agency"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/agencies/{agency_id}/listings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Browse and filter one Agency's published Listings
         * @description `GET /api/v1/public/listings` narrowed to one Agency: the same visibility, filters, preferences, sorts, `limit`, `cursor`, errors and caching. An Agency whose profile is `404 not_found` is the same `404` here, whatever the parameters.
         */
        get: operations["list_public_agency_listings"];
        put?: never;
        post?: never;
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
         * @description Public; the answer is the same for every caller, the owner included. The public projection only: never a private address, coordinates, a phone number, the owner account, the status, the revision or the provenance. Of the owner, `advertiser` gives only the type and, for an Agency, its public id, name, logo and verification. `nearby` amenities are the seller's own declaration. A Listing that is not publicly visible, an unknown and a malformed id are the same `404 not_found`. `200` has `Cache-Control: public, max-age=60` and no cookie; errors are `no-store`.
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
    "/api/v1/public/listings/{listing_id}/estimate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Estimated Property Value and forecast of one published Listing
         * @description Public. The stored estimate of the Listing's current details with the comparison and 5-year forecast. A Visitor only reads what is stored; for a signed-in account a missing or outdated estimate is computed first. A Listing that is not publicly visible, an unknown and a malformed id are the same `404 not_found`. Never cached.
         */
        get: operations["get_listing_estimate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/listings/{listing_id}/views": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Count one view of a published Listing
         * @description Sent by the page after it has shown the Listing. No body. A signed-in caller needs `X-CSRFToken`. `204` whether or not it counted: the owner, administrators, known bots, a repeat from the same browser within 30 minutes and an over-eager network are not counted. Only a total per Listing is kept; no cookie is set. A Listing that is not publicly visible is `not_found`.
         */
        post: operations["record_listing_view"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Turn a search written in plain words into filters
         * @description Public; needs `X-CSRFToken`. One AI call on redacted text; the request is not stored. `200` with `status: fallback` when the AI is off, unavailable, too slow, out of budget or gave nothing usable. Limits: 10 a minute per Visitor, 30 an hour per account (`429` with `Retry-After`). Never cached.
         */
        post: operations["interpret_search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/public/search/transcription": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Turn a spoken search into text
         * @description Public; needs `X-CSRFToken` and a `multipart/form-data` body with exactly one part, `audio`. The type is decided from the bytes (WebM, Ogg, MP4 or WAV). The recording is sent to the AI provider with no account data and is not stored or logged. The transcript is not searched: send it, as the buyer confirms it, to `interpret_search`, which is what counts as a search. `200` with `status: fallback` when the AI is off, unavailable, too slow, out of budget or heard nothing. `400 validation_error` carries a code under `fields.audio`. Limits: 10 a minute per Visitor, 30 an hour per account (`429` with `Retry-After`). Never cached.
         */
        post: operations["transcribe_search"];
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
        AccountRef: {
            type: string;
            masked_email: string;
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
        AdminClosureQueue: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["AdminClosureRequest"][];
        };
        AdminClosureRequest: {
            /** Format: uuid */
            id: string;
            kind: components["schemas"]["ClosureKindEnum"];
            status: components["schemas"]["ClosureStatusEnum"];
            /** Format: uuid */
            account_id: string;
            account_type: string | null;
            /** @description `email_unverified`, `active`, `suspended` or `deactivated`. */
            account_state: string | null;
            /** @description Null once closed. */
            masked_email: string | null;
            /** Format: date-time */
            submitted_at: string;
            /** Format: date-time */
            decided_at: string | null;
            decision_reason: string;
        };
        AdminListingDetail: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            owner_account_id: string;
            owner: components["schemas"]["AccountRef"] | null;
            status: components["schemas"]["ListingStatusEnum"];
            restricted: boolean;
            under_review: boolean;
            purpose: string;
            category: string;
            subtype: string;
            /** @description Always null for a Draft. */
            title: string | null;
            /** Format: date-time */
            created_at: string;
            description: string | null;
            /** @description Public registry fields that have a value. */
            attributes: {
                [key: string]: unknown;
            };
            city: string | null;
            locality: string | null;
            /** @description Empty for a Draft. */
            media: components["schemas"]["PublicImage"][];
            image_count: number;
            moderation_reason: string | null;
            /** @description What can be done now. */
            actions: components["schemas"]["ModerationActionEnum"][];
            /** Format: date-time */
            first_published_at: string | null;
            open_reports: number;
            history: components["schemas"]["ModerationRecord"][];
        };
        AdminListingPage: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["AdminListingRow"][];
        };
        AdminListingRow: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            owner_account_id: string;
            owner: components["schemas"]["AccountRef"] | null;
            status: components["schemas"]["ListingStatusEnum"];
            restricted: boolean;
            under_review: boolean;
            purpose: string;
            category: string;
            subtype: string;
            /** @description Always null for a Draft. */
            title: string | null;
            /** Format: date-time */
            created_at: string;
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
        /** @description Who advertises the Listing (FR-39). Nothing else about the owner is public here. */
        Advertiser: {
            type: components["schemas"]["OwnerAccountTypeEnum"];
            /**
             * Format: uuid
             * @description Agencies only: the public profile id (`/api/v1/public/agencies/{agency_id}`).
             */
            agency_id: string | null;
            /** @description Agencies only. */
            agency_name: string | null;
            /** @description Agencies only: the public logo route; null without a logo. */
            logo_url: string | null;
            /** @description An Agency with Verification granted. Always false for now. */
            verified: boolean;
        };
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
            /** @description Read-only: `verified` after an administrator approval, else `unverified`. */
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
        AssistantApplied: {
            /** @description A registry field id. */
            field: string;
            /** @description As on the Listing: text, integer or boolean. */
            value: unknown;
        };
        AssistantClaim: {
            /** @description One sentence of the description. Plain text. */
            text: string;
            /** @description The confirmed fields it rests on. */
            fields: string[];
        };
        AssistantDescriptionBodyRequest: {
            /** @description The `revision` of the Draft the client last read. */
            base_revision: number;
            /** @description True to overwrite a description the Seller wrote. */
            replace?: boolean;
        };
        AssistantDescriptionResult: {
            outcome: components["schemas"]["OutcomeEnum"];
            message: string;
            /** @description With the saved description (unconfirmed); null unless `success`. */
            listing: components["schemas"]["Listing"] | null;
            /** @description The per-claim checklist. */
            claims: components["schemas"]["AssistantClaim"][];
            /** @description Fields not used: not confirmed yet. */
            left_out: string[];
        };
        AssistantFact: {
            /** @description A registry field id. */
            field: string;
            /** @description Plain text. */
            value: string;
            /** @description False for an unconfirmed assistant value. */
            confirmed: boolean;
        };
        AssistantNextStep: {
            kind: components["schemas"]["AssistantNextStepKindEnum"];
            /** @description Plain text. */
            question: string;
            /** @description The missing required fields asked about; empty for `review`. */
            fields_asked: string[];
            /** @description Missing optional fields the Seller may add. */
            optional: string[];
            /** @description True when only the manual form can set it. */
            in_form: boolean;
        };
        /**
         * @description * `required` - required
         *     * `review` - review
         * @enum {string}
         */
        AssistantNextStepKindEnum: "required" | "review";
        AssistantRejected: {
            field: string;
            /** @description The same codes as a Listing edit. */
            code: string;
        };
        AssistantSession: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            listing_id: string;
            registry_version: number;
            schema_version: number;
            /** Format: date-time */
            created_at: string;
            /** @description Show it beside any source. */
            knowledge_notice: string;
            /** @description Oldest first. */
            turns: components["schemas"]["AssistantTurn"][];
            /** @description Null when the Listing is no longer a Draft. */
            next_step: components["schemas"]["AssistantNextStep"] | null;
            /** @description What the Listing holds now. */
            summary: components["schemas"]["AssistantFact"][];
        };
        AssistantSessionOpenRequest: {
            /**
             * Format: uuid
             * @description The caller's own Draft.
             */
            listing_id: string;
        };
        AssistantSource: {
            title: string;
            source: string;
            version: number;
        };
        AssistantTurn: {
            /** Format: uuid */
            id: string;
            sequence: number;
            /** Format: uuid */
            client_turn_id: string;
            /** @description The caller's message after redaction. Plain text. */
            message: string;
            /** @description The assistant's reply. Plain text. */
            reply: string;
            /** @description Knowledge base passages given to the assistant for this reply. */
            sources: components["schemas"]["AssistantSource"][];
            /** Format: date-time */
            created_at: string;
            /** @description Saved to the Draft, unconfirmed. */
            applied: components["schemas"]["AssistantApplied"][];
            /** @description Understood but not saved. */
            rejected: components["schemas"]["AssistantRejected"][];
            /** @description Fields the Seller changed while the assistant worked: left as they were. */
            conflicts: string[];
            /** @description Plain text. */
            notices: string[];
        };
        AssistantTurnBodyRequest: {
            message: string;
            /**
             * Format: uuid
             * @description A new UUID for each message; send the same one to repeat a request.
             */
            client_turn_id: string;
        };
        AssistantTurnResult: {
            outcome: components["schemas"]["OutcomeEnum"];
            /** @description A notice to show; empty when there is nothing to say. */
            message: string;
            /** @description Null unless `success`: nothing was stored. */
            turn: components["schemas"]["AssistantTurn"] | null;
            /** @description Null unless `success`. */
            next_step: components["schemas"]["AssistantNextStep"] | null;
            /** @description Empty unless `success`. */
            summary: components["schemas"]["AssistantFact"][];
        };
        /**
         * @description * `available` - available
         *     * `sold` - sold
         *     * `rented` - rented
         *     * `unavailable` - unavailable
         * @enum {string}
         */
        AvailabilityEnum: "available" | "sold" | "rented" | "unavailable";
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
        ClosureDecisionRequest: {
            /** @description One line, without contact details. The account holder reads it. */
            reason: string;
        };
        /**
         * @description * `deactivation` - deactivation
         *     * `deletion` - deletion
         * @enum {string}
         */
        ClosureKindEnum: "deactivation" | "deletion";
        ClosureRequest: {
            /** Format: uuid */
            id: string;
            kind: components["schemas"]["ClosureKindEnum"];
            status: components["schemas"]["ClosureStatusEnum"];
            /** Format: date-time */
            submitted_at: string;
            /** Format: date-time */
            decided_at: string | null;
            /** @description Empty while pending. */
            decision_reason: string;
        };
        /**
         * @description * `pending` - pending
         *     * `approved` - approved
         *     * `rejected` - rejected
         * @enum {string}
         */
        ClosureStatusEnum: "pending" | "approved" | "rejected";
        ClosureSubmitRequest: {
            kind: components["schemas"]["ClosureKindEnum"];
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
         *     * `messaging_email_unverified` - messaging_email_unverified
         *     * `messaging_unavailable` - messaging_unavailable
         *     * `not_found` - not_found
         *     * `method_not_allowed` - method_not_allowed
         *     * `not_acceptable` - not_acceptable
         *     * `stale_revision` - stale_revision
         *     * `conflict` - conflict
         *     * `quota_exhausted` - quota_exhausted
         *     * `correction_unavailable` - correction_unavailable
         *     * `storage_cap_exceeded` - storage_cap_exceeded
         *     * `too_many_images` - too_many_images
         *     * `own_listing` - own_listing
         *     * `conversation_read_only` - conversation_read_only
         *     * `counterpart_unavailable` - counterpart_unavailable
         *     * `link_used` - link_used
         *     * `link_expired` - link_expired
         *     * `unsupported_media_type` - unsupported_media_type
         *     * `idempotency_key_reused` - idempotency_key_reused
         *     * `throttled` - throttled
         *     * `server_error` - server_error
         *     * `busy` - busy
         * @enum {string}
         */
        CodeEnum: "bad_request" | "validation_error" | "link_invalid" | "unauthenticated" | "invalid_credentials" | "forbidden" | "email_not_verified" | "publishing_unavailable" | "messaging_email_unverified" | "messaging_unavailable" | "not_found" | "method_not_allowed" | "not_acceptable" | "stale_revision" | "conflict" | "quota_exhausted" | "correction_unavailable" | "storage_cap_exceeded" | "too_many_images" | "own_listing" | "conversation_read_only" | "counterpart_unavailable" | "link_used" | "link_expired" | "unsupported_media_type" | "idempotency_key_reused" | "throttled" | "server_error" | "busy";
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
        Conversation: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            listing_id: string;
            listing: components["schemas"]["ConversationListing"];
            role: components["schemas"]["RoleEnum"];
            /** @description Null when the other account is no longer available. */
            counterpart_name: string | null;
            /** @description Whether the caller may send now. */
            writable: boolean;
            read_only_reason: (components["schemas"]["ReadOnlyReasonEnum"] | components["schemas"]["NullEnum"]) | null;
            last_seq: number;
            /** Format: date-time */
            last_message_at: string;
            /** Format: date-time */
            created_at: string;
            /** @description Messages of the other participant that the caller has not read. */
            unread_count: number;
        };
        ConversationList: {
            results: components["schemas"]["Conversation"][];
            /** @description The `cursor` of the following inbox page. */
            next: string | null;
        };
        ConversationListing: {
            availability: components["schemas"]["AvailabilityEnum"];
            /** @description Only while the Listing is publicly visible. */
            title: string | null;
        };
        ConversationReportCreateRequest: {
            reason: components["schemas"]["ReportReasonEnum"];
            description?: string;
            /** @description Messages of the other participant in this Conversation. */
            message_ids: string[];
        };
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
        Dashboard: {
            total_listings: number;
            by_status: components["schemas"]["ListingCounts"];
            /** @description Conversations others started about the Agency's Listings. */
            inquiries_total: number;
            views_total: number;
        };
        DashboardListing: {
            /** Format: uuid */
            id: string;
            title: string | null;
            status: components["schemas"]["ListingStatusEnum"];
            purpose: components["schemas"]["PurposeEnum"];
            category: components["schemas"]["CategoryEnum"];
            subtype: components["schemas"]["SubtypeEnum"];
            city: components["schemas"]["Place"] | null;
            locality: components["schemas"]["Place"] | null;
            /**
             * Format: date
             * @description The Asia/Karachi date of creation.
             */
            created_on: string;
            views: number;
            inquiries: number;
        };
        DashboardListingPage: {
            results: components["schemas"]["DashboardListing"][];
            /**
             * Format: uri
             * @description The next page; null on the last.
             */
            next: string | null;
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
        /** @description An AI Price Estimate, or the unavailable state with a short reason and no number. */
        Estimate: {
            status: components["schemas"]["EstimateStatusEnum"];
            /** @description Estimated Property Value in PKR, a decimal string; null when unavailable. */
            estimated_value: string | null;
            /** @description Always `PKR`. */
            currency: string;
            model_version: number | null;
            /** Format: date-time */
            estimated_at: string | null;
            reason: (components["schemas"]["ReasonEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Short text for the reason; null when available. */
            message: string | null;
        };
        /** @description The model inputs only. Send the ones that apply to the property type; no price, address or other field is accepted. */
        EstimateFieldsRequest: {
            /**
             * Format: uuid
             * @description The uuid of an active locality from the reference lists (`/api/v1/reference/cities`), as text; never a name. Null clears it.
             */
            locality?: string | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            area_value?: string | null;
            area_unit?: (components["schemas"]["AreaUnitEnum"] | components["schemas"]["NullEnum"]) | null;
            marla_basis?: (components["schemas"]["MarlaBasisEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bedrooms?: number | null;
            /** @description Whole number from 0 to 50, a JSON integer (never text). Null clears it. */
            bathrooms?: number | null;
            /** @description Decimal string with up to 4 decimals (`0.0001` to `9999999999.9999`), digits and a point only, never a JSON number. Returned with 4 decimals. */
            covered_area_sqft?: string | null;
            /** @description Whole number from 1900 to 2100, a JSON integer (never text). Null clears it. */
            construction_year?: number | null;
            condition?: (components["schemas"]["ConditionEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description `true` or `false`; null when not answered (never defaulted to either). */
            corner_plot?: boolean | null;
            /** @description Decimal string with up to 2 decimals (`1.00` to `999.99`), digits and a point only, never a JSON number. Returned with 2 decimals. */
            road_width_ft?: string | null;
            /**
             * @description Seller-declared: the owner's own claim, never verified by EstateAI.
             *
             *     * `developed` - developed
             *     * `partially_developed` - partially_developed
             *     * `undeveloped` - undeveloped
             */
            development_status?: (components["schemas"]["DevelopmentStatusEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description An object `{code: state}` with catalogue codes (`/api/v1/reference/amenities`) and the state `"present"` or `"none"`, at most 40 entries. It REPLACES the whole map; `null` or `{}` clears it. A code left out is unanswered, never `none`. `nearby` entries are the seller's own declaration: show them as seller-declared; there is no distance and no verification. Returned as the answered codes only, or `null` when none is answered. */
            amenities?: {
                [key: string]: string;
            } | null;
        };
        EstimateRequestRequest: {
            purpose: components["schemas"]["PurposeEnum"];
            category: components["schemas"]["CategoryEnum"];
            subtype: components["schemas"]["SubtypeEnum"];
            fields: components["schemas"]["EstimateFieldsRequest"];
        };
        /**
         * @description * `available` - available
         *     * `unavailable` - unavailable
         * @enum {string}
         */
        EstimateStatusEnum: "available" | "unavailable";
        Favourite: {
            /** Format: uuid */
            listing_id: string;
            /** Format: date-time */
            saved_at: string;
            /** @description The public card; null when the Listing is no longer available. */
            listing: components["schemas"]["PublicListingCard"] | null;
        };
        FavouriteIds: {
            listing_ids: string[];
        };
        FavouritePage: {
            results: components["schemas"]["Favourite"][];
            /**
             * Format: uri
             * @description The next page; null on the last.
             */
            next: string | null;
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
        FlaggedListing: {
            /** Format: uuid */
            id: string;
            /** @description Null for a Draft. */
            title: string | null;
            status: string;
            /** Format: uuid */
            owner_account_id: string;
        };
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
            /** @description A Report on this Listing is being reviewed. Derived; it changes nothing and never names the reporter. */
            under_review: boolean;
            /** @description Set by moderation: a restricted Listing is never public and the owner cannot edit it (it may still be archived). Owner resource only, never in a public shape. */
            restricted: boolean;
            /** @description A short plain-text reason for a restricted or removed Listing, shown to the owner only; null otherwise. */
            restriction_reason: string | null;
        };
        ListingConfirmRequest: {
            /** @description The `revision` of the Draft whose values the owner saw. */
            base_revision: number;
            /** @description Registry field ids that hold a value. */
            fields: string[];
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
        /** @description A published Listing's estimate beside its total Asking price. */
        ListingEstimate: {
            status: components["schemas"]["EstimateStatusEnum"];
            /** @description Estimated Property Value in PKR, a decimal string; null when unavailable. */
            estimated_value: string | null;
            /** @description Always `PKR`. */
            currency: string;
            model_version: number | null;
            /** Format: date-time */
            estimated_at: string | null;
            reason: (components["schemas"]["ReasonEnum"] | components["schemas"]["NullEnum"]) | null;
            /** @description Short text for the reason; null when available. */
            message: string | null;
            /** @description Total Asking price in PKR (a per-unit price times the area); null for rent. */
            asking_total: string | null;
            /** @description Null when unavailable. */
            comparison: components["schemas"]["PriceComparison"] | null;
            /** @description Null when unavailable. */
            forecast: components["schemas"]["PriceForecast"] | null;
            /** @description True for the signed-in owner: `POST /api/v1/listings/{id}/estimate`. */
            can_recompute: boolean;
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
        ListingFlag: {
            /** Format: uuid */
            id: string;
            kind: components["schemas"]["ListingFlagKindEnum"];
            /** Format: date-time */
            flagged_at: string;
            listing: components["schemas"]["FlaggedListing"];
            /** @description The older Listing of a duplicate pair. */
            other_listing: components["schemas"]["FlaggedListing"] | null;
            /** @description Duplicate: what is near-identical. */
            matched: components["schemas"]["MatchedEnum"][];
            /** @description Suspicious: different reporters. */
            reporter_count: number;
        };
        /**
         * @description * `duplicate` - duplicate
         *     * `suspicious` - suspicious
         * @enum {string}
         */
        ListingFlagKindEnum: "duplicate" | "suspicious";
        ListingFlagPage: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["ListingFlag"][];
        };
        ListingPage: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["Listing"][];
        };
        /** @description What the public will see of the owner's own Listing, plus its latest AI Price Estimate. */
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
            /** @description The latest estimate requested for this Listing; null when there is none or the saved details it was computed from have changed since. */
            estimate: components["schemas"]["PreviewEstimate"] | null;
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
        /**
         * @description * `price` - price
         *     * `title` - title
         * @enum {string}
         */
        MatchedEnum: "price" | "title";
        Message: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            conversation_id: string;
            /** @description Order within the Conversation, from 1. */
            seq: number;
            body: string;
            mine: boolean;
            /** @description The sender's `Idempotency-Key`; null on the other's. */
            client_message_id: string | null;
            /** Format: date-time */
            created_at: string;
        };
        MessageBodyRequest: {
            body: string;
        };
        MessagePage: {
            results: components["schemas"]["Message"][];
            /** @description Ask again with `after` = the last `seq`. */
            has_more: boolean;
        };
        /**
         * @description * `restrict` - restrict
         *     * `remove` - remove
         *     * `lift_restriction` - lift_restriction
         *     * `restore` - restore
         *     * `archive_removed` - archive_removed
         * @enum {string}
         */
        ModerationActionEnum: "restrict" | "remove" | "lift_restriction" | "restore" | "archive_removed";
        ModerationReasonRequest: {
            /** @description One line, without contact details or links. The owner reads it. */
            reason: string;
        };
        ModerationRecord: {
            action: components["schemas"]["ModerationActionEnum"];
            reason: string;
            status_before: components["schemas"]["ListingStatusEnum"];
            status_after: components["schemas"]["ListingStatusEnum"];
            restriction_after: boolean;
            /** Format: date-time */
            at: string;
            /** Format: uuid */
            by_account_id: string;
        };
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
         * @description * `success` - success
         *     * `fallback` - fallback
         *     * `error` - error
         *     * `timeout` - timeout
         *     * `budget_exhausted` - budget_exhausted
         * @enum {string}
         */
        OutcomeEnum: "success" | "fallback" | "error" | "timeout" | "budget_exhausted";
        OwnClosure: {
            can_submit: boolean;
            /** @description The latest request. */
            request: components["schemas"]["ClosureRequest"] | null;
        };
        OwnReport: {
            /** Format: uuid */
            id: string;
            target_type: components["schemas"]["TargetTypeEnum"];
            /** Format: uuid */
            listing_id: string;
            /** Format: uuid */
            conversation_id: string | null;
            /** @description As it was when reported. */
            title: string | null;
            reason: components["schemas"]["ReportReasonEnum"];
            description: string;
            status: components["schemas"]["ReportStatusEnum"];
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            closed_at: string | null;
        };
        OwnVerification: {
            status: components["schemas"]["OwnVerificationStatusEnum"];
            can_submit: boolean;
            can_withdraw: boolean;
            /** @description The latest request. */
            request: components["schemas"]["OwnVerificationRequest"] | null;
        };
        OwnVerificationRequest: {
            business_name: string;
            /** @description Private. */
            registration_number: string;
            /** @description Private. */
            note: string;
            /** Format: date-time */
            submitted_at: string;
            /** Format: date-time */
            decided_at: string | null;
            /** @description Why it was rejected or revoked; else empty. */
            decision_reason: string;
        };
        /**
         * @description * `unverified` - unverified
         *     * `pending` - pending
         *     * `verified` - verified
         *     * `rejected` - rejected
         *     * `revoked` - revoked
         *     * `withdrawn` - withdrawn
         * @enum {string}
         */
        OwnVerificationStatusEnum: "unverified" | "pending" | "verified" | "rejected" | "revoked" | "withdrawn";
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
        /** @description A stored AI Price Estimate of the previewed Listing. */
        PreviewEstimate: {
            /** @description Estimated Property Value in PKR, a decimal string. */
            estimated_value: string;
            /** @description Always `PKR`. */
            currency: string;
            model_version: number;
            /** Format: date-time */
            estimated_at: string;
        };
        /**
         * @description * `total` - total
         *     * `per_unit` - per_unit
         *     * `rental_period` - rental_period
         * @enum {string}
         */
        PriceBasisEnum: "total" | "per_unit" | "rental_period";
        PriceComparison: {
            /**
             * @description The Asking price against the estimate; `about_equal` is within 5%.
             *
             *     * `about_equal` - about_equal
             *     * `above` - above
             *     * `below` - below
             */
            verdict: components["schemas"]["VerdictEnum"];
            /** @description Percent above or below the estimate, one decimal. */
            percent: string;
        };
        /** @description The 5-Year Price Forecast: assumed growth scenarios, not a guaranteed return. */
        PriceForecast: {
            horizon_years: number;
            /** @description PKR, a decimal string. */
            low: string;
            /** @description PKR, a decimal string. */
            base: string;
            /** @description PKR, a decimal string. */
            high: string;
        };
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
        /** @description An Agency's public profile (FR-41), and nothing else about it. */
        PublicAgency: {
            name: string;
            /** @description The public logo route; null without a logo. */
            logo_url: string | null;
            /** @description Empty when none was written. */
            description: string;
            /** @description An Agency with Verification granted. Always false for now. */
            verified: boolean;
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
            advertiser: components["schemas"]["Advertiser"];
            /** @description Relative path of the cover image on the media endpoint. */
            cover_url: string | null;
            /**
             * Format: date
             * @description The Asia/Karachi date of the first publication.
             */
            published_on: string;
        };
        /**
         * @description The public projection plus the publication date, the names of the city and locality, and
         *     the advertiser.
         */
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
            advertiser: components["schemas"]["Advertiser"];
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
        ReadBodyRequest: {
            /** @description The newest Message seen. */
            seq: number;
        };
        /**
         * @description * `messaging_email_unverified` - messaging_email_unverified
         *     * `messaging_unavailable` - messaging_unavailable
         *     * `counterpart_unavailable` - counterpart_unavailable
         *     * `conversation_read_only` - conversation_read_only
         * @enum {string}
         */
        ReadOnlyReasonEnum: "messaging_email_unverified" | "messaging_unavailable" | "counterpart_unavailable" | "conversation_read_only";
        /**
         * @description * `rent_not_supported` - rent_not_supported
         *     * `type_not_supported` - type_not_supported
         *     * `locality_missing` - locality_missing
         *     * `locality_not_covered` - locality_not_covered
         *     * `area_missing` - area_missing
         *     * `marla_basis_unknown` - marla_basis_unknown
         *     * `temporarily_unavailable` - temporarily_unavailable
         * @enum {string}
         */
        ReasonEnum: "rent_not_supported" | "type_not_supported" | "locality_missing" | "locality_not_covered" | "area_missing" | "marla_basis_unknown" | "temporarily_unavailable";
        ReasonedReadRequest: {
            reason: string;
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
        ReportCreateRequest: {
            reason: components["schemas"]["ReportReasonEnum"];
            description?: string;
        };
        ReportDetail: {
            /** Format: uuid */
            id: string;
            target_type: components["schemas"]["TargetTypeEnum"];
            /** Format: uuid */
            listing_id: string;
            /** Format: uuid */
            conversation_id: string | null;
            reason: components["schemas"]["ReportReasonEnum"];
            status: components["schemas"]["ReportStatusEnum"];
            /** @description Empty for a Conversation Report until it is read. */
            description: string;
            /** @description Listing Reports only. */
            snapshot: components["schemas"]["ReportSnapshot"] | null;
            /** @description Conversation Reports, and only from the reasoned read. */
            messages: components["schemas"]["ReportedMessage"][] | null;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            closed_at: string | null;
            reporter: components["schemas"]["AccountRef"] | null;
            /** @description The reported account. */
            owner: components["schemas"]["AccountRef"] | null;
            /** Format: uuid */
            owner_account_id: string;
            history: components["schemas"]["ReportMove"][];
            /** @description Open Reports on this target. */
            open_for_listing: number;
        };
        ReportMove: {
            to_status: components["schemas"]["ReportMoveEnum"];
            notes: string;
            /** Format: date-time */
            at: string;
            /** Format: uuid */
            by_account_id: string;
        };
        /**
         * @description * `reviewing` - reviewing
         *     * `resolved` - resolved
         *     * `dismissed` - dismissed
         * @enum {string}
         */
        ReportMoveEnum: "reviewing" | "resolved" | "dismissed";
        ReportNotesRequest: {
            /** @description Administrators only. */
            notes: string;
        };
        ReportQueue: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["_Row"][];
            unresolved: components["schemas"]["_Unresolved"];
        };
        /**
         * @description * `misleading` - misleading
         *     * `duplicate` - duplicate
         *     * `prohibited_content` - prohibited_content
         *     * `abusive` - abusive
         *     * `ai_generated_content` - ai_generated_content
         *     * `other` - other
         * @enum {string}
         */
        ReportReasonEnum: "misleading" | "duplicate" | "prohibited_content" | "abusive" | "ai_generated_content" | "other";
        /** @description The public view of the Listing when it was reported. */
        ReportSnapshot: {
            purpose: string;
            category: string;
            subtype: string;
            title: string | null;
            description: string | null;
            city: string | null;
            locality: string | null;
            image_count: number;
            /** @description Public registry fields that had a value. */
            fields: {
                [key: string]: unknown;
            };
        };
        ReportStartRequest: {
            notes?: string;
        };
        /**
         * @description * `pending` - pending
         *     * `reviewing` - reviewing
         *     * `resolved` - resolved
         *     * `dismissed` - dismissed
         * @enum {string}
         */
        ReportStatusEnum: "pending" | "reviewing" | "resolved" | "dismissed";
        ReportedMessage: {
            seq: number;
            sender: components["schemas"]["SenderEnum"];
            /** @description Reported; the others are context. */
            selected: boolean;
            body: string;
            /** Format: date-time */
            sent_at: string;
        };
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
            /** @description A Report on this Listing is being reviewed. Derived; it changes nothing and never names the reporter. */
            under_review: boolean;
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
         * @description * `initiator` - initiator
         *     * `owner` - owner
         * @enum {string}
         */
        RoleEnum: "initiator" | "owner";
        SearchInterpretation: {
            /**
             * @description `fallback`: nothing was understood; offer the conventional filters.
             *
             *     * `interpreted` - interpreted
             *     * `fallback` - fallback
             */
            status: components["schemas"]["SearchInterpretationStatusEnum"];
            /** @description Why, on a fallback. */
            message: string;
            /** @description Query parameters for `GET /api/v1/public/listings`; a `prefer_` one only ranks. Empty on a fallback. */
            params: {
                [key: string]: string;
            };
            /** @description Parts of the request that were not searched for, in the buyer's words. */
            unsupported: string[];
            notices: string[];
        };
        /**
         * @description * `interpreted` - interpreted
         *     * `fallback` - fallback
         * @enum {string}
         */
        SearchInterpretationStatusEnum: "interpreted" | "fallback";
        SearchRequestRequest: {
            /** @description The request in the buyer's words, at most 500 characters. */
            query: string;
        };
        /**
         * @description * `details` - details
         *     * `terms` - terms
         *     * `location` - location
         *     * `amenities` - amenities
         * @enum {string}
         */
        SectionEnum: "details" | "terms" | "location" | "amenities";
        /**
         * @description * `reporter` - reporter
         *     * `reported` - reported
         *     * `deleted_user` - deleted_user
         * @enum {string}
         */
        SenderEnum: "reporter" | "reported" | "deleted_user";
        Sent: {
            conversation: components["schemas"]["Conversation"];
            /** @description Null: the existing thread is read-only; nothing was saved. */
            message: components["schemas"]["Message"] | null;
        };
        /** @description Exactly `email` and `password`, both strings. Nothing else is accepted. */
        SignInRequest: {
            /** @description The account email; matched case-insensitively. */
            email: string;
            /** @description The account password. */
            password: string;
        };
        StartBodyRequest: {
            /** Format: uuid */
            listing_id: string;
            body: string;
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
        /**
         * @description * `listing` - listing
         *     * `conversation` - conversation
         * @enum {string}
         */
        TargetTypeEnum: "listing" | "conversation";
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
        Transcription: {
            /**
             * @description `fallback`: there is no transcript; offer the text box.
             *
             *     * `transcribed` - transcribed
             *     * `fallback` - fallback
             */
            status: components["schemas"]["TranscriptionStatusEnum"];
            /** @description To be shown, edited and then sent to `interpret_search`. */
            transcript: string;
            /** @description Why, on a fallback. */
            message: string;
        };
        /**
         * @description * `transcribed` - transcribed
         *     * `fallback` - fallback
         * @enum {string}
         */
        TranscriptionStatusEnum: "transcribed" | "fallback";
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
        UnreadConversations: {
            unread: number;
        };
        UnreadCount: {
            unread: number;
        };
        /**
         * @description * `about_equal` - about_equal
         *     * `above` - above
         *     * `below` - below
         * @enum {string}
         */
        VerdictEnum: "about_equal" | "above" | "below";
        /**
         * @description * `approved` - approved
         *     * `rejected` - rejected
         *     * `revoked` - revoked
         *     * `withdrawn` - withdrawn
         * @enum {string}
         */
        VerificationActionEnum: "approved" | "rejected" | "revoked" | "withdrawn";
        VerificationDecision: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["VerificationRequestStatusEnum"];
            /** Format: date-time */
            decided_at: string;
        };
        VerificationDetail: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["VerificationRequestStatusEnum"];
            business_name: string;
            agency_name: string | null;
            /**
             * Format: uuid
             * @description The public Agency id.
             */
            agency_id: string | null;
            /** @description `email_unverified`, `active`, `suspended` or `deactivated`. */
            account_state: string | null;
            /** Format: date-time */
            submitted_at: string;
            /** @description Private. */
            registration_number: string;
            /** @description Private. */
            note: string;
            /** Format: date-time */
            decided_at: string | null;
            decision_reason: string;
            history: components["schemas"]["VerificationHistory"][];
        };
        VerificationHistory: {
            action: components["schemas"]["VerificationActionEnum"];
            /** Format: date-time */
            at: string;
            /**
             * Format: uuid
             * @description The administrator, or the Agency for `withdrawn`.
             */
            by_account_id: string;
            reason: string;
        };
        VerificationQueue: {
            next: string | null;
            previous: string | null;
            results: components["schemas"]["_AgencySummary"][];
        };
        VerificationReasonRequest: {
            /** @description One line, without contact details. The Agency reads it. */
            reason: string;
        };
        VerificationRequestRequest: {
            /** @description The address to send a new link to. */
            email: string;
        };
        /**
         * @description * `pending` - pending
         *     * `verified` - verified
         *     * `rejected` - rejected
         *     * `revoked` - revoked
         *     * `withdrawn` - withdrawn
         * @enum {string}
         */
        VerificationRequestStatusEnum: "pending" | "verified" | "rejected" | "revoked" | "withdrawn";
        VerificationSubmitRequest: {
            business_name: string;
            /** @description Registration or licence number: letters, digits, spaces, `.`, `/`, `-`. */
            registration_number: string;
            note?: string;
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
        /** @description Documentation of the multipart body: exactly one part, named `audio`. */
        VoiceUploadRequest: {
            /**
             * Format: binary
             * @description A WebM, Ogg, MP4 (M4A) or WAV recording of up to 2 MB (2,097,152 bytes).
             */
            audio: string;
        };
        _AgencySummary: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["VerificationRequestStatusEnum"];
            business_name: string;
            agency_name: string | null;
            /**
             * Format: uuid
             * @description The public Agency id.
             */
            agency_id: string | null;
            /** @description `email_unverified`, `active`, `suspended` or `deactivated`. */
            account_state: string | null;
            /** Format: date-time */
            submitted_at: string;
        };
        _Row: {
            /** Format: uuid */
            id: string;
            target_type: components["schemas"]["TargetTypeEnum"];
            /** Format: uuid */
            listing_id: string;
            /** @description As it was when reported. */
            title: string | null;
            reason: components["schemas"]["ReportReasonEnum"];
            status: components["schemas"]["ReportStatusEnum"];
            /** Format: date-time */
            created_at: string;
        };
        _Unresolved: {
            pending: number;
            reviewing: number;
        };
        /**
         * @description Stable error code catalogue.
         * @enum {string}
         */
        ErrorCode: "bad_request" | "validation_error" | "link_invalid" | "unauthenticated" | "invalid_credentials" | "forbidden" | "email_not_verified" | "publishing_unavailable" | "messaging_email_unverified" | "messaging_unavailable" | "not_found" | "method_not_allowed" | "not_acceptable" | "stale_revision" | "conflict" | "quota_exhausted" | "correction_unavailable" | "storage_cap_exceeded" | "too_many_images" | "own_listing" | "conversation_read_only" | "counterpart_unavailable" | "link_used" | "link_expired" | "unsupported_media_type" | "idempotency_key_reused" | "throttled" | "server_error" | "busy";
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
    list_admin_closure_requests: {
        parameters: {
            query?: {
                cursor?: string;
                status?: "approved" | "pending" | "rejected";
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
                    "application/json": components["schemas"]["AdminClosureQueue"];
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
    approve_admin_closure_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClosureDecisionRequest"];
            };
        };
        responses: {
            /** @description Approved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminClosureRequest"];
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
    reject_admin_closure_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClosureDecisionRequest"];
            };
        };
        responses: {
            /** @description Rejected */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminClosureRequest"];
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
    list_admin_flags: {
        parameters: {
            query?: {
                cursor?: string;
                kind?: "duplicate" | "suspicious";
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
                    "application/json": components["schemas"]["ListingFlagPage"];
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
    list_admin_listings: {
        parameters: {
            query?: {
                category?: "apartment" | "commercial" | "house" | "plot";
                created_from?: string;
                created_to?: string;
                cursor?: string;
                owner?: string;
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
                    "application/json": components["schemas"]["AdminListingPage"];
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
    get_admin_listing: {
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
                    "application/json": components["schemas"]["AdminListingDetail"];
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
    archive_admin_listing: {
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
                "application/json": components["schemas"]["ModerationReasonRequest"];
            };
        };
        responses: {
            /** @description Recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModerationRecord"];
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
    lift_admin_listing_restriction: {
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
                "application/json": components["schemas"]["ModerationReasonRequest"];
            };
        };
        responses: {
            /** @description Recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModerationRecord"];
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
    read_admin_draft_listing: {
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
                "application/json": components["schemas"]["ReasonedReadRequest"];
            };
        };
        responses: {
            /** @description The Draft */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminListingDetail"];
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
    take_down_admin_listing: {
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
                "application/json": components["schemas"]["ModerationReasonRequest"];
            };
        };
        responses: {
            /** @description Recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModerationRecord"];
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
    restore_admin_listing: {
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
                "application/json": components["schemas"]["ModerationReasonRequest"];
            };
        };
        responses: {
            /** @description Recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModerationRecord"];
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
    restrict_admin_listing: {
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
                "application/json": components["schemas"]["ModerationReasonRequest"];
            };
        };
        responses: {
            /** @description Recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModerationRecord"];
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
    list_admin_reports: {
        parameters: {
            query?: {
                cursor?: string;
                reason?: "abusive" | "ai_generated_content" | "duplicate" | "misleading" | "other" | "prohibited_content";
                status?: "dismissed" | "pending" | "resolved" | "reviewing";
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
                    "application/json": components["schemas"]["ReportQueue"];
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
    get_admin_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The Report */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportDetail"];
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
    dismiss_admin_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReportNotesRequest"];
            };
        };
        responses: {
            /** @description Dismissed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportDetail"];
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
    read_admin_report_messages: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReasonedReadRequest"];
            };
        };
        responses: {
            /** @description With Messages */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportDetail"];
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
    resolve_admin_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReportNotesRequest"];
            };
        };
        responses: {
            /** @description Resolved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportDetail"];
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
    start_admin_report_review: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["ReportStartRequest"];
            };
        };
        responses: {
            /** @description Reviewing */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportDetail"];
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
    list_admin_verification_requests: {
        parameters: {
            query?: {
                cursor?: string;
                status?: "pending" | "rejected" | "revoked" | "verified" | "withdrawn";
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
                    "application/json": components["schemas"]["VerificationQueue"];
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
    approve_admin_verification_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Verified */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationDecision"];
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
    read_admin_verification_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReasonedReadRequest"];
            };
        };
        responses: {
            /** @description The request */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationDetail"];
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
    reject_admin_verification_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationReasonRequest"];
            };
        };
        responses: {
            /** @description Rejected */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationDecision"];
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
    revoke_admin_verification: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationReasonRequest"];
            };
        };
        responses: {
            /** @description Revoked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationDecision"];
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
    open_assistant_session: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssistantSessionOpenRequest"];
            };
        };
        responses: {
            /** @description The Draft's open session */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantSession"];
                };
            };
            /** @description A new session */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantSession"];
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: a Suspended or Deactivated account, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found`: not the account's own */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `conflict`: not a Draft */
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
    get_assistant_session: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantSession"];
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: a Suspended or Deactivated account, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found`: not the account's own */
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
    write_assistant_description: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssistantDescriptionBodyRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantDescriptionResult"];
                };
            };
            /** @description `validation_error`: `description` is `manual_description` (send `replace`) or `nothing_confirmed` */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
            /** @description `forbidden`: a Suspended or Deactivated account, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found`: not the account's own */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `stale_revision` or `conflict` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingConflict"];
                };
            };
            /** @description `throttled`: the assistant message limit; with `Retry-After` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    send_assistant_turn: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssistantTurnBodyRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantTurnResult"];
                };
            };
            /** @description `validation_error`: `message` (1 to 2000 characters) or `client_turn_id` */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
            /** @description `forbidden`: a Suspended or Deactivated account, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found`: not the account's own */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `conflict`: not a Draft, another message in progress, or a full session */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `idempotency_key_reused`: the `client_turn_id` had another message */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `throttled`: more than 30 messages in an hour; with `Retry-After` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    list_conversations: {
        parameters: {
            query?: {
                cursor?: string;
                listing_id?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationList"];
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
    start_conversation: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StartBodyRequest"];
            };
        };
        responses: {
            /** @description The existing Conversation, or a replay */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sent"];
                };
            };
            /** @description A new Conversation */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sent"];
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
            /** @description `messaging_email_unverified`, `messaging_unavailable` (suspended), `forbidden` (administrator) or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found`: no such public Listing */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `own_listing` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `idempotency_key_reused` */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `throttled` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    get_conversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Conversation"];
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
    list_messages: {
        parameters: {
            query?: {
                after?: number;
            };
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessagePage"];
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
    send_message: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MessageBodyRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Message"];
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
            /** @description `messaging_email_unverified`, `messaging_unavailable` (suspended), `forbidden` (administrator) or a missing CSRF token */
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
            /** @description `conversation_read_only` or `counterpart_unavailable` */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `idempotency_key_reused` */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `throttled` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    mark_conversation_read: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReadBodyRequest"];
            };
        };
        responses: {
            /** @description No response body */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
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
            /** @description a missing CSRF token */
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
    report_conversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConversationReportCreateRequest"];
            };
        };
        responses: {
            /** @description Reported */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnReport"];
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
    get_unread_conversation_count: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnreadConversations"];
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
    request_estimate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EstimateRequestRequest"];
            };
        };
        responses: {
            /** @description The estimate, or why there is none */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Estimate"];
                };
            };
            /** @description `validation_error`: invalid or unaccepted values */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
            /** @description `forbidden`: not allowed for this account, or a missing CSRF token */
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
            /** @description `throttled`: more than 20 estimate requests in an hour; with `Retry-After` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    confirm_listing_fields: {
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
                "application/json": components["schemas"]["ListingConfirmRequest"];
            };
        };
        responses: {
            /** @description The Draft */
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
            /** @description `forbidden` */
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
            /** @description `stale_revision` or `conflict` */
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
    request_listing_estimate: {
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
            /** @description The estimate, or why there is none */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Estimate"];
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: not allowed for this account, or a missing CSRF token */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `not_found`: not the account's own Listing */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `conflict`: the Listing is not a Draft or Published */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `throttled`: more than 20 estimate requests in an hour; with `Retry-After` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    report_listing: {
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
                "application/json": components["schemas"]["ReportCreateRequest"];
            };
        };
        responses: {
            /** @description Reported */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnReport"];
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
    get_agency_dashboard: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The totals */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Dashboard"];
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: not an Agency account */
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
    list_agency_dashboard_listings: {
        parameters: {
            query?: {
                category?: "apartment" | "commercial" | "house" | "plot";
                city_id?: string;
                created_from?: string;
                created_to?: string;
                cursor?: string;
                locality_id?: string;
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
                    "application/json": components["schemas"]["DashboardListingPage"];
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: not an Agency account */
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
    get_agency_verification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnVerification"];
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
    submit_agency_verification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationSubmitRequest"];
            };
        };
        responses: {
            /** @description Pending */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnVerification"];
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
    withdraw_agency_verification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Withdrawn */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnVerification"];
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
    get_own_closure: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnClosure"];
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
    request_own_closure: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClosureSubmitRequest"];
            };
        };
        responses: {
            /** @description Recorded */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnClosure"];
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
    get_own_closure_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The request */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClosureRequest"];
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
    list_favourites: {
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
                    "application/json": components["schemas"]["FavouritePage"];
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: not allowed for this account, or a missing CSRF token */
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
    save_favourite: {
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
            /** @description Saved */
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
            /** @description `forbidden`: not allowed for this account, or a missing CSRF token */
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
            /** @description `throttled`: 500 favourites are saved; no `Retry-After` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    remove_favourite: {
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: not allowed for this account, or a missing CSRF token */
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
    list_favourite_ids: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The ids */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FavouriteIds"];
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
            /** @description `unauthenticated`: a Visitor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
            /** @description `forbidden`: not allowed for this account, or a missing CSRF token */
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
    get_own_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The Report */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnReport"];
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
    get_public_agency: {
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
            /** @description The Agency */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicAgency"];
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
    list_public_agency_listings: {
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
            path: {
                agency_id: string;
            };
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
    get_listing_estimate: {
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
            /** @description The estimate */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingEstimate"];
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
    record_listing_view: {
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
            /** @description Received */
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
            /** @description `forbidden`: CSRF */
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
    interpret_search: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SearchRequestRequest"];
            };
        };
        responses: {
            /** @description The filters */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchInterpretation"];
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
            /** @description `forbidden`: CSRF token */
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
            /** @description `throttled` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
    transcribe_search: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["VoiceUploadRequest"];
            };
        };
        responses: {
            /** @description The words heard */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transcription"];
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
            /** @description `forbidden`: CSRF token */
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
            /** @description `throttled` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
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
