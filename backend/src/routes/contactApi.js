import express from 'express';
import { listContacts, updateContact, upsertContactFromEvent, deleteContact } from '../services/contactService.js';

const router = express.Router();

/**
 * GET /api/contacts
 * Query: search, limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const { search, limit, offset, linePhoneNumber } = req.query;
    const contacts = await listContacts({
      search,
      linePhoneNumber,
      limit: Number(limit) || 100,
      offset: Number(offset) || 0
    });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/contacts/:id
 * Body: name, email
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const updated = await updateContact(id, { name, email });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/contacts/sync (Migration)
 * Body: { [id]: name }
 */
router.post('/sync', async (req, res) => {
  try {
    const customNames = req.body || {};
    const results = [];
    for (const [id, name] of Object.entries(customNames)) {
      if (!name) continue;
      // We try to find the contact by this ID (phone or dialpad id)
      // If it's a phone number, it works. If it's a dialpad ID, we might need more logic.
      // For now, let's just use it as part of the upsert.
      const contact = await upsertContactFromEvent(id, { name });
      if (contact) results.push(contact);
    }
    res.json({ count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/contacts/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteContact(id);
    if (!deleted) return res.status(404).json({ error: 'Contact not found' });
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
