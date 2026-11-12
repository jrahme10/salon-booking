# Customer consent and opt-out history

## Purpose

The provider customer profile now keeps an append-only history of marketing permission events. It is separate from birthday details and follow-up tasks.

## Recording a grant

1. Open Provider → Customers and select a customer.
2. Choose the permitted channel: WhatsApp, email, SMS, or all.
3. Record how the customer confirmed (in person, WhatsApp, email, phone, website, or other).
4. Check the confirmation that the customer explicitly agreed.
5. Optionally add a short evidence note, then choose Record consent.

The application blocks a grant unless the owner checks the explicit-agreement confirmation. If the source is Other, a note is required.

## Recording an opt-out

Choose the channel scope and select Record opt-out. The event is appended to the history; existing events are not edited or deleted. A later opt-out takes precedence over earlier grants for that channel. An opt-out for WhatsApp does not automatically revoke a separate email grant, and vice versa. Choosing All revokes all supported marketing channels.

## Sending safeguards

- Birthday, follow-up and inactive-customer promotional actions are enabled only when the latest applicable event is a grant for that channel.
- Old demo `marketingOptIn` booleans without an event are not treated as consent.
- A grant for one channel does not authorize another.
- Transactional appointment communication is outside this promotional-consent helper and should be handled separately.
- The app still opens prefilled WhatsApp/email messages for a human to review and send; it does not automatically transmit them.

## Current limitations

Consent events are stored in this browser's local storage. They are not yet server-side, tamper-resistant or synchronized across devices. The record documents what the salon operator entered; it does not independently verify the customer's identity, wording, or actual consent. Before automated messaging or real multi-user production use, move these records to Supabase with tenant isolation, server-side enforcement, access controls, retention policy and auditable timestamps. Provide customers with a clear opt-out route and honor applicable local privacy and marketing rules.
