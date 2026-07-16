// src/lib/sanitize.ts
import DOMPurify from 'dompurify';

// Decodifica entidades HTML (ej. &lt;p&gt; -> <p>) para soportar contenido
// que llegue escapado desde la BD. Si ya viene sin escapar, no altera nada.
function decodeHtmlOnce(input: string): string {
  if (typeof document === 'undefined') {
    // Fallback sin DOM (p. ej. SSR/estático): reemplazos comunes
    return input
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  const txt = document.createElement('textarea');
  txt.innerHTML = input;
  return txt.value;
}

export function decodeHtml(input: string | null | undefined): string {
  if (!input) return '';
  // Decodifica de forma iterativa para soportar contenido doble-escapado
  // (ej. "&amp;lt;p&amp;gt;" -> "&lt;p&gt;" -> "<p>").
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

// Permite http(s), mailto, tel, data:image y anclas internos (#)
const URI_RE = new RegExp('^(https?:|mailto:|tel:|#|/|[^a-z]|[a-z+.-]+:)', 'i');

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  const decoded = decodeHtml(dirty);
  return DOMPurify.sanitize(decoded, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: URI_RE
  }) as string;
}

