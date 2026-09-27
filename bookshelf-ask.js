import { attachAskMe } from './ask-me-kit.js';

const normalized = (value) => String(value ?? '').trim();
const lower = (value) => normalized(value).toLowerCase();

function statusOf(book) {
  return normalized(book.status) || (Number(book.read_count) > 0 ? 'Read' : 'No status');
}

function ratingOf(book) {
  return Number(book.my_rating) || Number(book.avg_rating) || 0;
}

function line(book) {
  const details = [book.author, book.category, statusOf(book)].filter(Boolean).join(' · ');
  return `- **${book.title || 'Untitled'}**${details ? ` — ${details}` : ''}`;
}

export function buildAskContext(books) {
  return JSON.stringify(
    books
      .slice()
      .sort(
        (a, b) =>
          lower(b.date_added).localeCompare(lower(a.date_added)) || Number(a.id) - Number(b.id)
      )
      .slice(0, 45)
      .map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        category: book.category,
        status: statusOf(book),
        type: book.type,
        rating: book.my_rating,
        averageRating: book.avg_rating,
        shelves: book.shelves,
        dateRead: book.date_read,
        dateAdded: book.date_added,
      }))
  );
}

export function answerBookshelfQuestion(question, books) {
  const query = lower(question);
  if (!books.length) return 'Your library has not loaded yet.';

  if (/\b(how many|count|total)\b/.test(query)) {
    const read = books.filter((book) => lower(statusOf(book)) === 'read').length;
    const audio = books.filter((book) => lower(book.type || book.binding).includes('audio')).length;
    return `You have **${books.length} books**: ${read} marked Read and ${audio} audiobooks.`;
  }

  const status = ['wishlist', 'pending', 'in progress', 'read', 'listened', 'abandoned'].find(
    (candidate) => query.includes(candidate)
  );
  if (status) {
    const matches = books.filter((book) => lower(statusOf(book)) === status).slice(0, 8);
    return matches.length
      ? `${matches.length === 8 ? 'Here are the first 8' : `I found ${matches.length}`} marked **${status}**:\n${matches.map(line).join('\n')}`
      : `I found no books marked **${status}**.`;
  }

  if (/\b(recommend|suggest|what should i read|read next)\b/.test(query)) {
    const candidates = books
      .filter((book) => !['read', 'listened'].includes(lower(statusOf(book))))
      .sort((a, b) => ratingOf(b) - ratingOf(a) || lower(a.title).localeCompare(lower(b.title)));
    const picks = (candidates.length ? candidates : books).slice(0, 5);
    return `Here are five deterministic picks from your library:\n${picks.map(line).join('\n')}`;
  }

  const authorMatch = /\bby\s+(.+?)(?:\?|$)/i.exec(normalized(question));
  if (authorMatch) {
    const needle = lower(authorMatch[1]);
    const matches = books.filter((book) => lower(book.author).includes(needle)).slice(0, 8);
    return matches.length
      ? `I found ${matches.length} book${matches.length === 1 ? '' : 's'} by that author:\n${matches.map(line).join('\n')}`
      : 'I did not find that author in your library.';
  }

  const stop = new Set([
    'a',
    'an',
    'and',
    'are',
    'book',
    'books',
    'do',
    'find',
    'for',
    'have',
    'i',
    'in',
    'is',
    'me',
    'my',
    'of',
    'on',
    'show',
    'the',
    'to',
    'what',
    'with',
  ]);
  const terms = query.split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !stop.has(term));
  const matches = terms.length
    ? books
        .filter((book) => {
          const haystack = lower(
            [
              book.title,
              book.author,
              book.category,
              book.shelves,
              book.tags,
              statusOf(book),
              book.type,
            ].join(' ')
          );
          return terms.every((term) => haystack.includes(term));
        })
        .slice(0, 8)
    : [];
  return matches.length
    ? `I found ${matches.length} matching book${matches.length === 1 ? '' : 's'}:\n${matches.map(line).join('\n')}`
    : 'Try asking for a title, author, category, status, count, or a recommendation.';
}

if (typeof document !== 'undefined') {
  const books = () => window.bookshelfAskBooks?.() ?? [];
  const ask = attachAskMe({
    root: document.querySelector('#askMeRoot'),
    open: false,
    draggable: true,
    resizable: true,
    cascadingPrompts: true,
    submitPrompts: true,
    storageKey: 'bookshelf-ask-me',
    title: 'Ask Bookshelf',
    emptyMessage: 'Ask about titles, authors, categories, reading status, or what to read next.',
    context: async () => buildAskContext(books()),
    answer: async ({ text }) => ({ answer: answerBookshelfQuestion(text, books()) }),
    prompts: {
      groups: [
        {
          label: 'Library questions',
          prompts: [
            { label: 'What should I read next?', text: 'What should I read next?', complex: true },
            { label: 'How many books do I have?', text: 'How many books do I have?' },
            { label: 'Show my in-progress books', text: 'Show my in progress books' },
          ],
        },
      ],
    },
  });
  window.openAskMe = () => ask.open();
}
