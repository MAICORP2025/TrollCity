import { fillPdfForm } from './pdfFormFiller'

export interface I9FormData {
  firstName: string
  lastName: string
  middleInitial: string
  otherLastNames: string
  street: string
  apt: string
  city: string
  state: string
  zip: string
  country: string
  dob: string
  ssn: string
  email: string
  phone: string
  status: '1' | '2' | '3' | '4'
  alienNumber: string
  issuingCountry: string
  authExpiry: string
  i94: string
  foreignPassport: string
  attest: boolean
  signature: string
  date: string
}

export async function generateI9Pdf(data: I9FormData): Promise<Uint8Array> {
  const fields: Record<string, string | boolean> = {
    'Last Name (Family Name)': data.lastName,
    'First Name (Given Name)': data.firstName,
    'Middle initial if any': data.middleInitial,
    'Employee Other Last Names Used (if any)': data.otherLastNames,
    'Address Street Number and Name': data.street,
    'Apt Number (if any)': data.apt,
    'City or Town': data.city,
    'State': data.state,
    'ZIP Code': data.zip,
    'Employees E-mail Address': data.email,
    'Telephone Number': data.phone,
    'Date of Birth mmddyyyy': data.dob,
    'US Social Security Number': data.ssn,
    'CB_1': data.status === '1',
    'CB_2': data.status === '2',
    'CB_3': data.status === '3',
    'CB_4': data.status === '4',
    'USCIS ANumber': data.alienNumber,
    'Exp Date mmddyyyy': data.authExpiry,
    'Form I94 Admission Number': data.i94 || '',
    'Foreign Passport Number and Country of IssuanceRow1': data.foreignPassport || '',
    'Signature of Employee': data.signature,
    'Sig Date mmddyyyy': data.date,
  }

  return fillPdfForm({
    templatePath: '/forms/i-9.pdf',
    fields,
  })
}

export interface W4FormData {
  firstName: string
  lastName: string
  ssn: string
  street: string
  city: string
  state: string
  zip: string
  filingStatus: 'single' | 'married' | 'hoh'
  exempt: boolean
  dependentsTotal: string
  dependentsAmount: string
  otherIncome: string
  deductions: string
  extraWithholding: string
  signature: string
  date: string
}

export async function generateW4Pdf(data: W4FormData): Promise<Uint8Array> {
  const filingStatusIndex = data.filingStatus === 'single' ? 0 : data.filingStatus === 'married' ? 1 : 2
  
  const fields: Record<string, string | boolean> = {
    'topmostSubform[0].Page1[0].Step1a[0].f1_01[0]': data.firstName,
    'topmostSubform[0].Page1[0].Step1a[0].f1_02[0]': data.lastName,
    'topmostSubform[0].Page1[0].Step1a[0].f1_03[0]': data.ssn,
    'topmostSubform[0].Page1[0].Step1a[0].f1_04[0]': data.street,
    'topmostSubform[0].Page1[0].f1_05[0]': `${data.city}, ${data.state} ${data.zip}`,
    'topmostSubform[0].Page1[0].c1_1[0]': filingStatusIndex === 0,
    'topmostSubform[0].Page1[0].c1_1[1]': filingStatusIndex === 1,
    'topmostSubform[0].Page1[0].c1_1[2]': filingStatusIndex === 2,
    'topmostSubform[0].Page1[0].c1_2[0]': data.exempt,
    'topmostSubform[0].Page1[0].Step3_ReadOrder[0].f1_07[0]': data.dependentsTotal,
    'topmostSubform[0].Page1[0].Step3_ReadOrder[0].f1_06[0]': data.dependentsAmount,
    'topmostSubform[0].Page1[0].f1_09[0]': data.otherIncome,
    'topmostSubform[0].Page1[0].f1_10[0]': data.deductions,
    'topmostSubform[0].Page1[0].f1_11[0]': data.extraWithholding,
    'topmostSubform[0].Page3[0].f3_01[0]': data.signature,
    'topmostSubform[0].Page3[0].f3_02[0]': data.date,
  }

  return fillPdfForm({
    templatePath: '/forms/w4-2025.pdf',
    fields,
  })
}
