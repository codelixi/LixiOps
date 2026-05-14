// Lazy-loads html2canvas + jspdf only when export is invoked.
const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89

export async function exportInvoicePdf(invoiceNumber: string) {
  const coverEl = document.getElementById('invoice-pdf-cover')
  const detailsEl = document.getElementById('invoice-pdf-details')

  if (!coverEl || !detailsEl) {
    throw new Error('Invoice elements not found for PDF export')
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])

  const captureElement = (el: HTMLElement) =>
    html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

  // Page 1: Cover
  const coverCanvas = await captureElement(coverEl)
  const coverImgData = coverCanvas.toDataURL('image/jpeg', 0.95)
  const coverRatio = coverCanvas.height / coverCanvas.width
  const coverWidth = A4_WIDTH_PT
  const coverHeight = coverWidth * coverRatio
  pdf.addImage(coverImgData, 'JPEG', 0, 0, coverWidth, Math.min(coverHeight, A4_HEIGHT_PT))

  // Page 2: Details
  pdf.addPage()
  const detailsCanvas = await captureElement(detailsEl)
  const detailsImgData = detailsCanvas.toDataURL('image/jpeg', 0.95)
  const detailsRatio = detailsCanvas.height / detailsCanvas.width
  const detailsWidth = A4_WIDTH_PT
  const detailsHeight = detailsWidth * detailsRatio
  pdf.addImage(detailsImgData, 'JPEG', 0, 0, detailsWidth, Math.min(detailsHeight, A4_HEIGHT_PT))

  pdf.save(`${invoiceNumber}.pdf`)
}
