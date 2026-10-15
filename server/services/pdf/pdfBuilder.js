// A small layout toolkit on top of pdf-lib (free, MIT licence). It handles the boring parts of a document:
// page breaks, wrapped text, tables with repeating header rows, the college header and a page-number footer.
// The documents themselves (receipt, hall ticket...) are in documents.js and only describe WHAT to print.
//
// Coordinates in pdf-lib start at the BOTTOM-left corner, so "y" counts upwards. We keep `this.y` as the
// current writing position and move it downwards as we add content.
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const COLORS = {
  ink: rgb(0.1, 0.12, 0.16), muted: rgb(0.4, 0.45, 0.52), line: rgb(0.62, 0.66, 0.72),
  head: rgb(0.89, 0.91, 0.95), accent: rgb(0.12, 0.25, 0.69), good: rgb(0.08, 0.5, 0.24), bad: rgb(0.72, 0.11, 0.11),
};
const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'logo.png');

class PdfBuilder {
  constructor(doc, fonts, logo, landscape) {
    this.doc = doc; this.font = fonts.regular; this.bold = fonts.bold; this.logo = logo;
    this.size = landscape ? [841.89, 595.28] : [595.28, 841.89];            // A4
    this.margin = 40; this.footerSpace = 30;
    this.chars = new Set(this.font.getCharacterSet());                      // letters the standard font can print
    this.addPage();
  }

  static async create({ title, landscape = false }) {
    const doc = await PDFDocument.create();
    doc.setTitle(title); doc.setProducer('College Management Portal'); doc.setCreator('College Management Portal');
    const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
    let logo = null;
    try { logo = await doc.embedPng(fs.readFileSync(LOGO_PATH)); } catch (e) { /* no logo file: print without it */ }
    return new PdfBuilder(doc, fonts, logo, landscape);
  }

  get contentWidth() { return this.size[0] - 2 * this.margin; }
  get bottom() { return this.margin + this.footerSpace; }

  addPage() { this.page = this.doc.addPage(this.size); this.y = this.size[1] - this.margin; }
  space(n) { this.y -= n; }

  // Standard PDF fonts only know Latin letters: swap the rupee sign for "Rs." and anything unknown for "?"
  safe(text) {
    return String(text ?? '-').replace(/\u20B9/g, 'Rs.').replace(/[\r\t]/g, ' ')
      .split('').map((ch) => (ch === '\n' || this.chars.has(ch.codePointAt(0)) ? ch : '?')).join('');
  }
  width(text, size, bold = false) { return (bold ? this.bold : this.font).widthOfTextAtSize(this.safe(text).replace(/\n/g, ' '), size); }

  // split text into lines that fit `maxWidth` (honours \n and breaks very long words)
  wrap(text, maxWidth, size, bold = false) {
    const lines = [];
    this.safe(text).split('\n').forEach((paragraph) => {
      let line = '';
      paragraph.split(/\s+/).filter(Boolean).forEach((word) => {
        let w = word;
        while (this.width(w, size, bold) > maxWidth) {                      // a word wider than the box
          let cut = w.length - 1;
          while (cut > 1 && this.width(w.slice(0, cut), size, bold) > maxWidth) cut -= 1;
          if (line) { lines.push(line); line = ''; }
          lines.push(w.slice(0, cut)); w = w.slice(cut);
        }
        const test = line ? `${line} ${w}` : w;
        if (this.width(test, size, bold) <= maxWidth) line = test; else { lines.push(line); line = w; }
      });
      lines.push(line);
    });
    return lines.length ? lines : [''];
  }

  // draw ONE line at an exact position (y = baseline)
  drawText(text, { x, y, size = 10, bold = false, color = COLORS.ink, align = 'left', width }) {
    const clean = this.safe(text).replace(/\n/g, ' ');
    const w = this.width(clean, size, bold);
    let px = x;
    if (align === 'center') px = x + (width - w) / 2; else if (align === 'right') px = x + width - w;
    this.page.drawText(clean, { x: px, y, size, font: bold ? this.bold : this.font, color });
  }

  ensure(height) { if (this.y - height < this.bottom) { this.addPage(); return true; } return false; }

  // wrapped paragraph that moves the writing position down
  paragraph(text, { size = 10, bold = false, color = COLORS.ink, align = 'left', gap = 4, x = this.margin, width = this.contentWidth } = {}) {
    const lh = size * 1.35;
    this.wrap(text, width, size, bold).forEach((line) => {
      this.ensure(lh);
      this.drawText(line, { x, y: this.y - size, size, bold, color, align, width });
      this.y -= lh;
    });
    this.y -= gap;
  }

  heading(text, size = 11) { this.ensure(size * 2.4); this.space(6); this.paragraph(text, { size, bold: true, color: COLORS.accent, gap: 3 }); }
  rule(color = COLORS.line, thickness = 0.8) {
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.size[0] - this.margin, y: this.y }, thickness, color });
    this.y -= 6;
  }

  // college name, document title and (optionally) a photo on the right
  header({ college, title, subtitle, rightLines = [], photo }) {
    const top = this.y;
    const logoSize = 54;
    if (this.logo) this.page.drawImage(this.logo, { x: this.margin, y: top - logoSize, width: logoSize, height: logoSize });
    const left = this.margin + logoSize + 10;
    const rightW = photo ? 84 : 150;
    const centerW = this.contentWidth - logoSize - 10 - rightW - 10;
    let y = top - 14;
    this.drawText(college, { x: left, y, size: 14, bold: true, align: 'center', width: centerW, color: COLORS.accent }); y -= 17;
    this.drawText(title, { x: left, y, size: 11, bold: true, align: 'center', width: centerW }); y -= 14;
    if (subtitle) { this.drawText(subtitle, { x: left, y, size: 9, align: 'center', width: centerW, color: COLORS.muted }); }
    const rightX = this.size[0] - this.margin - rightW;
    if (photo) {
      this.page.drawRectangle({ x: rightX + 2, y: top - 100, width: 80, height: 100, borderColor: COLORS.line, borderWidth: 0.8 });
      const fit = photo.scaleToFit(78, 98);
      this.page.drawImage(photo, { x: rightX + 2 + (80 - fit.width) / 2, y: top - 100 + (100 - fit.height) / 2, width: fit.width, height: fit.height });
    } else {
      rightLines.forEach((l, i) => this.drawText(l.text, { x: rightX, y: top - 14 - i * 13, size: l.size || 9, bold: l.bold, align: 'right', width: rightW, color: l.color || COLORS.ink }));
    }
    this.y = top - (photo ? 108 : logoSize + 8);
    this.rule(COLORS.ink, 1.4);
    this.space(4);
  }

  // label : value pairs in 1 or 2 columns
  keyValues(pairs, { columns = 2, labelWidth = 92, size = 9.5 } = {}) {
    const colW = this.contentWidth / columns;
    for (let i = 0; i < pairs.length; i += columns) {
      const row = pairs.slice(i, i + columns);
      const cells = row.map(([label, value]) => ({ label, lines: this.wrap(value, colW - labelWidth - 8, size, true) }));
      const h = Math.max(...cells.map((c) => c.lines.length)) * size * 1.4 + 3;
      this.ensure(h);
      cells.forEach((c, n) => {
        const x = this.margin + n * colW;
        this.drawText(c.label, { x, y: this.y - size, size, color: COLORS.muted });
        c.lines.forEach((ln, k) => this.drawText(ln, { x: x + labelWidth, y: this.y - size - k * size * 1.4, size, bold: true }));
      });
      this.y -= h;
    }
    this.y -= 4;
  }

  // columns = [{ header, width (weight), align: 'left'|'right'|'center', value: (row) => text }]
  // A row may set _bold: true. The header row repeats on every new page.
  table({ columns, rows, fontSize = 8.5, padding = 4, headFill = COLORS.head }) {
    const totalWeight = columns.reduce((s, c) => s + (c.width || 1), 0);
    const widths = columns.map((c) => ((c.width || 1) / totalWeight) * this.contentWidth);
    const lh = fontSize * 1.3;

    const drawRow = (cells, bold, fill) => {
      const lines = cells.map((text, i) => this.wrap(text, widths[i] - 2 * padding, fontSize, bold));
      const h = Math.max(...lines.map((l) => l.length)) * lh + 2 * padding;
      let x = this.margin;
      cells.forEach((_, i) => {
        this.page.drawRectangle({ x, y: this.y - h, width: widths[i], height: h, borderColor: COLORS.line, borderWidth: 0.6, color: fill });
        lines[i].forEach((ln, k) => this.drawText(ln, { x: x + padding, y: this.y - padding - fontSize - k * lh + 1, size: fontSize, bold, align: columns[i].align || 'left', width: widths[i] - 2 * padding }));
        x += widths[i];
      });
      this.y -= h;
      return h;
    };
    const headHeight = () => Math.max(...columns.map((c, i) => this.wrap(c.header, widths[i] - 2 * padding, fontSize, true).length)) * lh + 2 * padding;
    const head = () => drawRow(columns.map((c) => c.header), true, headFill);

    this.ensure(headHeight() + lh + 2 * padding);
    head();
    rows.forEach((row) => {
      const cells = columns.map((c) => (c.value ? c.value(row) : row[c.key]) ?? '-');     // missing -> '-', an intentional '' stays empty
      const bold = Boolean(row._bold);
      const needed = Math.max(...cells.map((t, i) => this.wrap(t, widths[i] - 2 * padding, fontSize, bold).length)) * lh + 2 * padding;
      if (this.y - needed < this.bottom) { this.addPage(); head(); }
      drawRow(cells, bold, undefined);
    });
    this.y -= 8;
  }

  signatures(labels) {
    this.ensure(70);
    this.space(46);
    const colW = this.contentWidth / labels.length;
    labels.forEach((label, i) => {
      const x = this.margin + i * colW + 12;
      this.page.drawLine({ start: { x, y: this.y }, end: { x: x + colW - 36, y: this.y }, thickness: 0.8, color: COLORS.ink });
      this.drawText(label, { x, y: this.y - 12, size: 8.5, align: 'center', width: colW - 36, color: COLORS.muted });
    });
    this.y -= 22;
  }

  // a big coloured word, e.g. PAID
  stamp(text, color = COLORS.good) {
    this.ensure(28);
    this.drawText(text, { x: this.margin, y: this.y - 20, size: 20, bold: true, align: 'right', width: this.contentWidth, color });
    this.y -= 28;
  }

  async embedImage(buffer) {                       // jpg or png (checked by the first bytes), otherwise null
    if (!buffer) return null;
    try {
      if (buffer[0] === 0xff && buffer[1] === 0xd8) return await this.doc.embedJpg(buffer);
      if (buffer[0] === 0x89 && buffer[1] === 0x50) return await this.doc.embedPng(buffer);
    } catch (e) { /* damaged picture: print without it */ }
    return null;
  }

  // page numbers + "generated on" on every page; returns the PDF as a Buffer
  async finish(footerLeft) {
    const pages = this.doc.getPages();
    const stamp = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    pages.forEach((page, i) => {
      const [w] = [page.getWidth()];
      page.drawLine({ start: { x: this.margin, y: this.margin + 14 }, end: { x: w - this.margin, y: this.margin + 14 }, thickness: 0.5, color: COLORS.line });
      const draw = (text, x, align) => {
        const safe = this.safe(text); const tw = this.font.widthOfTextAtSize(safe, 7.5);
        page.drawText(safe, { x: align === 'right' ? x - tw : x, y: this.margin + 3, size: 7.5, font: this.font, color: COLORS.muted });
      };
      draw(`${footerLeft}  |  Computer generated document, generated on ${stamp}`, this.margin, 'left');
      draw(`Page ${i + 1} of ${pages.length}`, w - this.margin, 'right');
    });
    return Buffer.from(await this.doc.save());
  }
}

module.exports = { PdfBuilder, COLORS };
