import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { toast } from 'sonner'
import { Calendar } from 'lucide-react'

interface InterviewSchedulerModalProps {
  isOpen: boolean
  onClose: () => void
  applicantId: string
  applicantName: string
  onScheduled: () => void
}

export function InterviewSchedulerModal({
  isOpen,
  onClose,
  applicantId,
  applicantName,
  onScheduled
}: InterviewSchedulerModalProps) {
  const [loading, setLoading] = useState(false)
  const [scheduleNow, setScheduleNow] = useState(true)
  const [scheduledDate, setScheduledDate] = useState('')

  const handleSchedule = async () => {
    setLoading(true)
    try {
      const roomId = `interview-${applicantId}-${Date.now()}`
      
      const { error } = await supabase
        .from('interviews')
        .insert({
          applicant_id: applicantId,
          room_id: roomId,
          status: 'pending',
          scheduled_at: scheduleNow ? new Date().toISOString() : new Date(scheduledDate).toISOString()
        })

      if (error) throw error

      toast.success('Interview scheduled successfully')
      onScheduled()
      onClose()
    } catch (error: any) {
      console.error('Error scheduling interview:', error)
      toast.error('Failed to schedule interview')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1A1A2E] border-purple-800 text-white">
        <DialogHeader>
          <DialogTitle>Schedule Interview for {applicantName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-gray-300">
            Each interview is 15 minutes long. You can start it now or schedule for later.
          </p>

          <div className="flex items-center gap-4">
            <Button
              variant={scheduleNow ? 'default' : 'outline'}
              onClick={() => setScheduleNow(true)}
              className={scheduleNow ? 'bg-purple-600' : 'border-purple-600 text-purple-300'}
            >
              Start Now
            </Button>
            <Button
              variant={!scheduleNow ? 'default' : 'outline'}
              onClick={() => setScheduleNow(false)}
              className={!scheduleNow ? 'bg-purple-600' : 'border-purple-600 text-purple-300'}
            >
              Schedule Later
            </Button>
          </div>

          {!scheduleNow && (
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="pl-10 bg-black/40 border-purple-800 text-white"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSchedule} 
            disabled={loading || (!scheduleNow && !scheduledDate)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? 'Scheduling...' : 'Confirm Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
