import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdownInto(el, text) {
  const raw = marked.parse(text || "");
  el.innerHTML = DOMPurify.sanitize(raw);
  el.querySelectorAll("pre code").forEach((block) => {
    try {
      hljs.highlightElement(block);
    } catch (err) {
      // ignore highlighting errors
    }
  });
}
