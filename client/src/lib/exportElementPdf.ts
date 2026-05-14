// ───────────────────────────────────────────
// Generic element-to-PDF exporter.
// Captures the DOM at `elementId`, splits the canvas into A4-portrait
// pages if it's taller than one page, and triggers a download named
// `<fileNameBase>.pdf`. Used by Reports, Documents (proposals), and
// anywhere else that needs "print this view" behaviour.
//
// html2canvas + jspdf are dynamically imported so the ~600KB of PDF
// machinery only loads when someone actually clicks "Export".
// ───────────────────────────────────────────

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const MARGIN_PT = 24

export interface ExportPdfOptions {
  elementId: string
  fileNameBase: string
  /** Background color for the canvas capture (default white) */
  backgroundColor?: string
  /** Image quality 0..1 (default 0.92) */
  quality?: number
}

export async function exportElementToPdf(opts: ExportPdfOptions): Promise<void> {
  const el = document.getElementById(opts.elementId)
  if (!el) throw new Error(`Element #${opts.elementId} not found`)

  // Lazy-load the heavy PDF deps so they only ship when an export runs
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: opts.backgroundColor ?? '#ffffff',
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const usableWidth = A4_WIDTH_PT - MARGIN_PT * 2
  const usableHeight = A4_HEIGHT_PT - MARGIN_PT * 2

  // Scale: capture is `canvas.width` px wide; we render it at `usableWidth` pt wide.
  const scale = usableWidth / canvas.width
  const totalHeightPt = canvas.height * scale

  if (totalHeightPt <= usableHeight) {
    // Single page
    pdf.addImage(canvas.toDataURL('image/jpeg', opts.quality ?? 0.92), 'JPEG', MARGIN_PT, MARGIN_PT, usableWidth, totalHeightPt)
  } else {
    // Slice into pages
    const pxPerPage = usableHeight / scale
    let yPx = 0
    let pageNum = 0
    while (yPx < canvas.height) {
      const sliceHeight = Math.min(pxPerPage, canvas.height - yPx)
      // Render slice to a temporary canvas
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeight
      const ctx = sliceCanvas.getContext('2d')!
      ctx.fillStyle = opts.backgroundColor ?? '#ffffff'
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
      ctx.drawImage(canvas, 0, yPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
      if (pageNum > 0) pdf.addPage()
      pdf.addImage(
        sliceCanvas.toDataURL('image/jpeg', opts.quality ?? 0.92),
        'JPEG',
        MARGIN_PT,
        MARGIN_PT,
        usableWidth,
        sliceHeight * scale,
      )
      yPx += sliceHeight
      pageNum++
    }
  }

  pdf.save(`${opts.fileNameBase}.pdf`)
}
