import { useEffect, useState, FormEvent } from 'react'
import { Send, Megaphone, User, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'
import { useAuth, useApi } from '../contexts/AuthContext'

// --- Type Definitions ---
type Message = {
  id: string;
  subject: string;
  body: string;
  created_at: string;
  sender_name: string;
  is_announcement: boolean;
  is_read: boolean;
}

type UserOption = {
  id: string;
  name: string;
  role: string;
  email: string;
}

type StudentData = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  parent_id?: string;
  parent_email?: string;
  parent_name?: string;
}

// Mock data removed

export default function Communications() {
  const { user } = useAuth()
  const api = useApi()

  // --- State for Data ---
  const [messages, setMessages] = useState<Message[]>([])
  const [recipients, setRecipients] = useState<UserOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- State for Dialogs ---
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false)
  const [isMessageOpen, setIsMessageOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // --- State for Forms ---
  const [announcementForm, setAnnouncementForm] = useState({ subject: '', body: '' })
  const [messageForm, setMessageForm] = useState({ recipient: '', subject: '', body: '' })

  // --- Data Fetching ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Fetch messages, staff, and students in parallel
        const [msgRes, staffRes, studentRes] = await Promise.all([
          api('/api/messages'),
          api('/api/staff'),
          api('/api/students')
        ])

        if (!msgRes.ok) throw new Error('Failed to fetch messages')
        const msgData = await msgRes.json()
        setMessages(msgData.data || [])

        // Process staff and students into a single recipients list
        const userOptions: UserOption[] = []

        if (staffRes.ok) {
          const staffData = await staffRes.json()
          staffData.data?.forEach((s: UserOption) => {
            userOptions.push({ id: s.id, name: s.name, role: s.role, email: s.email })
          })
        }

        if (studentRes.ok) {
          const studentData = await studentRes.json()
          studentData.data?.forEach((s: StudentData) => {
            // Add student
            userOptions.push({ id: s.user_id, name: `${s.first_name} ${s.last_name}`, role: 'student', email: s.email })
            // Add parent (if they exist)
            if (s.parent_id && s.parent_email) {
              userOptions.push({ 
                id: s.parent_id, 
                name: s.parent_name || 'Parent', 
                role: 'parent', 
                email: s.parent_email 
              })
            }
          })
        }

        // De-duplicate users (in case a parent is also staff, etc.)
        const uniqueUsers = new Map(userOptions.map(u => [u.id, u])).values()
        setRecipients(Array.from(uniqueUsers))

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [api])

  const handleAnnouncementSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    try {
      const response = await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          ...announcementForm,
          is_announcement: true,
          recipient_group: 'all', // Backend handles 'all' for announcements
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to post announcement')

      setMessages(prev => [data.data, ...prev])
      setIsAnnouncementOpen(false)
      setAnnouncementForm({ subject: '', body: '' })

    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMessageSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    // Check if the recipient is a group or an individual ID
    const isGroup = messageForm.recipient.startsWith('all_')

    // Map frontend values to backend expected recipient_type values
    const recipientTypeMap: { [key: string]: string } = {
      'all_staff': 'staff',
      'all_parents': 'parents',
      'all_students': 'students'
    }

    const payload = {
      subject: messageForm.subject,
      body: messageForm.body,
      recipient_type: isGroup ? recipientTypeMap[messageForm.recipient] : 'individual',
      recipient_id: isGroup ? undefined : messageForm.recipient,
      is_announcement: false,
    }

    try {
      const response = await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send message')

      // If sent to an individual, add to list. Group messages might not return.
      if (data.data) {
        setMessages(prev => [data.data, ...prev])
      }

      setIsMessageOpen(false)
      setMessageForm({ recipient: '', subject: '', body: '' })

    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderLoading = () => (
    <div className="flex items-center justify-center p-8 text-gray-600">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      Loading messages...
    </div>
  )

  const renderError = (err: string | null) => err && (
    <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 rounded-md">
      <AlertCircle className="w-4 h-4" /> {err}
    </div>
  )

  const renderFormError = (err: string | null) => err && (
    <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
      <AlertCircle className="w-4 h-4" /> {err}
    </div>
  )

  const canManage = user?.role === 'admin' || user?.role === 'teacher'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Communications</h1>
          <p className="text-gray-600">Send and receive messages and announcements</p>
        </div>

        {canManage && (
          <div className="flex space-x-2">
            {/* --- New Announcement Dialog --- */}
            <Dialog open={isAnnouncementOpen} onOpenChange={(open) => { setIsAnnouncementOpen(open); setFormError(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Megaphone className="w-4 h-4 mr-2" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAnnouncementSubmit}>
                  <DialogHeader>
                    <DialogTitle>New Announcement</DialogTitle>
                    <DialogDescription>
                      This will be sent to all users in the school.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ann-subject">Subject</Label>
                      <Input id="ann-subject" value={announcementForm.subject} onChange={e => setAnnouncementForm({...announcementForm, subject: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ann-body">Body</Label>
                      <Textarea id="ann-body" rows={5} value={announcementForm.body} onChange={e => setAnnouncementForm({...announcementForm, body: e.target.value})} />
                    </div>
                    {renderFormError(formError)}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAnnouncementOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Announcement'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* --- New Message Dialog --- */}
            <Dialog open={isMessageOpen} onOpenChange={(open) => { setIsMessageOpen(open); setFormError(null); }}>
              <DialogTrigger asChild>
                <Button>
                  <Send className="w-4 h-4 mr-2" />
                  New Message
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleMessageSubmit}>
                  <DialogHeader>
                    <DialogTitle>New Message</DialogTitle>
                    <DialogDescription>
                      Send a new message to staff, parents, or specific grades.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    {/* --- THIS IS THE UPGRADED "TO" FIELD --- */}
                    <div className="space-y-2">
                      <Label htmlFor="recipient">To</Label>
                      <Select value={messageForm.recipient} onValueChange={val => setMessageForm({...messageForm, recipient: val})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a recipient or group..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectGroup>
                            <SelectLabel>Groups</SelectLabel>
                            <SelectItem value="all_staff">All Staff</SelectItem>
                            <SelectItem value="all_parents">All Parents</SelectItem>
                            <SelectItem value="all_students">All Students</SelectItem>
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Individuals</SelectLabel>
                            {recipients.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} ({r.role})
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="msg-subject">Subject</Label>
                      <Input id="msg-subject" value={messageForm.subject} onChange={e => setMessageForm({...messageForm, subject: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="msg-body">Body</Label>
                      <Textarea id="msg-body" rows={5} value={messageForm.body} onChange={e => setMessageForm({...messageForm, body: e.target.value})} />
                    </div>
                    {renderFormError(formError)}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsMessageOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Message'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Tabs defaultValue="inbox" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        {renderError(error)}

        {isLoading ? renderLoading() : (
          <>
            <TabsContent value="inbox" className="space-y-4">
              {messages.filter(m => !m.is_announcement).map(message => (
                <Card key={message.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center space-x-3">
                      <User className="w-6 h-6 text-gray-500" />
                      <div>
                        <CardTitle className="text-lg">{message.subject}</CardTitle>
                        <CardDescription>From: {message.sender_name}</CardDescription>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">{new Date(message.created_at).toLocaleString()}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{message.body}</p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="announcements" className="space-y-4">
              {messages.filter(m => m.is_announcement).map(message => (
                <Card key={message.id} className="border-blue-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center space-x-3">
                      <Megaphone className="w-6 h-6 text-blue-500" />
                      <div>
                        <CardTitle className="text-lg">{message.subject}</CardTitle>
                        <CardDescription>From: {message.sender_name}</CardDescription>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">{new Date(message.created_at).toLocaleString()}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{message.body}</p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}