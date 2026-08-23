/**
 * Turns a patient's free-text phone number (patients.phone is
 * unformatted — spec allows any format a nurse is handed) into a
 * WhatsApp JID ("<countrycode><number>@s.whatsapp.net"). Pure and
 * dependency-free so it's directly unit-testable (matches this
 * codebase's convention of splitting pure logic out of "server-only"
 * services — see lib/services/riskRules.ts).
 *
 * `defaultCountryCode` comes from clinic_settings.default_phone_country_code
 * (administrator-configurable, Phase 5 migration 0015) rather than being
 * hardcoded — this app never invents a business assumption like "which
 * country's local numbers we're formatting" without making it
 * configurable.
 */
export function formatPhoneForWhatsapp(
  rawPhone: string,
  defaultCountryCode: string,
): string | null {
  const digitsOnly = rawPhone.replace(/\D/g, "");
  if (!digitsOnly) return null;

  let normalized: string;
  if (digitsOnly.startsWith(defaultCountryCode)) {
    // Already has the country code (e.g. "263771234567").
    normalized = digitsOnly;
  } else if (digitsOnly.startsWith("0")) {
    // Local trunk-prefix format (e.g. "0771234567") — drop the leading
    // 0 and prepend the country code.
    normalized = `${defaultCountryCode}${digitsOnly.slice(1)}`;
  } else {
    // No recognizable prefix — best-effort: assume it's already a local
    // number missing its trunk zero and just needs the country code.
    normalized = `${defaultCountryCode}${digitsOnly}`;
  }

  // A real international mobile number is realistically 9-15 digits
  // total (ITU E.164's own upper bound is 15). Outside that range this
  // almost certainly isn't a usable number — better to skip sending
  // and let the caller record a clear "invalid phone" failure than to
  // hand Baileys garbage and get an opaque provider error back.
  if (normalized.length < 9 || normalized.length > 15) return null;

  return `${normalized}@s.whatsapp.net`;
}
