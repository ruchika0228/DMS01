// Dummy Users Data
export const users = [
  {
    id: 1,
    name: 'Alex Johnson',
    email: 'alex.johnson@example.com',
    avatar: 'https://i.pravatar.cc/150?img=1',
    status: 'active',
    role: 'Admin',
    joinedDate: '2024-01-15'
  },
  {
    id: 2,
    name: 'Sarah Williams',
    email: 'sarah.williams@example.com',
    avatar: 'https://i.pravatar.cc/150?img=5',
    status: 'active',
    role: 'User',
    joinedDate: '2024-02-20'
  },
  {
    id: 3,
    name: 'Michael Chen',
    email: 'michael.chen@example.com',
    avatar: 'https://i.pravatar.cc/150?img=12',
    status: 'pending',
    role: 'User',
    joinedDate: '2024-03-10'
  },
  {
    id: 4,
    name: 'Emma Davis',
    email: 'emma.davis@example.com',
    avatar: 'https://i.pravatar.cc/150?img=9',
    status: 'active',
    role: 'Moderator',
    joinedDate: '2024-01-28'
  },
  {
    id: 5,
    name: 'James Wilson',
    email: 'james.wilson@example.com',
    avatar: 'https://i.pravatar.cc/150?img=13',
    status: 'pending',
    role: 'User',
    joinedDate: '2024-04-05'
  },
  {
    id: 6,
    name: 'Olivia Martinez',
    email: 'olivia.martinez@example.com',
    avatar: 'https://i.pravatar.cc/150?img=24',
    status: 'inactive',
    role: 'User',
    joinedDate: '2023-12-15'
  }
];

// Dummy Blockchain Data
export const blockchainData = [
  {
    id: 1,
    hash: '0x1a2b3c4d5e6f7890abcdef1234567890',
    previousHash: '0x0000000000000000000000000000000000',
    timestamp: '2024-01-15T10:30:00Z',
    fileHash: 'nbnbhjb77',
    author: 'eDUwOTo6Q049QWRtaW5Ab3JnMS5leGFtcGxlLmNvbTo6Q049Y2Eub3JnMS5leGFtcGxlLmNvbSw',
    size: '3.38 KB',
    notes: 'Genesis Block - System Initialized',
    data: {
      transaction: 'Genesis Block',
      amount: 0,
      from: 'System',
      to: 'Network'
    },
    nonce: 12345
  },
  {
    id: 2,
    hash: '0x9a8b7c6d5e4f3210fedcba0987654321',
    previousHash: '0x1a2b3c4d5e6f7890abcdef1234567890',
    timestamp: '2024-01-15T11:45:00Z',
    fileHash: 'kjsdf89s7',
    author: 'eDUwOTo6Q049QWRtaW5Ab3JnMS5leGFtcGxlLmNvbTo6Q049Y2Eub3JnMS5leGFtcGxlLmNvbSw',
    size: '1.25 KB',
    data: {
      transaction: 'Transfer',
      amount: 50,
      from: 'Alice',
      to: 'Bob'
    },
    nonce: 67890
  },
  {
    id: 3,
    hash: '0x3f4e5d6c7b8a9011fedcba2345678901',
    previousHash: '0x9a8b7c6d5e4f3210fedcba0987654321',
    timestamp: '2024-01-15T14:20:00Z',
    fileHash: 'mcnv734kj',
    author: 'eDUwOTo6Q049QWRtaW5Ab3JnMS5leGFtcGxlLmNvbTo6Q049Y2Eub3JnMS5leGFtcGxlLmNvbSw',
    size: '4.50 KB',
    notes: 'Prior transaction verified manually',
    data: {
      transaction: 'Transfer',
      amount: 75,
      from: 'Bob',
      to: 'Charlie'
    },
    nonce: 54321
  },
  {
    id: 4,
    hash: '0x7c8d9e0f1a2b3c4d5e6f7890abcdef12',
    previousHash: '0x3f4e5d6c7b8a9011fedcba2345678901',
    timestamp: '2024-01-15T16:55:00Z',
    fileHash: 'pqowie928',
    author: 'eDUwOTo6Q049QWRtaW5Ab3JnMS5leGFtcGxlLmNvbTo6Q049Y2Eub3JnMS5leGFtcGxlLmNvbSw',
    size: '2.10 KB',
    data: {
      transaction: 'Transfer',
      amount: 120,
      from: 'Charlie',
      to: 'David'
    },
    nonce: 98765
  },
  {
    id: 5,
    hash: '0xf1e2d3c4b5a6978809fedcba87654321',
    previousHash: '0x7c8d9e0f1a2b3c4d5e6f7890abcdef12',
    timestamp: '2024-01-15T18:30:00Z',
    fileHash: 'lzmxnc743',
    author: 'eDUwOTo6Q049QWRtaW5Ab3JnMS5leGFtcGxlLmNvbTo6Q049Y2Eub3JnMS5leGFtcGxlLmNvbSw',
    size: '3.38 KB',
    notes: 'Warning: Large transaction volume detected',
    data: {
      transaction: 'Transfer',
      amount: 200,
      from: 'David',
      to: 'Eve'
    },
    nonce: 13579
  }
];

// Dummy Connection Requests Data
export const connectionRequests = {
  sent: [
    {
      id: 1,
      user: {
        name: 'Robert Brown',
        email: 'robert.brown@example.com',
        avatar: 'https://i.pravatar.cc/150?img=33',
        role: 'Developer'
      },
      status: 'pending',
      sentDate: '2024-04-20T09:15:00Z'
    },
    {
      id: 2,
      user: {
        name: 'Lisa Anderson',
        email: 'lisa.anderson@example.com',
        avatar: 'https://i.pravatar.cc/150?img=29',
        role: 'Designer'
      },
      status: 'pending',
      sentDate: '2024-04-19T14:30:00Z'
    },
    {
      id: 3,
      user: {
        name: 'David Kim',
        email: 'david.kim@example.com',
        avatar: 'https://i.pravatar.cc/150?img=51',
        role: 'Manager'
      },
      status: 'accepted',
      sentDate: '2024-04-18T11:00:00Z'
    }
  ],
  received: [
    {
      id: 4,
      user: {
        name: 'Jennifer Taylor',
        email: 'jennifer.taylor@example.com',
        avatar: 'https://i.pravatar.cc/150?img=47',
        role: 'Analyst'
      },
      status: 'pending',
      receivedDate: '2024-04-21T10:45:00Z'
    },
    {
      id: 5,
      user: {
        name: 'Kevin Rodriguez',
        email: 'kevin.rodriguez@example.com',
        avatar: 'https://i.pravatar.cc/150?img=68',
        role: 'Engineer'
      },
      status: 'pending',
      receivedDate: '2024-04-20T16:20:00Z'
    },
    {
      id: 6,
      user: {
        name: 'Michelle Lee',
        email: 'michelle.lee@example.com',
        avatar: 'https://i.pravatar.cc/150?img=26',
        role: 'Product Manager'
      },
      status: 'pending',
      receivedDate: '2024-04-19T08:30:00Z'
    }
  ]
};

// Dummy Received Documents Data
export const receivedDocuments = [
  {
    id: 1,
    documentName: 'Q1_Financial_Report.pdf',
    fileType: 'application/pdf',
    fileSize: 2456789,
    sender: {
      id: 1,
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      avatar: 'https://i.pravatar.cc/150?img=1'
    },
    receivedDate: '2024-04-22T10:30:00Z',
    description: 'Quarterly financial analysis and projections'
  },
  {
    id: 2,
    documentName: 'Project_Proposal_2024.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 1234567,
    sender: {
      id: 2,
      name: 'Sarah Williams',
      email: 'sarah.williams@example.com',
      avatar: 'https://i.pravatar.cc/150?img=5'
    },
    receivedDate: '2024-04-21T14:15:00Z',
    description: 'New project proposal for review'
  },
  {
    id: 3,
    documentName: 'Team_Photo.jpg',
    fileType: 'image/jpeg',
    fileSize: 3456789,
    sender: {
      id: 4,
      name: 'Emma Davis',
      email: 'emma.davis@example.com',
      avatar: 'https://i.pravatar.cc/150?img=9'
    },
    receivedDate: '2024-04-20T09:45:00Z',
    description: 'Team building event photo'
  },
  {
    id: 4,
    documentName: 'Meeting_Notes.txt',
    fileType: 'text/plain',
    fileSize: 45678,
    sender: {
      id: 1,
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      avatar: 'https://i.pravatar.cc/150?img=1'
    },
    receivedDate: '2024-04-19T16:20:00Z',
    description: 'Notes from executive meeting'
  },
  {
    id: 5,
    documentName: 'Budget_Analysis.pdf',
    fileType: 'application/pdf',
    fileSize: 1876543,
    sender: {
      id: 2,
      name: 'Sarah Williams',
      email: 'sarah.williams@example.com',
      avatar: 'https://i.pravatar.cc/150?img=5'
    },
    receivedDate: '2024-04-18T11:00:00Z',
    description: '2024 budget breakdown and analysis'
  },
  {
    id: 6,
    documentName: 'Contract_Draft.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 987654,
    sender: {
      id: 4,
      name: 'Emma Davis',
      email: 'emma.davis@example.com',
      avatar: 'https://i.pravatar.cc/150?img=9'
    },
    receivedDate: '2024-04-17T13:30:00Z',
    description: 'Vendor contract for approval'
  }
];

// Dummy current user
export const currentUser = {
  id: 100,
  name: 'Current User',
  email: 'current.user@example.com',
  avatar: 'https://i.pravatar.cc/150?img=60',
  role: 'Admin',
  notifications: 3
};
