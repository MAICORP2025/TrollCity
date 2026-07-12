import React, { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee, EMPLOYEE_CORP, EMPLOYEE_BUSINESS } from '../permissions'

export default function PayrollTab({ profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const isMgmt = canEmployee(realProfile, 'edit_payroll')
  const [stubs, setStubs] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    if (isMgmt) {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from('employee_paystubs').select('*, user:user_profiles(username)').order('pay_period_end', { ascending: false }).limit(100),
        supabase.from('employee_payroll_runs').select('*').order('created_at', { ascending: false }).limit(20),
      ])
      setStubs((s as any[]) || [])
      setRuns((r as any[]) || [])
    } else {
      const { data: s } = await supabase.from('employee_paystubs').select('*').eq('user_id', user?.id).order('pay_period_end', { ascending: false }).limit(50)
      setStubs((s as any[]) || [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [user, isMgmt])

  const downloadStub = (stub: any) => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(EMPLOYEE_CORP, 14, 20)
    doc.setFontSize(11)
    doc.text(EMPLOYEE_BUSINESS, 14, 27)
    doc.setFontSize(8)
    doc.text('PAY STUB — CONFIDENTIAL', 14, 33)

    autoTable(doc, {
      startY: 40,
      head: [['Field', 'Value']],
      body: [
        ['Employee', isMgmt ? (stub.user?.username ?? stub.user_id) : (profile?.username ?? '')],
        ['Pay Period', `${stub.pay_period_start} to ${stub.pay_period_end}`],
        ['Pay Date', stub.pay_date],
        ['Location', [stub.location_city, stub.location_state].filter(Boolean).join(', ') || '—'],
        ['Hours', String(stub.hours)],
        ['Rate', `$${Number(stub.rate).toFixed(2)}`],
        ['Gross Pay', `$${Number(stub.gross_pay).toFixed(2)}`],
        ['Federal Tax', `$${Number(stub.federal_tax).toFixed(2)}`],
        ['State Tax', `$${Number(stub.state_tax).toFixed(2)}`],
        ['FICA', `$${Number(stub.fica).toFixed(2)}`],
        ['Medicare', `$${Number(stub.medicare).toFixed(2)}`],
        ['Net Pay', `$${Number(stub.net_pay).toFixed(2)}`],
      ],
      theme: 'grid',
      styles: { fontSize: 10 },
    })
    doc.save(`paystub_${stub.pay_period_end}.pdf`)
  }

  if (loading) return <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-slate-400">Loading payroll…</div>

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Payroll {isMgmt ? '(All Employees)' : '(My Paystubs)'}</h2>
          {isMgmt && <span className="text-xs text-emerald-300">Use Management → Perk Pay → Run Payroll to generate</span>}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-white/10">
                {isMgmt && <th className="px-3 py-2 text-left">Employee</th>}
                <th className="px-3 py-2 text-left">Period</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {stubs.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No paystubs yet.</td></tr>}
              {stubs.map((s) => {
                const tax = Number(s.federal_tax) + Number(s.state_tax) + Number(s.fica) + Number(s.medicare)
                return (
                  <tr key={s.id} className="border-b border-white/5">
                    {isMgmt && <td className="px-3 py-2 text-slate-200">{s.user?.username ?? s.user_id}</td>}
                    <td className="px-3 py-2 text-slate-300">{s.pay_period_start} → {s.pay_period_end}</td>
                    <td className="px-3 py-2 text-right text-slate-200">${Number(s.gross_pay).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-red-300">${tax.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">${Number(s.net_pay).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => downloadStub(s)} className="rounded-lg border border-white/10 px-2 py-1 text-xs">Download</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isMgmt && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">Payroll Runs</h2>
          <div className="space-y-2">
            {runs.length === 0 && <p className="text-sm text-slate-400">No runs.</p>}
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <span className="text-slate-200">{r.period_start} → {r.period_end}</span>
                <span className="text-xs text-slate-400">{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
