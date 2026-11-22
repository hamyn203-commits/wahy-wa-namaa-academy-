'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Payment = require('../models/Payment');

test('Payment provider+providerReference index uses partialFilterExpression instead of compound sparse', () => {
  const indexes = Payment.schema.indexes();
  const providerRefEntry = indexes.find(
    ([fields]) => fields && fields.provider === 1 && fields.providerReference === 1
  );
  assert.ok(providerRefEntry, 'Expected { provider: 1, providerReference: 1 } index on Payment');
  const [, options] = providerRefEntry;
  assert.equal(options.unique, true);
  assert.notEqual(options.sparse, true, 'Compound sparse index collides on { provider: "manual", providerReference: null }');
  assert.deepEqual(options.partialFilterExpression, {
    providerReference: { $type: 'string' },
  });
});

test('ensureProviderReferencePartialIndex drops legacy sparse index and recreates partial unique index', async () => {
  const origCollection = Payment.collection;
  const origReadyState = Object.getOwnPropertyDescriptor(Payment.db, 'readyState');
  const mongoose = require('mongoose');
  const origConnReadyState = mongoose.connection.readyState;

  let dropped = null;
  let created = null;

  Object.defineProperty(mongoose.connection, 'readyState', {
    value: 1,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(Payment, 'collection', {
    value: {
      indexes: async () => [
        { name: '_id_', key: { _id: 1 } },
        { name: 'provider_1_providerReference_1', key: { provider: 1, providerReference: 1 }, unique: true, sparse: true },
      ],
      dropIndex: async (name) => { dropped = name; },
      createIndex: async (spec, opts) => { created = { spec, opts }; },
    },
    configurable: true,
    writable: true,
  });

  try {
    const healed = await Payment.ensureProviderReferencePartialIndex();
    assert.equal(healed, true);
    assert.equal(dropped, 'provider_1_providerReference_1');
    assert.deepEqual(created.spec, { provider: 1, providerReference: 1 });
    assert.deepEqual(created.opts.partialFilterExpression, { providerReference: { $type: 'string' } });
  } finally {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: origConnReadyState,
      configurable: true,
      writable: true,
    });
    if (origCollection) {
      Object.defineProperty(Payment, 'collection', {
        value: origCollection,
        configurable: true,
        writable: true,
      });
    }
    if (origReadyState) {
      Object.defineProperty(Payment.db, 'readyState', origReadyState);
    }
  }
});
