# Crisis resource data process

Mori must never invent a hotline, copy an unverified aggregator entry or use an AI-generated phone number.

## Adding a resource

1. Start from an official government, health-service or resource-provider page. Record the canonical source URL internally.
2. Manually verify the resource name, phone/URL, audience, country/region, language, service type and stated operating hours.
3. Confirm the source is current and that the contact path reaches the named service.
4. Insert the resource disabled, review the database row, then set `verified_at` to the actual verification time and enable it.
5. Have a second reviewer check high-impact fields before enabling when operationally possible.

The current schema stores country/region, type, name, phone, URL, hours, language, verification timestamp and enabled state. Source evidence and reviewer identity must be retained in the operator change record until dedicated provenance fields are added. Do not put confidential reviewer data in the public resource row.

## Review interval

Review every enabled resource at least every 90 days and immediately after a known service/provider change, failed contact report or official-source update. Record the new `verified_at` only after checking the official source again. A timestamp alone is not evidence of verification.

Disable a resource immediately when its official source disappears, contact details conflict, eligibility becomes unclear, the service is reported unreachable or the review deadline is missed. Correct and re-verify before re-enabling it. Database deletion is reserved for clear duplicates or records that should no longer be retained; disabling preserves operational history.

## Runtime fallback

The API returns only enabled resources with `verified_at`. The current product does not ask for a verified country and does not infer location from IP, so only globally applicable entries are eligible. If no eligible resource exists or the database query fails, Mori returns generic guidance to contact local emergency services or a nearby emergency department. This fallback contains no number.
