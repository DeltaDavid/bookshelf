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
