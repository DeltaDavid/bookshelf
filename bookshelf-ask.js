import { attachAskMe, SPARKLE_ICON } from './ask-me-kit.js';

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

function listAnswer(intro, matches, limit = 8) {
  if (!matches.length) return `${intro} None in the current library.`;
  const shown = matches.slice(0, limit);
  return `${intro} ${matches.length} book${matches.length === 1 ? '' : 's'}${matches.length > limit ? ` (showing ${limit})` : ''}:\n${shown.map(line).join('\n')}`;
}

function isRead(book) {
  return ['read', 'listened'].includes(lower(statusOf(book)));
}

function isAudio(book) {
  return lower(book.type || book.binding).includes('audio');
}

function numericRating(book) {
  const value = Number(book.my_rating);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function groupSummary(books, key, heading) {
  const groups = new Map();
  for (const book of books) {
    const name = normalized(key(book)) || 'Unknown';
    const group = groups.get(name) || { total: 0, read: 0 };
    group.total += 1;
    if (isRead(book)) group.read += 1;
    groups.set(name, group);
  }
  const rows = [...groups].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
  return `${heading}\n${rows
    .slice(0, 10)
    .map(
      ([name, group]) =>
        `- **${name}**: ${group.total} total, ${group.read} read, ${group.total - group.read} unread`
    )
    .join('\n')}${rows.length > 10 ? `\nShowing 10 of ${rows.length} groups.` : ''}`;
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

  if (/\b(missing|no|without|unknown)\b/.test(query)) {
    if (/\bauthors?\b/.test(query))
      return listAnswer(
        'Books without a recorded author:',
        books.filter((book) => !normalized(book.author))
      );
    if (/\b(page count|pages?)\b/.test(query))
      return listAnswer(
        'Books without a recorded page count:',
        books.filter((book) => !(Number(book.pages) > 0))
      );
    if (/\b(rating|rated)\b/.test(query))
      return listAnswer(
        'Books without your rating:',
        books.filter((book) => numericRating(book) === null)
      );
    if (/\b(isbn)\b/.test(query))
      return listAnswer(
        'Books without an ISBN:',
        books.filter((book) => !normalized(book.isbn13 || book.isbn))
      );
    if (/\b(finish|read) date\b|date (?:read|finished)\b/.test(query))
      return listAnswer(
        'Read books without a finish date:',
        books.filter((book) => isRead(book) && !normalized(book.date_read))
      );
    if (/\b(format|binding)\b/.test(query))
      return listAnswer(
        'Books without a recorded format:',
        books.filter((book) => !normalized(book.type || book.binding))
      );
    if (/\b(category|subject)\b/.test(query))
      return listAnswer(
        'Books without a recorded category:',
        books.filter((book) => !normalized(book.category))
      );
  }

  if (/\b(duplicate|same title|ambiguous title)\b/.test(query)) {
    const groups = new Map();
    for (const book of books) {
      const title = lower(book.title);
      if (title) groups.set(title, [...(groups.get(title) || []), book]);
    }
    const matches = [...groups.values()].filter((group) => group.length > 1).flat();
    return listAnswer('Books sharing a title:', matches);
  }

  if (
    /\b(compare|breakdown|group)\b/.test(query) &&
    /\b(category|categories|subjects?)\b/.test(query)
  ) {
    return groupSummary(
      books,
      (book) => book.category,
      'Reading status by category (largest groups first):'
    );
  }
  if (/\b(compare|breakdown|group)\b/.test(query) && /\b(format|formats|binding)\b/.test(query)) {
    return groupSummary(
      books,
      (book) => book.type || book.binding,
      'Reading status by format (largest groups first):'
    );
  }
  if (/\b(authors? with|multiple books|several books)\b/.test(query)) {
    const groups = new Map();
    for (const book of books) {
      const author = normalized(book.author);
      if (author) groups.set(author, [...(groups.get(author) || []), book]);
    }
    const repeated = [...groups]
      .filter(([, titles]) => titles.length > 1)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    if (!repeated.length) return 'No author has more than one book in the current library.';
    return `Authors with more than one book (showing up to 10):\n${repeated
      .slice(0, 10)
      .map(([author, titles]) => {
        const rated = titles.map(numericRating).filter((rating) => rating !== null);
        return `- **${author}**: ${titles.length} books${rated.length ? `; your rated books average ${(rated.reduce((sum, rating) => sum + rating, 0) / rated.length).toFixed(1)} stars (${rated.length} rated)` : '; none rated by you'}`;
      })
      .join('\n')}`;
  }

  if (/\b(longest|most pages)\b/.test(query)) {
    const unreadOnly = /\b(unread|not read)\b/.test(query);
    const candidates = books
      .filter((book) => (!unreadOnly || !isRead(book)) && Number(book.pages) > 0)
      .sort(
        (a, b) => Number(b.pages) - Number(a.pages) || lower(a.title).localeCompare(lower(b.title))
      );
    if (!candidates.length) return 'No matching books have a recorded page count.';
    const winner = candidates[0];
    return `The longest ${unreadOnly ? 'unread ' : ''}book with a recorded page count is **${winner.title || 'Untitled'}** by ${winner.author || 'an unknown author'} at ${winner.pages} pages. Books without page counts were excluded.`;
  }

  if (/\b(recent|recently|newest|latest)\b/.test(query) && /\b(add|added|books?)\b/.test(query)) {
    const dated = books
      .filter((book) => normalized(book.date_added))
      .sort((a, b) => lower(b.date_added).localeCompare(lower(a.date_added)));
    return listAnswer('Most recently added books:', dated.slice(0, 8));
  }

  if (/\b(how many|count|total)\b/.test(query)) {
    const read = books.filter(isRead).length;
    const audio = books.filter(isAudio).length;
    if (/\b(audiobooks?|audio books?)\b/.test(query))
      return `You have **${audio} audiobooks** in the current library.`;
    if (/\b(unread|not read|haven't read)\b/.test(query))
      return `You have **${books.length - read} unread books** in the current library.`;
    if (/\b(read|finished)\b/.test(query))
      return `You have **${read} read books** in the current library.`;
    if (/\b(unrated|without (?:my )?rating)\b/.test(query))
      return `You have **${books.filter((book) => numericRating(book) === null).length} unrated books** in the current library.`;
    const requestedStatus = ['wishlist', 'pending', 'in progress', 'abandoned'].find((candidate) =>
      query.includes(candidate)
    );
    if (requestedStatus)
      return `You have **${books.filter((book) => lower(statusOf(book)) === requestedStatus).length} books** marked ${requestedStatus}.`;
    return `You have **${books.length} books**: ${read} marked Read and ${audio} audiobooks.`;
  }

  const wantsRecommendation = /\b(recommend|suggest|what should i read|read next)\b/.test(query);
  const status = ['wishlist', 'pending', 'in progress', 'read', 'listened', 'abandoned'].find(
    (candidate) => query.includes(candidate)
  );
  if (status && !wantsRecommendation) {
    const matches = books.filter((book) => lower(statusOf(book)) === status).slice(0, 8);
    return matches.length
      ? `${matches.length === 8 ? 'Here are the first 8' : `I found ${matches.length}`} marked **${status}**:\n${matches.map(line).join('\n')}`
      : `I found no books marked **${status}**.`;
  }

  if (wantsRecommendation) {
    const candidates = books
      .filter((book) => !['read', 'listened'].includes(lower(statusOf(book))))
      .sort((a, b) => ratingOf(b) - ratingOf(a) || lower(a.title).localeCompare(lower(b.title)));
    if (!candidates.length)
      return 'Every book in the current library is marked read; there is no unread book to recommend.';
    const picks = candidates.slice(0, 5);
    return `Here are ${picks.length} unread picks from your library, ranked by your rating when present, then the average rating. This does not infer your tastes from notes or reading history:\n${picks.map(line).join('\n')}`;
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
    : 'I could not answer that from the current library fields. Try a count, title, author, category, reading status, format, rating, missing field, duplicate title, or recommendation. Open-ended analysis is not available in this web version.';
}

if (typeof document !== 'undefined') {
  const books = () => window.bookshelfAskBooks?.() ?? [];
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;
  const voice = {
    start(onTranscript, onEnd, onError) {
      if (!Recognition) throw new Error('Voice input is unavailable in this browser. Try Chrome.');
      window.speechSynthesis?.cancel();
      recognition = new Recognition();
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
        if (transcript) onTranscript(transcript);
      };
      recognition.onerror = (event) =>
        onError(
          new Error(
            event.error === 'not-allowed'
              ? 'Microphone access was denied.'
              : `Voice input failed: ${event.error}.`
          )
        );
      recognition.onend = () => {
        recognition = undefined;
        onEnd();
      };
      recognition.start();
    },
    stop() {
      recognition?.stop();
      window.speechSynthesis?.cancel();
    },
    speak(answer) {
      if (!window.speechSynthesis) return;
      const plain = String(answer)
        .replace(/\*\*/g, '')
        .replace(/^[-*]\s+/gm, '')
        .replace(/https?:\/\/\S+/g, '');
      const utterance = new SpeechSynthesisUtterance(plain);
      utterance.lang = navigator.language || 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
  };
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'askme-fab';
  fab.innerHTML = SPARKLE_ICON;
  fab.setAttribute('aria-label', 'Ask Books');
  fab.title = 'Ask Books';
  document.body.append(fab);
  const ask = attachAskMe({
    root: document.querySelector('#askMeRoot'),
    open: false,
    draggable: true,
    resizable: true,
    cascadingPrompts: true,
    submitPrompts: true,
    storageKey: 'bookshelf-ask-me',
    title: 'Ask Books',
    voice,
    emptyMessage: 'Ask about titles, authors, categories, reading status, or what to read next.',
    context: async () => buildAskContext(books()),
    answer: async ({ text }) => ({ answer: answerBookshelfQuestion(text, books()) }),
    prompts: {
      groups: [
        {
          label: 'Quick questions',
          prompts: [
            { label: 'How many books do I have?', text: 'How many books do I have?' },
            { label: 'How many audiobooks?', text: 'How many audiobooks do I have?' },
            { label: 'How many unread books?', text: 'How many unread books do I have?' },
            { label: 'What should I read next?', text: 'What should I read next?' },
            { label: 'What is my longest book?', text: 'What is my longest book?' },
          ],
        },
        {
          label: 'Complex examples',
          prompts: [
            {
              label: 'Reading by category',
              text: 'Compare read and unread books by category.',
              complex: true,
            },
            {
              label: 'Reading by format',
              text: 'Compare read and unread books by format.',
              complex: true,
            },
            {
              label: 'Authors with several books',
              text: 'Which authors have multiple books, and how do my ratings compare?',
              complex: true,
            },
            {
              label: 'Longest unread book',
              text: 'What is my longest unread book with a recorded page count?',
              complex: true,
            },
            {
              label: 'Recently added books',
              text: 'Show my most recently added books.',
              complex: true,
            },
          ],
        },
      ],
      edgeCases: [
        { label: 'Missing authors', text: 'Which books have no author recorded?' },
        {
          label: 'Missing page counts',
          text: 'Which books have no page count? Do not treat missing as zero.',
        },
        { label: 'Unrated books', text: 'Which books have no rating from me?' },
        { label: 'Missing ISBNs', text: 'Which books have no ISBN recorded?' },
        { label: 'Missing finish dates', text: 'Which read books have no finish date recorded?' },
        { label: 'Unknown formats', text: 'Which books have no binding or format recorded?' },
        { label: 'Missing categories', text: 'Which books have no category recorded?' },
        { label: 'Duplicate titles', text: 'Which books share the same title?' },
        {
          label: 'No in-progress books',
          text: 'Show books marked in progress. Say when there are none.',
        },
        {
          label: 'No unread recommendations',
          text: 'What should I read next if every book is already marked read?',
        },
      ],
    },
  });
  const positionKey = 'books-ask-fab-position';
  function placeFab(left, top) {
    const x = Math.max(6, Math.min(window.innerWidth - fab.offsetWidth - 6, left));
    const y = Math.max(6, Math.min(window.innerHeight - fab.offsetHeight - 6, top));
    fab.style.left = `${x}px`;
    fab.style.top = `${y}px`;
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  }
  function placePanel() {
    const rect = fab.getBoundingClientRect();
    const panel = ask.element;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left =
      rect.left >= width + 14
        ? rect.left - width - 10
        : rect.right + width + 16 <= window.innerWidth
          ? rect.right + 10
          : window.innerWidth - width - 6;
    panel.style.left = `${Math.max(6, left)}px`;
    panel.style.top = `${Math.max(6, Math.min(window.innerHeight - height - 6, rect.bottom - height))}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }
  try {
    const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
    if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top))
      placeFab(saved.left, saved.top);
  } catch {}
  let drag;
  let suppressClick = false;
  fab.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    fab.setPointerCapture(event.pointerId);
  });
  fab.addEventListener('pointermove', (event) => {
    if (!drag || !fab.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    drag.moved = true;
    placeFab(drag.left + dx, drag.top + dy);
    if (!ask.element.hidden) placePanel();
  });
  function finishDrag(event) {
    if (!drag) return;
    if (fab.hasPointerCapture(event.pointerId)) fab.releasePointerCapture(event.pointerId);
    if (drag.moved) {
      const rect = fab.getBoundingClientRect();
      try {
        localStorage.setItem(positionKey, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch {}
      suppressClick = true;
    }
    drag = undefined;
  }
  fab.addEventListener('pointerup', finishDrag);
  fab.addEventListener('pointercancel', finishDrag);
  window.addEventListener('resize', () => {
    if (fab.style.left) {
      const rect = fab.getBoundingClientRect();
      placeFab(rect.left, rect.top);
    }
    if (!ask.element.hidden) placePanel();
  });
  window.openAskMe = () => {
    ask.open();
    placePanel();
  };
  fab.addEventListener('click', (event) => {
    if (suppressClick) {
      event.preventDefault();
      suppressClick = false;
      return;
    }
    if (ask.element.hidden) window.openAskMe();
    else ask.close();
  });
}
