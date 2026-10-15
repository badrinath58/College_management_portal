// Prints ONE element (a receipt, hall ticket, timetable...) in a clean page, even when it is inside a popup.
// It copies the element and the site's CSS into a hidden iframe, then prints that iframe.
// In the print dialog the student can choose "Save as PDF" - that is the PDF download for now.
export function printElement(element, title = 'Print') {
  if (!element) return;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
    .map((node) => (node.tagName === 'LINK' ? `<link rel="stylesheet" href="${node.href}">` : node.outerHTML)).join('');
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${title}</title>${styles}</head>` +
            `<body style="background:#fff;padding:16px">${element.outerHTML}</body></html>`);
  doc.close();
  // wait a moment so styles and images (blob: photos) are ready
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1500);
  }, 500);
}
