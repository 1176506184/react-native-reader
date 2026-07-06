import { parseDocument } from 'htmlparser2';

const BLOCK_TAGS = new Set(['article', 'blockquote', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'section']);

export const htmlToPlainText = (html: string): string => {
  if (!html) return '';

  const dom = parseDocument(html.replace(/<br\s*\/?>/gi, '\n'));
  let text = '';

  const appendBreak = () => {
    if (text && !text.endsWith('\n')) {
      text += '\n';
    }
  };

  const extractText = (node: any) => {
    if (node.type === 'text') {
      text += node.data;
      return;
    }

    if (node.type !== 'tag') return;

    if (node.name === 'br') {
      appendBreak();
      return;
    }

    node.children?.forEach(extractText);

    if (BLOCK_TAGS.has(node.name)) {
      appendBreak();
    }
  };

  dom.children?.forEach(extractText);

  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
};
