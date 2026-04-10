import { query } from '../db/index.js';
import { normalizeToE164 } from '../utils/phoneNormalize.js';

/**
 * Upsert a contact by phone number. 
 * If name/email are provided, they only update if the current values are null/empty.
 * Manual updates (from the UI) should use a different specific update function.
 */
export const upsertContactFromEvent = async (phoneNumber, { name = '', email = '', dialpadId = '' } = {}) => {
  const e164 = normalizeToE164(phoneNumber);
  if (!e164) return null;

  try {
    // 1. Check if exists
    const { rows } = await query('SELECT * FROM contacts WHERE phone_number = $1', [e164]);
    const existing = rows[0];

    if (!existing) {
      // Create new
      const res = await query(
        `INSERT INTO contacts (phone_number, name, email, dialpad_contact_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [e164, name || null, email || null, dialpadId || null]
      );
      return res.rows[0];
    } else {
      // Update only if missing data (auto-enrichment)
      const updateFields = [];
      const params = [e164];
      
      if (!existing.name && name) {
        params.push(name);
        updateFields.push(`name = $${params.length}`);
      }
      if (!existing.email && email) {
        params.push(email);
        updateFields.push(`email = $${params.length}`);
      }
      if (!existing.dialpad_contact_id && dialpadId) {
        params.push(dialpadId);
        updateFields.push(`dialpad_contact_id = $${params.length}`);
      }

      if (updateFields.length > 0) {
        const res = await query(
          `UPDATE contacts SET ${updateFields.join(', ')}, updated_at = NOW() 
           WHERE phone_number = $1 RETURNING *`,
          params
        );
        return res.rows[0];
      }
      return existing;
    }
  } catch (err) {
    console.error('upsertContactFromEvent error:', err.message);
    return null;
  }
};

/**
 * Specifically update a contact's fields (from the UI).
 */
export const updateContact = async (id, { name, email }) => {
  try {
    const res = await query(
      `UPDATE contacts SET name = $2, email = $3, updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id, name, email]
    );
    return res.rows[0];
  } catch (err) {
    console.error('updateContact error:', err.message);
    throw err;
  }
};

/**
 * Specifically delete a contact by ID (from the UI).
 */
export const deleteContact = async (id) => {
  try {
    const res = await query(
      'DELETE FROM contacts WHERE id = $1 RETURNING *',
      [id]
    );
    return res.rows[0] || null;
  } catch (err) {
    console.error('deleteContact error:', err.message);
    throw err;
  }
};

/**
 * List contacts with search and line-based filtering.
 * linePhoneNumber: Filter to only show contacts who have interacted with this line.
 */
export const listContacts = async ({ search = '', linePhoneNumber = null, limit = 100, offset = 0 } = {}) => {
  try {
    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];

    if (linePhoneNumber) {
      params.push(linePhoneNumber);
      const lineIdx = params.length;
      // Filter: Contact must have at least one call or message with this internal line
      sql += ` AND (
        EXISTS (
          SELECT 1 FROM dialpad_calls dc 
          WHERE dc.external_e164 = contacts.phone_number AND dc.internal_number = $${lineIdx}
        )
        OR EXISTS (
          SELECT 1 FROM dialpad_messages dm 
          WHERE (dm.raw_payload->>'from_number' = contacts.phone_number AND dm.raw_payload->'to_number' @> jsonb_build_array($${lineIdx}::text))
          OR (dm.raw_payload->>'from_number' = $${lineIdx} AND dm.raw_payload->'to_number' @> jsonb_build_array(contacts.phone_number::text))
        )
      )`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name ILIKE $${params.length} OR phone_number ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    sql += ' ORDER BY name NULLS LAST, created_at DESC';
    
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const { rows } = await query(sql, params);
    return rows;
  } catch (err) {
    console.error('listContacts error:', err.message);
    return [];
  }
};

/**
 * Get contact by phone.
 */
export const getContactByPhone = async (phone) => {
  const e164 = normalizeToE164(phone);
  if (!e164) return null;
  const { rows } = await query('SELECT * FROM contacts WHERE phone_number = $1', [e164]);
  return rows[0] || null;
};
