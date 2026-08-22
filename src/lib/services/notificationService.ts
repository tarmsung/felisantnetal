// Phase 5 (spec section 43): the WhatsApp reminder system. This module
// will expose a small NotificationService facade over a swappable
// provider interface (WhatsApp today; SMS/email later, per spec section
// 3) so the reminder scheduler and any manual "send reminder" action
// never talk to a specific provider's API directly. See
// ARCHITECTURE.md "Notifications" for the intended shape.
export {};
