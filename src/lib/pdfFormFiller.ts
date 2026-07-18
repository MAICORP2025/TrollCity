import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib'

type FormDataMap = Record<string, string | boolean | number | undefined>

interface FillPdfOptions {
  templatePath: string
  fields: FormDataMap
}

export async function fillPdfForm({ templatePath, fields }: FillPdfOptions): Promise<Uint8Array> {
  const response = await fetch(templatePath)
  if (!response.ok) {
    throw new Error(`Failed to load PDF template: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const form = pdfDoc.getForm()

  for (const [fieldName, value] of Object.entries(fields)) {
    const field = form.getField(fieldName)
    
    if (field instanceof PDFTextField) {
      if (typeof value === 'string') {
        field.setText(value)
      }
    } else if (field instanceof PDFCheckBox) {
      if (typeof value === 'boolean') {
        if (value) {
          field.check()
        } else {
          field.uncheck()
        }
      }
    }
  }

  return await pdfDoc.save()
}

export async function downloadFilledPdf(filledPdf: Uint8Array, filename: string) {
  const blob = new Blob([filledPdf.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
