// A canned response is filled in with the ticket's variables by the API (`GET /tickets/{id}/canned/{id}`); this file
// only turns stored HTML into the plain text the edit boxes hold.

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/**
 * A canned response is HTML; the reply box is plain text. Line breaks and paragraphs become newlines, other tags are
 * dropped and entities decoded. Text that is not HTML is returned as it is.
 */
export function htmlToText(html: string): string {
  if (!/<\/?[a-z][\s\S]*?>/i.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
