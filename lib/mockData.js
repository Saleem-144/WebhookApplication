// Mock data for the Dialpad Super Admin Dashboard

export const mockUser = {
  id: '1',
  name: 'Admin Name',
  email: 'admin@360digital.us',
  role: 'superadmin',
};

export const mockOffices = [
  {
    id: '1',
    name: '360 Digital US',
    phone_number: '+1-800-360-0001',
    timezone: 'America/New_York',
    is_active: true,
  },
];

export const mockDepartments = [
  {
    id: '1',
    office_id: '1',
    name: 'Sales Department',
    phone_number: '+1-800-360-0010',
    is_active: true,
  },
  {
    id: '2',
    office_id: '1',
    name: 'Support Department',
    phone_number: '+1-800-360-0020',
    is_active: true,
  },
];

export const mockAgents = [
  {
    id: '1',
    department_id: '1',
    office_id: '1',
    name: 'Agent 1',
    title: 'Senior Lead Associate',
    email: 'agent1@360digital.us',
    status: 'available',
    initials: 'A1',
  },
  {
    id: '2',
    department_id: '1',
    office_id: '1',
    name: 'Agent 2',
    title: 'Account Strategist',
    email: 'agent2@360digital.us',
    status: 'available',
    initials: 'A2',
  },
  {
    id: '3',
    department_id: '1',
    office_id: '1',
    name: 'Agent 3',
    title: 'Client Relations',
    email: 'agent3@360digital.us',
    status: 'busy',
    initials: 'A3',
  },
  {
    id: '4',
    department_id: '1',
    office_id: '1',
    name: 'Agent 4',
    title: 'Growth Manager',
    email: 'agent4@360digital.us',
    status: 'available',
    initials: 'A4',
  },
  {
    id: '5',
    department_id: '1',
    office_id: '1',
    name: 'Agent 5',
    title: 'Position Pending',
    email: 'agent5@360digital.us',
    status: 'offline',
    initials: 'A5',
  },
];

export const mockNotifications = [
  {
    id: '1',
    event_type: 'sms_inbound',
    source_type: 'customer',
    preview_text: 'Hi, I need help with my account...',
    is_read: false,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: '2',
    event_type: 'missed_call',
    source_type: 'customer',
    preview_text: 'Missed call from +1-555-0123',
    is_read: false,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: '3',
    event_type: 'sms_inbound',
    source_type: 'agent',
    preview_text: 'Can you check the report?',
    is_read: false,
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
  },
];

export const mockStats = {
  totalOffices: 1,
  totalDepartments: 2,
  totalAgents: 5,
};
