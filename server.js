const express = require('express');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

const LEADS_FILE = path.join(__dirname, 'data', 'leads.json');
const PDFS_DIR = path.join(__dirname, 'public', 'pdfs');

const BC_MAP = {
  'bc1-production-knowledge': { file: 'bc1-production-knowledge.pdf', name: 'Production Knowledge Assistant' },
  'bc2-hr-it-helpdesk': { file: 'bc2-hr-it-helpdesk.pdf', name: 'HR & IT Helpdesk Automation' },
  'bc3-document-processing': { file: 'bc3-document-processing.pdf', name: 'Document Processing Automation' },
  'bc4-customer-service': { file: 'bc4-customer-service.pdf', name: 'Customer Service Automation' },
};

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

app.use(express.json());
app.use(express.static('public'));

// Health check for Railway
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Download business case - email gate
app.post('/api/download', async (req, res) => {
  const { email, businessCaseId } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const bc = BC_MAP[businessCaseId];
  if (!bc) {
    return res.status(400).json({ error: 'Invalid business case' });
  }

  // Save lead
  let leads = [];
  try { leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); } catch {}
  leads.push({ email, businessCaseId, timestamp: new Date().toISOString() });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

  // Send email with PDF attachment
  try {
    const pdfPath = path.join(PDFS_DIR, bc.file);
    const pdfBuffer = fs.readFileSync(pdfPath);

    await resend.emails.send({
      from: 'Sprint AI <tim@trainofthoughts.be>',
      to: email,
      subject: `Your Business Case: ${bc.name}`,
      html: `
        <h2>Here's your business case: ${bc.name}</h2>
        <p>Hi,</p>
        <p>Thank you for your interest in Sprint AI. Please find the <strong>${bc.name}</strong> business case attached.</p>
        <p>Each of our use cases delivers exceptional ROI with payback periods under 12 months.</p>
        <p>Want to discuss how this applies to your company? Reply to this email or book a 30-minute discovery call.</p>
        <br>
        <p>Best regards,<br>Tim Pauwels<br>Sprint AI<br><a href="https://sprint-ai.be">sprint-ai.be</a></p>
      `,
      attachments: [{ filename: bc.file, content: pdfBuffer }],
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
});

// Export leads as CSV
app.get('/api/leads', (_req, res) => {
  let leads = [];
  try { leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); } catch {}

  const csv = 'email,businessCaseId,timestamp\n' +
    leads.map(l => `${l.email},${l.businessCaseId},${l.timestamp}`).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send(csv);
});

app.listen(PORT, () => console.log(`Sprint AI website running on port ${PORT}`));
