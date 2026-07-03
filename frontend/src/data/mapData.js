// ─────────────────────────────────────────────────────────────────────────────
// Map View Data  –  File Management System
// Each user represents a node in the file-transfer network.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mapUsers – geographic nodes shown as markers on the map.
 *
 * userA & userB share the same coordinates (Delhi) to demonstrate
 * spiderfy / same-location clustering.
 * userC (Mumbai) and userD (San Francisco) are at distinct locations.
 */
export const mapUsers = [
    {
        id: 'userA',
        label: 'A',
        name: 'User A  (Delhi HQ)',
        lat: 28.6139,
        lon: 77.2090,
        role: 'Sender',
        department: 'Finance',
        status: 'Active',
    },
    {
        id: 'userB',
        label: 'B',
        name: 'User B  (Delhi Branch)',
        lat: 28.6139,   // identical to User A → triggers spiderfy
        lon: 77.2090,
        role: 'Receiver',
        department: 'Accounts',
        status: 'Active',
    },
    {
        id: 'userC',
        label: 'C',
        name: 'User C  (Mumbai)',
        lat: 19.0760,
        lon: 72.8777,
        role: 'Sender',
        department: 'Operations',
        status: 'Active',
    },
    {
        id: 'userD',
        label: 'D',
        name: 'User D  (Kashmir)',
        lat: 34.0837,
        lon: 74.7973,
        role: 'Receiver',
        department: 'Engineering',
        status: 'Active',
    },
];

/**
 * fileTransfers – pairs of users actively exchanging files.
 * Each entry produces an animated line on the map.
 *
 * color   – stroke colour of the transfer beam
 * label   – file name shown in the line tooltip
 */
export const fileTransfers = [
    {
        id: 'tx-AB',
        senderId: 'userA',
        receiverId: 'userB',
        fileName: 'Q1_Financial_Report.pdf',
        fileSize: '2.4 MB',
        color: '#6366f1',          // indigo  – A → B
        status: 'Transferring',
    },
    {
        id: 'tx-CD',
        senderId: 'userC',
        receiverId: 'userD',
        fileName: 'Project_Proposal_2024.docx',
        fileSize: '1.2 MB',
        color: '#f59e0b',          // amber   – C → D
        status: 'Transferring',
    },
];
