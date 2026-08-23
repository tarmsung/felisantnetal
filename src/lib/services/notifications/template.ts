/**
 * `{{token}}` substitution for notification_templates.body_template.
 * Pure and directly unit-testable (see phone.ts's comment for why this
 * is split out rather than living inside notificationService.ts).
 *
 * Deliberately simple string replacement, not a templating engine: the
 * whole point (spec section 9) is that a template can only ever contain
 * the exact tokens the caller explicitly renders — there is no way for
 * a template to reach a field this function wasn't handed, which is
 * what keeps diagnosis/measurements/risk detail out of a WhatsApp
 * message by construction, not by convention.
 */
export function renderTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match,
  );
}
