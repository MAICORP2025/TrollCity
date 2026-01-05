// Officer Payroll PDF Generator
// Generates PDF reports for officer monthly payroll

// Note: You'll need to install jspdf and jspdf-autotable:
// npm install jspdf jspdf-autotable
// npm install --save-dev @types/jspdf

interface PayrollReport {
  officerName: string
  rank: string
  totalEarned: number
  payPeriod: string
  logs: any[]
}

/**
 * Downloads a PDF payroll report for an officer
 * @param report - The payroll report data
 */
export async function downloadPayrollPDF(report: PayrollReport) {
  try {
    // Dynamic import for jspdf
    const jsPDFModule = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    
    const jsPDF = (jsPDFModule as any).default || jsPDFModule
    const autoTable = (autoTableModule as any).default || autoTableModule
    
    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.text('Troll Officer Monthly Payroll Report', 14, 22)

    // Officer Information
    doc.setFontSize(12)
    doc.text(`Officer: ${report.officerName}`, 14, 35)
    doc.text(`Rank: ${report.rank}`, 14, 42)
    doc.text(`Period: ${report.payPeriod}`, 14, 49)

    // Payroll Summary Table
    autoTable(doc, {
      startY: 60,
      head: [['Metric', 'Value']],
      body: [
        ['Total Earned (Coins)', Number(report.totalEarned || 0).toLocaleString()],
        ['Log Count', report.logs.length.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 10 }
    })

    // Conversion and payout info
    const finalY = (doc as any).lastAutoTable?.finalY || 100
    doc.setFontSize(10)
    doc.text('Coin Conversion: 100 coins = $1 USD', 14, finalY + 15)
    
    const estimatedPayout = (Number(report.totalEarned || 0) * 0.01).toFixed(2)
    doc.setFontSize(12)
    doc.text(`Estimated Payout: $${estimatedPayout}`, 14, finalY + 25)
    
    // Footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`,
      14,
      doc.internal.pageSize.height - 10
    )

    // Save PDF
    const filename = `TrollCity_Payroll_${report.officerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  } catch (error: any) {
    console.error('[OfficerPayrollPDF] Error generating PDF:', error)
    alert('PDF generation failed. Please install jspdf: npm install jspdf jspdf-autotable')
  }
}
