import React, { useMemo } from 'react';
import { Linking, Text } from 'react-native';

// http(s)://… sau www.… — doar aceste scheme, ca un text să nu poată deschide
// altceva (ex. javascript:, intent:).
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = '.,!?;:…\'"”’]}>';

const countChar = (value, char) => value.split(char).length - 1;

// Punctuația de la final aparține de obicei propoziției, nu linkului; o
// paranteză închisă rămâne doar dacă linkul a deschis-o (ex. Wikipedia).
function trimTrailingPunctuation(raw) {
  let end = raw.length;
  while (end > 0) {
    const char = raw[end - 1];
    if (char === ')') {
      const candidate = raw.slice(0, end);
      if (countChar(candidate, '(') >= countChar(candidate, ')')) break;
      end -= 1;
    } else if (TRAILING_PUNCTUATION.includes(char)) {
      end -= 1;
    } else {
      break;
    }
  }
  return raw.slice(0, end);
}

export function splitLinks(text) {
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailingPunctuation(match[0]);
    if (!raw || /^www\.?$/i.test(raw)) continue;

    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index) });
    parts.push({ text: raw, url: raw.toLowerCase().startsWith('www.') ? `https://${raw}` : raw });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) });
  return parts;
}

export function openExternalLink(url) {
  if (!/^https?:\/\//i.test(String(url || ''))) return;
  Linking.openURL(url).catch(() => {});
}

/**
 * Text în care linkurile (http, https, www.) devin apăsabile.
 */
export default function LinkifiedText({ children, style, linkStyle, ...props }) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  const parts = useMemo(() => splitLinks(text), [text]);

  return (
    <Text style={style} {...props}>
      {parts.map((part, index) =>
        part.url ? (
          <Text
            key={`link-${index}`}
            style={linkStyle}
            onPress={() => openExternalLink(part.url)}
            accessibilityRole="link"
          >
            {part.text}
          </Text>
        ) : (
          part.text
        )
      )}
    </Text>
  );
}
