'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdminAuditLog = require('../models/AdminAuditLog');

test('AdminAuditLog blocks updates on existing records (append-only)', async () => {
  const doc = new AdminAuditLog({
    actor: new mongoose.Types.ObjectId(),
    action: 'test_action',
    entityType: 'test',
    entityId: '123',
  });

  // For a new doc, pre('save') should allow it
  assert.equal(doc.isNew, true);
  await new Promise((resolve, reject) => {
    doc.validate().then(() => resolve()).catch(reject);
  });

  // Emulate an existing document that was already saved
  doc.isNew = false;
  doc.action = 'tampered_action';

  // Attempting to save should trigger the append-only error
  await assert.rejects(
    async () => {
      // In Mongoose schema middleware, doc.$__save or running pre hooks
      await new Promise((resolve, reject) => {
        // Trigger save hooks manually if not connected to live Mongo
        const middleware = AdminAuditLog.schema.s.hooks;
        middleware.execPre('save', doc, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },
    (err) => {
      assert.match(err.message, /Admin audit log entries are append-only/);
      return true;
    }
  );
});
