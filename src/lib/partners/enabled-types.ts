/**
 * Which partner types the product offers today.
 *
 * The database ships six (customer, architect, interior_factory,
 * distributor, producer, contractor) and a business may add its own; the
 * UI offers only these until their integrations - procurement for
 * distributors and factories, project steps for contractors, shared
 * projects for architects - are built. Add a code here when its module is
 * ready; nothing else needs to change for the menu, the lists, the form
 * and the detail page to pick it up.
 */
export const ENABLED_PARTNER_TYPES = ["customer", "architect"] as const;

export const isEnabledPartnerType = (code: string) =>
  (ENABLED_PARTNER_TYPES as readonly string[]).includes(code);
