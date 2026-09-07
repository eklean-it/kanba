// Layout contract for DialogContent, kept out of the .tsx so it can be
// asserted in tests (this repo's vitest runs in node, with no DOM).
//
// Why the split into shell + body: the dialog is centred with
// `translate-y-[-50%]`, so a dialog taller than the viewport overflows off the
// TOP and BOTTOM at once and its footer can never be reached — the page behind
// scrolls, the dialog does not. That is the bug Erykah hit on 2026-08-20
// ("I cant not scroll to save this").
//
// The shell is the bounded, non-scrolling frame that the close button anchors
// to. The body is the scroll container. Putting the scroll on the shell would
// carry the absolutely-positioned X away with the content.

export const DIALOG_SHELL_CLASS =
  'fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-md translate-x-[-50%] translate-y-[-50%] flex-col border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg';

// `p-6` and `gap-4` moved here from the shell so the padding scrolls with the
// content rather than being stranded outside the scroll area.
export const DIALOG_BODY_CLASS =
  'grid gap-4 overflow-y-auto overscroll-contain p-6';
