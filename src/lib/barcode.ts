import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

export function generateBarcodeDataURL(value: string): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, value, {
    format: 'CODE128',
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 12,
    margin: 4,
    background: 'transparent',
  })
  return canvas.toDataURL('image/png')
}

export function generateBarcodeSVG(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, value, {
    format: 'CODE128',
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 12,
    margin: 4,
  })
  return new XMLSerializer().serializeToString(svg)
}

export async function generateQRCodeDataURL(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    width: 120,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export function generateLotNumber(index: number): string {
  return `TC-LOT-${String(index).padStart(6, '0')}`
}

export function generateOrderNumber(): string {
  const num = Math.floor(Math.random() * 90000) + 10000
  return `AUC-${num}`
}
