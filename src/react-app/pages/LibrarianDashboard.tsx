import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Library as LibraryIcon, AlertTriangle, RotateCcw, Plus, RefreshCw, PackageCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { useAuth, useApi } from '../contexts/AuthContext'

type LibraryStats = {
  title_count: number
  total_copies: number
  available_copies: number
  copies_on_loan: number
  active_loans: number
  overdue_loans: number
}

type Issue = {
  id: number
  book_title: string
  borrower_name?: string
  borrower_type?: 'student' | 'staff'
  issue_date: string
  due_date: string
  status: 'issued' | 'returned' | 'overdue'
  fine_amount: number
}

export default function LibrarianDashboard() {
  const { user } = useAuth()
  const api = useApi()
  const navigate = useNavigate()

  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [statsRes, issuesRes] = await Promise.all([
        api('/api/library/stats'),
        api('/api/library/issues'),
      ])
      const statsData = await statsRes.json()
      const issuesData = await issuesRes.json()
      if (statsData.success) setStats(statsData.data)
      if (issuesData.success) setIssues(issuesData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleReturn = async (issueId: number) => {
    try {
      const res = await api(`/api/library/issues/${issueId}/return`, { method: 'PUT', body: JSON.stringify({}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to return book')
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return book')
    }
  }

  const overdue = issues.filter((i) => i.status === 'overdue')
  const recent = [...issues].sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1)).slice(0, 6)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LibraryIcon className="h-6 w-6" /> Librarian Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ''} — here's what's happening in the library.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/dashboard/library')}>
            <Plus className="h-4 w-4 mr-2" /> Go to Catalog & Circulation
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Titles Cataloged</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.title_count ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{stats?.total_copies ?? 0} total copies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Copies</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.available_copies ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{stats?.copies_on_loan ?? 0} currently on loan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_loans ?? '—'}</div>
            <p className="text-xs text-muted-foreground">Books currently checked out</p>
          </CardContent>
        </Card>
        <Card className={stats?.overdue_loans ? 'border-destructive/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats?.overdue_loans ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats?.overdue_loans ? 'text-destructive' : ''}`}>
              {stats?.overdue_loans ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">Need follow-up</p>
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Overdue Loans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdue.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between flex-wrap gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{issue.book_title}</p>
                  <p className="text-sm text-muted-foreground">
                    {issue.borrower_name} ({issue.borrower_type}) &middot; was due {issue.due_date}
                    {issue.fine_amount > 0 && ` · fine KES ${issue.fine_amount}`}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleReturn(issue.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Mark Returned
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Circulation Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.map((issue) => (
            <div key={issue.id} className="flex items-center justify-between flex-wrap gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{issue.book_title}</p>
                <p className="text-sm text-muted-foreground">
                  {issue.borrower_name} ({issue.borrower_type}) &middot; issued {issue.issue_date}
                </p>
              </div>
              <Badge variant={issue.status === 'overdue' ? 'destructive' : issue.status === 'returned' ? 'secondary' : 'default'}>
                {issue.status}
              </Badge>
            </div>
          ))}
          {recent.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-sm text-center py-6">No circulation activity yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
