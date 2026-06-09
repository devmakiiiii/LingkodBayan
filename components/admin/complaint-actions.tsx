'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, Clock, MessageSquare, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Complaint {
  id: string
  subject: string
  description: string
  category: string
  resident_name: string
  resident_email: string
  resident_user_id: string
  location_address: string
  created_at: string
  status: string
  latitude?: number
  longitude?: number
}

interface ComplaintActionsProps {
  complaint: Complaint | null
  isOpen: boolean
  onClose: () => void
  onAction?: (action: string, data: any) => void
}

export function ComplaintActions({ complaint, isOpen, onClose, onAction }: ComplaintActionsProps) {
  const [activeAction, setActiveAction] = useState<'kasunduan' | 'sumbong' | 'reply' | null>(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setActiveAction(null)
      setReplyMessage('')
      setNotes('')
    }
  }, [isOpen])

const handleKasunduan = async () => {
     setIsSubmitting(true)
     try {
       onAction?.('kasunduan', { complaintId: complaint?.id, notes })
       toast.success('Complaint marked as resolved')
       setNotes('')
       setActiveAction(null)
       onClose()
     } finally {
       setIsSubmitting(false)
     }
   }

const handleSumbong = async () => {
     setIsSubmitting(true)
     try {
       onAction?.('sumbong', { complaintId: complaint?.id, notes })
       toast.success('Complaint marked for investigation')
       setNotes('')
       setActiveAction(null)
     } finally {
       setIsSubmitting(false)
     }
   }

const handleReply = async () => {
     setIsSubmitting(true)
     try {
       const supabase = createClient()
       const { data: { user } } = await supabase.auth.getUser()
       if (!user) throw new Error('Admin session not found')

       onAction?.('reply', {
         complaintId: complaint?.id,
         message: replyMessage,
         senderId: user.id,
         recipientUserId: complaint?.resident_user_id,
       })
       toast.success('Response sent successfully')
       setReplyMessage('')
       setActiveAction(null)
     } finally {
       setIsSubmitting(false)
     }
   }

  if (!complaint) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {activeAction === null ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Manage Complaint</DialogTitle>
              <DialogDescription>{complaint.subject}</DialogDescription>
            </DialogHeader>

            {/* Complaint Details */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Complainant</label>
                  <p className="text-sm text-gray-600">{complaint.resident_name}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Email</label>
                  <p className="text-sm text-gray-600">{complaint.resident_email}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Category</label>
                <p className="text-sm text-gray-600">{complaint.category}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Location</label>
                <p className="text-sm text-gray-600">{complaint.location_address}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Description</label>
                <p className="text-sm text-gray-600">{complaint.description}</p>
              </div>

              <div className="flex gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Submitted</label>
                  <p className="text-sm text-gray-600">
                    {new Date(complaint.created_at).toLocaleString('en-PH')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Status</label>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      complaint.status === 'pending'
                        ? 'bg-red-100 text-red-800'
                        : complaint.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {complaint.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() => setActiveAction('kasunduan')}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Kasunduan
              </Button>
              <Button
                onClick={() => setActiveAction('sumbong')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white flex items-center gap-2"
              >
                <Clock size={18} />
                Sumbong
              </Button>
              <Button
                onClick={() => setActiveAction('reply')}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <MessageSquare size={18} />
                Reply
              </Button>
            </div>
          </>
        ) : activeAction === 'kasunduan' ? (
          <>
            <DialogHeader>
              <DialogTitle>Settlement (Kasunduan)</DialogTitle>
              <DialogDescription>Close this complaint as resolved</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Settlement Notes
                </label>
                <Textarea
                  placeholder="Describe the settlement agreement..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border border-gray-300 rounded-lg"
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleKasunduan}
                  disabled={isSubmitting || !notes.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Settlement'}
                </Button>
                <Button
                  onClick={() => setActiveAction(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </>
        ) : activeAction === 'sumbong' ? (
          <>
            <DialogHeader>
              <DialogTitle>Process Report (Sumbong)</DialogTitle>
              <DialogDescription>Acknowledge and mark for investigation</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Investigation Notes
                </label>
                <Textarea
                  placeholder="Add notes for processing..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border border-gray-300 rounded-lg"
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSumbong}
                  disabled={isSubmitting}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  {isSubmitting ? 'Processing...' : 'Start Investigation'}
                </Button>
                <Button
                  onClick={() => setActiveAction(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reply to Complainant</DialogTitle>
              <DialogDescription>Send an update to {complaint.resident_name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Your Message
                </label>
                <Textarea
                  placeholder="Type your message here..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="border border-gray-300 rounded-lg"
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleReply}
                  disabled={isSubmitting || !replyMessage.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? 'Sending...' : 'Send Reply'}
                </Button>
                <Button
                  onClick={() => setActiveAction(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}