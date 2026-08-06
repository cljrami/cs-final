// src/lib/sanitize.ts
import DOMPurify from 'dompurify';

function decodeHtmlOnce(input: string): string {
  if (typeof document === 'undefined') {
    return input
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      .replace(/&/g, '&');
  }
  const txt = document.createElement('textarea');
  txt.innerHTML = input;
  return txt.value;
}

export function decodeHtml(input: string | null | undefined): string {
  if (!input) return '';
  let current = input;
  for (let i = 0; i < 5; i++) {
    const next = decodeHtmlOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

const ALLOWED_TAGS = [
  'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'ol', 'ul', 'li', 'a', 'img', 'video', 'iframe',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  'div'
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'target', 'rel',
  'class', 'style', 'width', 'height', 'align', 'colspan', 'rowspan',
  'frameborder', 'allowfullscreen', 'type'
];

const URI_RE = new RegExp('^(https?:|mailto:|tel:|#|/|[^a-z]|[a-z+.-]+:)', 'i');

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  const decoded = decodeHtml(dirty);
  // Detect if content is plain text (no HTML tags)
  const hasTags = /<[a-z][\s\S]*>/i.test(decoded);
  let toSanitize = decoded;
  let wasPlainText = false;
  
  if (!hasTags) {
    // Wrap plain text in <p> so DOMPurify preserves it
    toSanitize = `<p>${decoded}</p>`;
    wasPlainText = true;
  }
  
  const sanitized = DOMPurify.sanitize(toSanitize, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: URI_RE
  }) as string;
  
  if (wasPlainText) {
    // Extract text content from the wrapped <p>
    const match = sanitized.match(/<p>([\s\S]*?)<\/p>/);
    return match ? match[1] : decoded;
  }
  
  return sanitized;
}