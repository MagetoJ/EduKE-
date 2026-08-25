import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useApi } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertTriangle, BookOpen, Search, Plus, CheckCircle, Clock, Loader2, RotateCcw, RefreshCw, Trash2 } from 'lucide-react';

// --- Types -------------------------------------------------------------
interface Book {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  category: string | null;
  subject_id: number | null;
  total_copies: number;
  available_copies: number;
  location_rack: string | null;
}

interface Issue {
  id: number;
  book_id: number;
  book_title: string;
  borrower_name: string | null;
  borrower_type: 'student' | 'staff' | null;
  student_id: number | null;
  staff_id: number | null;
  issue_date: string | null;
  due_date: string | null;
  return_date: string | null;
  status: 'issued' | 'returned' | 'overdue';
  fine_amount: number;
  fine_paid: boolean;
}

interface StudentOption {
  id: number;
  first_name: string;
  last_name: string;
  admission_number: string;
  grade?: string;
  class?: string;
}

interface StaffOption {
  id: number;
  name: string;
  role: string;
  employee_id?: string;
  department?: string;
}

const emptyNewBook = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  publication_year: '',
  category: '',
  total_copies: 1,
  location_rack: '',
};

function StatusBadge({ status }: { status: Issue['status'] }) {
  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="w-3 h-3" /> Overdue
      </Badge>
    );
  }
  if (status === 'returned') {
    return (
      <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
        <CheckCircle className="w-3 h-3" /> Returned
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-600 gap-1">
      <Clock className="w-3 h-3" /> Active
    </Badge>
  );
}

export default function Library() {
  const { user } = useAuth();
  const api = useApi();
  const isManager = ['admin', 'super_admin', 'librarian'].includes(user?.role || '');

  const [books, setBooks] = useState<Book[]>([]);
  const [myLoans, setMyLoans] = useState<Issue[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [error, setError] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newBook, setNewBook] = useState(emptyNewBook);
  const [savingBook, setSavingBook] = useState(false);

  // Issue Dialog State
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [issueBookId, setIssueBookId] = useState<number | null>(null);
  const [borrowerType, setBorrowerType] = useState<'student' | 'staff'>('student');
  const [borrowerId, setBorrowerId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [issuing, setIssuing] = useState(false);

  const [actioningIssueId, setActioningIssueId] = useState<number | null>(null);

  // --- Fetch helpers ---------------------------------------------------
  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (category !== 'all') params.set('category', category);
      const res = await api(`/api/library/books?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Failed to load the catalog');
      setBooks(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the catalog');
    } finally {
      setLoadingBooks(false);
    }
  }, [api, search, category]);

  const fetchMyLoans = useCallback(async () => {
    try {
      const res = await api('/api/library/my-loans');
      const data = await res.json();
      if (res.ok && data.success) setMyLoans(data.data || []);
    } catch {
      // Non-fatal
    }
  }, [api]);

  const fetchIssues = useCallback(async () => {
    if (!isManager) return;
    setLoadingIssues(true);
    try {
      const res = await api('/api/library/issues');
      const data = await res.json();
      if (res.ok && data.success) setAllIssues(data.data || []);
    } catch {
      // Non-fatal.
    } finally {
      setLoadingIssues(false);
    }
  }, [api, isManager]);

  const fetchBorrowers = useCallback(async () => {
    if (!isManager) return;
    try {
      const [studentsRes, staffRes] = await Promise.all([
        api('/api/students'),
        api('/api/staff'),
      ]);
      const studentsData = await studentsRes.json();
      const staffData = await staffRes.json();
      if (studentsRes.ok) setStudents(studentsData.data || studentsData || []);
      if (staffRes.ok) setStaff(staffData.data || staffData || []);
    } catch {
      // Non-fatal
    }
  }, [api, isManager]);

  useEffect(() => {
    fetchMyLoans();
    if (isManager) {
      fetchIssues();
      fetchBorrowers();
    }
  }, [isManager, fetchIssues, fetchBorrowers, fetchMyLoans]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.category && set.add(b.category));
    return Array.from(set).sort();
  }, [books]);

  const refreshAfterCirculationChange = () => {
    fetchBooks();
    fetchMyLoans();
    if (isManager) fetchIssues();
  };

  // --- Filter Borrowers for Issue Modal ----------------------------------
  const filteredBorrowers = useMemo(() => {
    const query = userSearchQuery.toLowerCase();
    if (borrowerType === 'student') {
      return students.filter(user => 
        !query ||
        (user.first_name + ' ' + user.last_name).toLowerCase().includes(query) ||
        (user.admission_number || '').toLowerCase().includes(query) ||
        (user.grade || '').toLowerCase().includes(query)
      );
    } else {
      return staff.filter(user => 
        !query ||
        user.name.toLowerCase().includes(query) ||
        (user.employee_id || '').toLowerCase().includes(query) ||
        (user.department || '').toLowerCase().includes(query)
      );
    }
  }, [borrowerType, userSearchQuery, students, staff]);

  // --- Actions -----------------------------------------------------------
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBook(true);
    setError('');
    try {
      const res = await api('/api/library/books', {
        method: 'POST',
        body: JSON.stringify({
          ...newBook,
          publication_year: newBook.publication_year ? Number(newBook.publication_year) : null,
          total_copies: Number(newBook.total_copies) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Failed to add the book');
      setIsAddOpen(false);
      setNewBook(emptyNewBook);
      fetchBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add the book');
    } finally {
      setSavingBook(false);
    }
  };

  const handleDeleteBook = async (bookId: number) => {
    if (!window.confirm('Remove this title from the catalog? This only works if no copies are on loan.')) return;
    try {
      const res = await api(`/api/library/books/${bookId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Failed to remove the book');
      fetchBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove the book');
    }
  };

  const openIssueDialog = (bookId: number) => {
    setIssueBookId(bookId);
    setBorrowerType('student');
    setBorrowerId('');
    setUserSearchQuery('');
    setIsIssueOpen(true);
  };

  const handleIssueBook = async () => {
    if (!issueBookId || !borrowerId) return;
    setIssuing(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { book_id: issueBookId };
      if (borrowerType === 'student') payload.student_id = Number(borrowerId);
      else payload.staff_id = Number(borrowerId);

      const res = await api('/api/library/issues', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Failed to issue the book');
      setIsIssueOpen(false);
      refreshAfterCirculationChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue the book');
    } finally {
      setIssuing(false);
    }
  };

  const handleReturn = async (issueId: number) => {
    setActioningIssueId(issueId);
    setError('');
    try {
      const res = await api(`/api/library/issues/${issueId}/return`, {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Failed to return the book');
      refreshAfterCirculationChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return the book');
    } finally {
      setActioningIssueId(null);
    }
  };

  const handleRenew = async (issueId: number) => {
    setActioningIssueId(issueId);
    setError('');
    try {
      const res = await api(`/api/library/issues/${issueId}/renew`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Failed to renew the loan');
      refreshAfterCirculationChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to renew the loan');
    } finally {
      setActioningIssueId(null);
    }
  };

  const activeIssues = allIssues.filter((i) => i.status !== 'returned');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School Library</h1>
          <p className="text-muted-foreground">Manage books, loans, and digital learning materials.</p>
        </div>
        {isManager && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add New Book</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Book to Catalog</DialogTitle>
                <DialogDescription>Register a new title. You can add more copies later by editing total copies.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddBook} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input required value={newBook.title} onChange={e => setNewBook({ ...newBook, title: e.target.value })} />
                </div>
                <div>
                  <Label>Author</Label>
                  <Input value={newBook.author} onChange={e => setNewBook({ ...newBook, author: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ISBN</Label>
                    <Input value={newBook.isbn} onChange={e => setNewBook({ ...newBook, isbn: e.target.value })} />
                  </div>
                  <div>
                    <Label>Publication Year</Label>
                    <Input
                      type="number"
                      value={newBook.publication_year}
                      onChange={e => setNewBook({ ...newBook, publication_year: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category / Subject</Label>
                    <Input value={newBook.category} onChange={e => setNewBook({ ...newBook, category: e.target.value })} />
                  </div>
                  <div>
                    <Label>Total Copies</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newBook.total_copies}
                      onChange={e => setNewBook({ ...newBook, total_copies: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Publisher</Label>
                    <Input value={newBook.publisher} onChange={e => setNewBook({ ...newBook, publisher: e.target.value })} />
                  </div>
                  <div>
                    <Label>Shelf / Rack Location</Label>
                    <Input value={newBook.location_rack} onChange={e => setNewBook({ ...newBook, location_rack: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={savingBook}>
                  {savingBook ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Book
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Book Catalog</TabsTrigger>
          {isManager && <TabsTrigger value="circulation">Circulation{activeIssues.length > 0 ? ` (${activeIssues.length})` : ''}</TabsTrigger>}
          <TabsTrigger value="my-loans">My Borrowed Books</TabsTrigger>
        </TabsList>

        {/* --- Catalog --- */}
        <TabsContent value="catalog" className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Search by Title, Author, or ISBN..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchBooks()}
              className="max-w-sm"
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchBooks} variant="secondary" disabled={loadingBooks}>
              {loadingBooks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {loadingBooks ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : books.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No books found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map(book => (
                <Card key={book.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-medium">{book.title}</CardTitle>
                    <BookOpen className="w-5 h-5 text-muted-foreground shrink-0" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">{book.author ? `By ${book.author}` : 'Author unknown'}</p>
                    <div className="flex justify-between items-center text-xs mb-3">
                      <Badge variant={book.available_copies > 0 ? "default" : "destructive"}>
                        {book.available_copies} / {book.total_copies} Available
                      </Badge>
                      {book.category && <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded">{book.category}</span>}
                    </div>
                    {book.location_rack && (
                      <p className="text-xs text-muted-foreground mb-3">Shelf: {book.location_rack}</p>
                    )}
                    {isManager && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={book.available_copies <= 0}
                          onClick={() => openIssueDialog(book.id)}
                        >
                          Issue
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteBook(book.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- Circulation (managers only) --- */}
        {isManager && (
          <TabsContent value="circulation" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Active & Recent Loans</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchIssues} disabled={loadingIssues}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingIssues ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {loadingIssues ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : allIssues.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No circulation activity yet.</p>
                ) : (
                  <div className="divide-y">
                    {allIssues.map((issue) => (
                      <div key={issue.id} className="py-3 flex justify-between items-center flex-wrap gap-3">
                        <div>
                          <p className="font-semibold">{issue.book_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {issue.borrower_name || 'Unknown borrower'} ({issue.borrower_type}) &middot; due {issue.due_date}
                            {issue.fine_amount > 0 && ` · fine KES ${issue.fine_amount}${issue.fine_paid ? ' (paid)' : ''}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={issue.status} />
                          {issue.status !== 'returned' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actioningIssueId === issue.id}
                                onClick={() => handleRenew(issue.id)}
                              >
                                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Renew
                              </Button>
                              <Button
                                size="sm"
                                disabled={actioningIssueId === issue.id}
                                onClick={() => handleReturn(issue.id)}
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* --- My loans --- */}
        <TabsContent value="my-loans" className="mt-4">
          <Card>
            <CardHeader><CardTitle>My Loan History</CardTitle></CardHeader>
            <CardContent>
              {myLoans.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">You haven't borrowed any books yet.</p>
              ) : (
                <div className="divide-y">
                  {myLoans.map(loan => (
                    <div key={loan.id} className="py-3 flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <p className="font-semibold">{loan.book_title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {loan.due_date ? new Date(loan.due_date).toLocaleDateString() : '—'}
                          {loan.fine_amount > 0 && ` · fine KES ${loan.fine_amount}${loan.fine_paid ? ' (paid)' : ''}`}
                        </p>
                      </div>
                      <StatusBadge status={loan.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- Upgraded Searchable Issue dialog --- */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Book</DialogTitle>
            <DialogDescription>Loan period defaults to 14 days from today.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            
            {/* Toggle between Student and Staff */}
            <div className="flex gap-4">
              <Button 
                variant={borrowerType === 'student' ? 'default' : 'outline'}
                onClick={() => { setBorrowerType('student'); setBorrowerId(''); setUserSearchQuery(''); }}
                className="flex-1"
              >
                Student
              </Button>
              <Button 
                variant={borrowerType === 'staff' ? 'default' : 'outline'}
                onClick={() => { setBorrowerType('staff'); setBorrowerId(''); setUserSearchQuery(''); }}
                className="flex-1"
              >
                Staff
              </Button>
            </div>

            {/* Search Input */}
            <div>
              <Input 
                placeholder={`Search ${borrowerType} by name, ID, or ${borrowerType === 'student' ? 'grade' : 'department'}...`}
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>

            {/* Search Results List */}
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
              {filteredBorrowers.map((user: any) => (
                <div 
                  key={user.id}
                  onClick={() => setBorrowerId(String(user.id))}
                  className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center ${
                    borrowerId === String(user.id) ? 'bg-blue-100 border border-blue-500' : 'hover:bg-gray-100'
                  }`}
                >
                  {borrowerType === 'student' ? (
                    <>
                      <div>
                        <p className="font-medium">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-gray-500">ADM: {user.admission_number || 'N/A'}</p>
                      </div>
                      {(user.grade || user.class) && (
                        <Badge variant="secondary">{user.grade} {user.class ? `- ${user.class}` : ''}</Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">EMP ID: {user.employee_id || 'N/A'}</p>
                      </div>
                      {user.department && <Badge variant="secondary">{user.department}</Badge>}
                    </>
                  )}
                </div>
              ))}
              {filteredBorrowers.length === 0 && (
                <p className="text-center text-sm text-gray-500 p-2">No {borrowerType}s found matching your search.</p>
              )}
            </div>

            <DialogFooter>
              <Button 
                className="w-full" 
                disabled={!borrowerId || issuing}
                onClick={handleIssueBook}
              >
                {issuing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm Issue
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}