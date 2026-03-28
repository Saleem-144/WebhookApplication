import { query } from './index.js';

/**
 * Fetch all offices
 */
export const getAllOffices = async () => {
  const res = await query('SELECT * FROM offices WHERE is_active = TRUE ORDER BY name');
  return res.rows;
};

/**
 * Fetch departments for a specific office
 */
export const getDepartmentsByOffice = async (officeId) => {
  const res = await query(
    'SELECT * FROM departments WHERE office_id = $1 AND is_active = TRUE ORDER BY name',
    [officeId]
  );
  return res.rows;
};

/**
 * Fetch agents for a specific department or office
 */
export const getAgents = async ({ officeId, departmentId }) => {
  let sql = 'SELECT a.*, s.status FROM agents a LEFT JOIN agent_status s ON a.id = s.agent_id WHERE a.is_active = TRUE';
  const params = [];

  if (departmentId) {
    params.push(departmentId);
    sql += ` AND a.department_id = $${params.length}`;
  } else if (officeId) {
    params.push(officeId);
    sql += ` AND a.office_id = $${params.length}`;
  }

  sql += ' ORDER BY a.name';
  const res = await query(sql, params);
  return res.rows;
};

/**
 * Get summary statistics
 */
export const getStatsSummary = async () => {
  const res = await query(`
    SELECT 
      (SELECT COUNT(*) FROM offices WHERE is_active = TRUE) as total_offices,
      (SELECT COUNT(*) FROM departments WHERE is_active = TRUE) as total_departments,
      (SELECT COUNT(*) FROM agents WHERE is_active = TRUE) as total_agents,
      (SELECT COUNT(*) FROM agent_status WHERE status != 'offline') as active_agents
  `);
  return res.rows[0];
};
