import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { BookOpen, Search, Plus, CheckCircle, Clock, Loader2 } from 'lucide-react';

interface Book {
  id: number;
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  total_copies: number;
  available_copies: number;
  shelf_location?: string;
}

interface Loan {
  id: number;
  book_title: string;
  author: string;
  issue_date: string;
  due_date: string;
  returned_date?: string;
  status: string;
  fine_amount: number;
}

export default function Library() {
  const { user } = useAuth();
  const isManager = ['admin', 'super_admin', 'librarian'].includes(user?.role || '');

  const [books, setBooks] = useState<Book[]>([]);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New book state
  const [newBook, setNewBook] = useState({ title: '', author: '', isbn: '', category: '', total_copies: 1, shelf_location: '' });

  useEffect(() => {
    fetchBooks();
    fetchMyLoans();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/library/books?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBooks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchMyLoans = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/library/my-loans', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setMyLoans(await res.json());
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('/api/library/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newBook),
    });
    if (res.ok) {
      setIsAddOpen(false);
      setNewBook({ title: '', author: '', isbn: '', category: '', total_copies: 1, shelf_location: '' });
      fetchBooks();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
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
              <DialogHeader><DialogTitle>Add Book to Catalog</DialogTitle></DialogHeader>
              <form onSubmit={handleAddBook} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input required value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} />
                </div>
                <div>
                  <Label>Author</Label>
                  <Input required value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category / Subject</Label>
                    <Input value={newBook.category} onChange={e => setNewBook({...newBook, category: e.target.value})} />
                  </div>
                  <div>
                    <Label>Total Copies</Label>
                    <Input type="number" min="1" value={newBook.total_copies} onChange={e => setNewBook({...newBook, total_copies: parseInt(e.target.value) || 1})} />
                  </div>
                </div>
                <Button type="submit" className="w-full">Save Book</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Book Catalog</TabsTrigger>
          <TabsTrigger value="my-loans">My Borrowed Books</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Search by Title, Author, or ISBN..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchBooks()}
            />
            <Button onClick={fetchBooks} variant="secondary" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map(book => (
                <Card key={book.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-medium">{book.title}</CardTitle>
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">By {book.author}</p>
                    <div className="flex justify-between items-center text-xs">
                      <Badge variant={book.available_copies > 0 ? "default" : "destructive"}>
                        {book.available_copies} / {book.total_copies} Available
                      </Badge>
                      {book.category && <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded">{book.category}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-loans" className="mt-4">
          <Card>
            <CardHeader><CardTitle>My Loan History</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y">
                {myLoans.map(loan => (
                  <div key={loan.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{loan.book_title}</p>
                      <p className="text-xs text-muted-foreground">Due Date: {new Date(loan.due_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      {loan.status === 'borrowed' ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="w-3 h-3 mr-1" /> Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Returned</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}