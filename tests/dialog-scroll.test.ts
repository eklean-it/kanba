import { describe, expect, it } from 'vitest';
import { DIALOG_BODY_CLASS, DIALOG_SHELL_CLASS } from '@/lib/dialog-classes';

// Erykah, 2026-08-20: "I cant not scroll to save this" — she opened a task in
// the Proposals board and the Save button sat below the fold with no way to
// reach it.
//
// Cause: DialogContent was `fixed top-[50%] translate-y-[-50%]` with NO height
// cap and NO scroll container. A dialog taller than the viewport therefore
// overflowed off BOTH edges (the -50% translate splits the overflow), so the
// footer was unreachable at any scroll position — the page behind it scrolls,
// the dialog does not.
//
// These assertions are the regression guard. Whatever else changes about the
// dialog's looks, a tall one must stay bounded and must scroll its own body.
describe('dialog layout contract', () => {
  it('caps the shell height so a tall dialog cannot overflow the viewport', () => {
    expect(DIALOG_SHELL_CLASS).toMatch(/\bmax-h-\[/);
  });

  it('scrolls the body instead of letting content spill past the fold', () => {
    expect(DIALOG_BODY_CLASS).toContain('overflow-y-auto');
  });

  it('keeps the shell itself unscrolled so the close button stays pinned', () => {
    // The X is absolutely positioned against the shell. If the SHELL were the
    // scroll container the X would scroll away with the content, trading one
    // unreachable control for another.
    expect(DIALOG_SHELL_CLASS).not.toContain('overflow-y-auto');
  });

  it('contains overscroll so hitting the end does not scroll the page behind', () => {
    expect(DIALOG_BODY_CLASS).toContain('overscroll-contain');
  });
});
