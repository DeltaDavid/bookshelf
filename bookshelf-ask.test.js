import test from 'node:test';
import assert from 'node:assert/strict';
import { answerBookshelfQuestion, buildAskContext } from './bookshelf-ask.js';

const books = [
  {
    id: 1,
    title: 'Dune',
    author: 'Frank Herbert',
    category: 'Fiction',
    status: 'Read',
    my_rating: 5,
    notes: 'private',
  },
  {
    id: 2,
    title: 'The Hobbit',
    author: 'J. R. R. Tolkien',
    category: 'Fantasy',
    status: 'Wishlist',
    avg_rating: 4.8,
  },
];

test('context keeps stable IDs and excludes personal text', () => {
  const context = buildAskContext(books);
  assert.deepEqual(
    JSON.parse(context).map((book) => book.id),
    [1, 2]
  );
  assert.equal(context.includes('private'), false);
});

test('local librarian answers counts and author searches', () => {
  assert.match(answerBookshelfQuestion('How many books?', books), /2 books/);
  assert.match(answerBookshelfQuestion('Books by Tolkien?', books), /The Hobbit/);
});

test('subset counts use the requested field instead of the library total', () => {
  const collection = [
    { title: 'Read print', read_count: 1, binding: 'Paperback' },
    { title: 'Unread audio', read_count: 0, binding: 'Audiobook' },
    { title: 'Unread print', read_count: 0, binding: 'Hardcover' },
  ];
  assert.match(answerBookshelfQuestion('How many unread books?', collection), /2 unread books/);
  assert.match(answerBookshelfQuestion('How many audiobooks?', collection), /1 audiobooks?/);
  assert.match(answerBookshelfQuestion('How many read books?', collection), /1 read books?/);
});

test('complex and edge prompts answer from recorded facts and keep missing values distinct', () => {
  const collection = [
    { title: 'Shared', author: 'A', category: 'Fiction', read_count: 1, pages: 300, my_rating: 5 },
    { title: 'Shared', author: 'B', category: 'Fiction', read_count: 0, pages: '', my_rating: 0 },
    { title: 'Other', author: '', category: 'History', read_count: 0, pages: 180, my_rating: 0 },
  ];
  assert.match(
    answerBookshelfQuestion('Compare read and unread books by category.', collection),
    /Fiction\*\*: 2 total, 1 read, 1 unread/
  );
  assert.match(answerBookshelfQuestion('Which books have no page count?', collection), /Shared/);
  assert.match(answerBookshelfQuestion('Which books share the same title?', collection), /2 books/);
  assert.match(
    answerBookshelfQuestion('Which books have no author recorded?', collection),
    /Other/
  );
  assert.match(
    answerBookshelfQuestion('What is my longest unread book?', collection),
    /Other.*180 pages/
  );
  assert.match(
    answerBookshelfQuestion('What should I read next?', [{ title: 'Done', read_count: 1 }]),
    /no unread book to recommend/
  );
});
