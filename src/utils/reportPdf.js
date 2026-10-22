// A4 PDF export shared by the Reports pages. jspdf is loaded on demand to keep it out of the main bundle.
// Note: jspdf's built-in Helvetica only covers Latin-1 — avoid characters like '—' in PDF text.

const PRIMARY = [51, 63, 72]  // --color-primary
const ACCENT = [224, 203, 75] // --color-accent
const MARGIN = 14

async function loadImage(src) {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

// table: jspdf-autotable options (head, body, foot, columnStyles, ...)
export async function exportReportPdf({ title, cycleName, subtitle, filename, orientation = 'portrait', table }) {
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadImage('/logo_cinza.png'),
  ])

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  doc.addImage(logo, 'PNG', MARGIN, 8, 16, 16)
  doc.setTextColor(...PRIMARY)
  doc.setFont('helvetica', 'bold').setFontSize(14)
  doc.text(title, MARGIN + 21, 14)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(`Ciclo: ${cycleName}`, MARGIN + 21, 20)
  doc.setFontSize(8).setTextColor(120)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`, pageW - MARGIN, 14, { align: 'right' })
  if (subtitle) doc.text(subtitle, MARGIN + 21, 25)

  autoTable(doc, {
    startY: 30,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 14 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, lineColor: [210], lineWidth: 0.1, textColor: 30 },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: ACCENT, textColor: PRIMARY, fontStyle: 'bold' },
    showFoot: 'lastPage',
    ...table,
  })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setTextColor(120)
    doc.text(`Página ${i} de ${pages}`, pageW - MARGIN, pageH - 7, { align: 'right' })
  }

  doc.save(filename)
}

export const pdfFilename = (prefix, cycleName) =>
  `${prefix}_${cycleName}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_') + '.pdf'
