"use client";

import DOMPurify from "dompurify";
import { useMemo } from "react";

// Thread bodies come from customers (and email): HTML must be sanitised before it is put in the page.
// Remote content stays, but links open in a new tab without handing over the opener.
let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

const LOOKS_LIKE_HTML = /<\/?[a-z][\s\S]*?>/i;

/**
 * Renders a body. A thread entry says how osTicket stores it (`format`): `html` is sanitised and rendered (osTicket stores
 * agent replies and notes as HTML too, with entities such as `&amp;` that must be decoded), `text` is shown as written.
 * Without a format (a FAQ answer, say) HTML is told apart from text by its shape.
 */
export function SafeHtml({ html, format, className }: { html: string; format?: "text" | "html"; className?: string }) {
  const isHtml = format ? format === "html" : LOOKS_LIKE_HTML.test(html);
  const clean = useMemo(() => {
    if (!isHtml) return null;
    ensureHook();
    return DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "form", "input", "button", "iframe"], FORBID_ATTR: ["style"] });
  }, [html, isHtml]);

  if (clean === null) return <div className={`whitespace-pre-wrap break-words ${className ?? ""}`}>{html}</div>;
  return <div className={`break-words [&_a]:text-sky-800 [&_a]:underline [&_p]:my-2 ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
