const PDFDocument = require('pdfkit');
const config = require('./config');
const { fmt, fmtDate } = require('./helpers');

const mm = n => (n * 72) / 25.4;
const BRAND = '#1E5B4A';
const INK = '#16201B';
const MUTED = '#58625D';
const LINE = '#D6DBD4';
const SOFT = '#E9ECE7';

function buildCertificatePDF({ project, productName, clientName, signoff, signatureBuffer, stats, milestones }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: mm(18), bottom: mm(18), left: mm(18), right: mm(18) },
      info: {
        Title: `UAT Completion Certificate ${signoff.verification_id}`,
        Author: project.owner_name || 'UAT Desk',
        Subject: `${productName} ${project.version}`
      }
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const M = mm(18);
    const CW = W - M * 2;

    doc.rect(0, 0, W, mm(30)).fill(BRAND);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18)
      .text('UAT Completion Certificate', M, mm(11), { width: CW });
    doc.font('Helvetica').fontSize(10)
      .text(`Verification ID: ${signoff.verification_id}`, M, mm(21))
      .text(`Signed ${fmt(signoff.signed_at)}`, M, mm(21), { width: CW, align: 'right' });

    let y = mm(41);
    doc.fillColor(INK).font('Helvetica').fontSize(11.5);
    const statement = `This certifies that ${clientName} has completed user acceptance testing of ${productName} ${project.version} and accepts it as meeting the agreed UAT checklist of ${stats.total} items across ${milestones.length} milestones.`;
    doc.text(statement, M, y, { width: CW, lineGap: 2.5 });
    y = doc.y + mm(9);

    const details = [
      ['Client', clientName],
      ['Product', `${productName} ${project.version}`],
      ['Project ID', project.token],
      ['Company contact', project.owner_name],
      ['UAT opened', fmtDate(project.created_at)],
      ['Signed on', fmt(signoff.signed_at)]
    ];
    const colW = CW / 3;
    details.forEach(([label, value], i) => {
      const x = M + (i % 3) * colW;
      const rowY = y + Math.floor(i / 3) * mm(14);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(label, x, rowY, { width: colW - mm(4) });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text(String(value || ''), x, rowY + mm(5), { width: colW - mm(4) });
    });
    y += mm(14) * 2 + mm(8);

    const ensureSpace = needed => {
      if (y + needed > H - mm(28)) {
        doc.addPage();
        y = mm(20);
      }
    };

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Milestones', M, y);
    y += mm(6);

    const cols = [M, M + mm(92), M + mm(112), M + mm(134), M + mm(158)];
    ensureSpace(mm(12));
    doc.rect(M, y, CW, mm(8)).fill(SOFT);
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9);
    ['Milestone', 'Items', 'Passed', 'Not applicable', 'Completed'].forEach((h, i) => {
      doc.text(h, cols[i] + mm(2), y + mm(2.5), { width: mm(24) });
    });
    y += mm(8);

    doc.font('Helvetica').fontSize(10);
    for (const [i, m] of milestones.entries()) {
      ensureSpace(mm(9));
      const pass = m.items.filter(it => it.status === 'pass').length;
      const na = m.items.filter(it => it.status === 'na').length;
      const completedAt = m.items.reduce((max, it) => Math.max(max, it.tested_at ? new Date(it.tested_at).getTime() : 0), 0);
      doc.fillColor(INK)
        .text(`${i + 1}. ${m.name}`, cols[0] + mm(2), y + mm(2), { width: mm(86) })
        .text(String(m.items.length), cols[1] + mm(2), y + mm(2))
        .text(String(pass), cols[2] + mm(2), y + mm(2))
        .text(String(na), cols[3] + mm(2), y + mm(2))
        .text(completedAt ? fmtDate(completedAt) : '—', cols[4] + mm(2), y + mm(2));
      y += mm(8);
      doc.strokeColor(LINE).lineWidth(0.5).moveTo(M, y).lineTo(W - M, y).stroke();
    }

    y += mm(6);
    const testers = [...new Set(milestones.flatMap(m => m.items.map(it => it.tester_name).filter(Boolean)))];
    doc.fillColor(MUTED).font('Helvetica').fontSize(9.5)
      .text(`Tested by: ${testers.join(', ') || 'the client team'}`, M, y, { width: CW });
    y += mm(12);

    ensureSpace(mm(52));
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`Signed for ${clientName}`, M, y);
    y += mm(3);

    if (signatureBuffer) {
      try {
        doc.image(signatureBuffer, M, y, { fit: [mm(70), mm(22)] });
      } catch {
        /* fall back to the name below */
      }
      y += mm(24);
    } else {
      doc.fillColor('#1A2A5A').font('Helvetica-Oblique').fontSize(22)
        .text(signoff.signer_name, M, y, { width: CW });
      y = doc.y + mm(4);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Typed electronic signature', M, y);
      y += mm(6);
    }

    doc.strokeColor(INK).lineWidth(0.8).moveTo(M, y).lineTo(M + mm(80), y).stroke();
    y += mm(4);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(signoff.signer_name, M, y);
    y = doc.y + mm(1);
    doc.font('Helvetica').fontSize(9.5)
      .text(`${signoff.signer_designation}, ${clientName}`, M, y)
      .text(signoff.signer_email, M, doc.y + mm(1));
    doc.fillColor(MUTED).fontSize(8.5)
      .text(`Email verified by one-time code on ${fmt(signoff.otp_verified_at)}`, M, doc.y + mm(2));
    y = doc.y + mm(8);

    ensureSpace(mm(24));
    doc.rect(M, y, CW, mm(22)).fill(SOFT);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('Record fingerprint (SHA-256)', M + mm(4), y + mm(5));
    doc.font('Courier').fontSize(8.5).text(signoff.record_hash, M + mm(4), y + mm(10), { width: CW - mm(8) });
    doc.font('Helvetica').fillColor(MUTED).fontSize(8)
      .text(`IP address and device at signing: ${signoff.ip || 'not captured'}`, M + mm(4), y + mm(17), { width: CW - mm(8) });
    y += mm(26);

    const footer = `Check this certificate at ${config.appBaseUrl}/verify using verification ID ${signoff.verification_id}.`;
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text(footer, M, H - mm(14), { width: CW, align: 'center' });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(i);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8)
        .text(`Page ${i + 1} of ${pages.count}`, M, H - mm(9), { width: CW, align: 'right' });
    }

    doc.end();
  });
}

module.exports = { buildCertificatePDF, fmt, fmtDate };
