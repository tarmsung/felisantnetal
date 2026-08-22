-- Migration 0012 (Phase 3): appointment follow-up notes
--
-- Spec section 13 (Missed Appointments) lists "Add note" as a nurse
-- action on a missed visit. There's no notes column on appointments yet
-- because Phase 1 only modeled what earlier phases needed — this adds
-- it now that Phase 3 actually uses it. Append-only by convention (see
-- appointmentService.addAppointmentNote): each note is appended with a
-- timestamp/author prefix rather than overwriting the column, so a
-- follow-up history isn't lost the way a plain overwrite would lose it.
-- A dedicated notes table would be more normalized but is unwarranted
-- complexity for a single free-text field with no independent lifecycle.

alter table public.appointments add column notes text;
