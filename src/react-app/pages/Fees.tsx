// src/react-app/pages/Fees.tsx
import React, { useState } from 'react';
import { 
  CreditCard, 
  Download, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  PhoneCall, 
  FileText 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// --- Types ---
export interface FeeBreakdownItem {
  id: string;
  category: 'Tuition' | 'Boarding' | 'Transport' | 'Activity' | 'Other';
  title: string;
  amountDue: number;
  amountPaid: number;
}

export interface TransactionRecord {
  id: string;
  receiptNumber: string;
  date: string;
  amount: number;
  paymentMethod: 'M-PESA' | 'Bank Transfer' | 'Cash';
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

// --- Main Component ---
export default function Fees() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isStkPromptOpen, setIsStkPromptOpen] = useState(false);
  const [stkStatus, setStkStatus] = useState<'IDLE' | 'SENDING' | 'WAITING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock State (In production, replace with React Query hooks)
  const feeSummary = {
    studentName: "John Doe",
    admissionNumber: "ADM-2024-0042",
    totalInvoiced: 45000,
    totalPaid: 30000,
    outstandingBalance: 15000,
    dueDate: "2026-09-15",
  };

  const breakdownItems: FeeBreakdownItem[] = [
    { id: '1', category: 'Tuition', title: 'Term 3 Tuition Fee', amountDue: 25000, amountPaid: 25000 },
    { id: '2', category: 'Boarding', title: 'Term 3 Boarding & Meals', amountDue: 15000, amountPaid: 5000 },
    { id: '3', category: 'Transport', title: 'Route B Bus Service', amountDue: 5000, amountPaid: 0 },
  ];

  const transactions: TransactionRecord[] = [
    { id: 'tx-101', receiptNumber: 'REC-99482', date: '2026-08-10', amount: 20000, paymentMethod: 'M-PESA', reference: 'QK78XX91A', status: 'COMPLETED' },
    { id: 'tx-102', receiptNumber: 'REC-99105', date: '2026-08-01', amount: 10000, paymentMethod: 'M-PESA', reference: 'QK12YY82B', status: 'COMPLETED' },
    { id: 'tx-103', receiptNumber: 'PENDING', date: '2026-08-20', amount: 5000, paymentMethod: 'M-PESA', reference: 'STK-88319', status: 'PENDING' },
  ];

  const handleInitiatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !customAmount) return;

    setIsStkPromptOpen(true);
    setStkStatus('SENDING');

    // Simulate STK Push lifecycle
    setTimeout(() => {
      setStkStatus('WAITING');
      setTimeout(() => {
        setStkStatus('SUCCESS');
      }, 4000);
    }, 1500);
  };

  const collectionPercentage = Math.round((feeSummary.totalPaid / feeSummary.totalInvoiced) * 100);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* --- Top Metrics Header --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Term Billed</p>
              <h3 className="text-xl font-bold">KES {feeSummary.totalInvoiced.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Paid</p>
              <h3 className="text-xl font-bold text-green-600">KES {feeSummary.totalPaid.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Outstanding Due</p>
              <h3 className="text-xl font-bold text-amber-600">KES {feeSummary.outstandingBalance.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="w-full pr-2">
              <p className="text-xs text-muted-foreground font-medium">Cleared Ratio</p>
              <h3 className="text-xl font-bold">{collectionPercentage}%</h3>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-purple-600 h-full" style={{ width: `${collectionPercentage}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Main Section Tabs --- */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="overview">Fee Overview & Express Pay</TabsTrigger>
          <TabsTrigger value="history">Transaction Ledger</TabsTrigger>
          <TabsTrigger value="structure">Fee Structure & Invoices</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Express Quick Pay */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Breakdown Table */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Term 3 Fee Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="p-3">Category</th>
                        <th className="p-3">Item</th>
                        <th className="p-3">Billed</th>
                        <th className="p-3">Cleared</th>
                        <th className="p-3">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {breakdownItems.map((item) => {
                        const balance = item.amountDue - item.amountPaid;
                        return (
                          <tr key={item.id} className="hover:bg-muted/50">
                            <td className="p-3 font-medium">
                              <Badge variant="outline">{item.category}</Badge>
                            </td>
                            <td className="p-3">{item.title}</td>
                            <td className="p-3 font-semibold">KES {item.amountDue.toLocaleString()}</td>
                            <td className="p-3 text-green-600">KES {item.amountPaid.toLocaleString()}</td>
                            <td className="p-3 text-amber-600 font-semibold">
                              KES {balance.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* M-PESA Express Pay Card */}
            <Card className="border-green-600/20 bg-green-50/10 dark:bg-green-950/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  <span>Express M-PESA Payment</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInitiatePayment} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      M-PESA Phone Number
                    </label>
                    <Input 
                      type="tel" 
                      placeholder="e.g. 0712345678" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required 
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Amount to Pay (KES)
                    </label>
                    <Input 
                      type="number" 
                      placeholder={`Default: ${feeSummary.outstandingBalance}`}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      required 
                    />
                  </div>

                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
                    Send M-PESA STK Push
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center">
                    An STK prompt will pop up on your phone. Input your PIN to authorize payment.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Transaction History */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Payment History & Receipts</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search receipt or reference..." 
                  className="pl-8" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="p-3">Receipt No.</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/50">
                        <td className="p-3 font-semibold">{tx.receiptNumber}</td>
                        <td className="p-3">{tx.date}</td>
                        <td className="p-3">{tx.paymentMethod}</td>
                        <td className="p-3 font-mono text-xs">{tx.reference}</td>
                        <td className="p-3 font-bold">KES {tx.amount.toLocaleString()}</td>
                        <td className="p-3">
                          {tx.status === 'COMPLETED' && <Badge className="bg-green-500">Completed</Badge>}
                          {tx.status === 'PENDING' && <Badge className="bg-amber-500">Pending</Badge>}
                          {tx.status === 'FAILED' && <Badge variant="destructive">Failed</Badge>}
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" disabled={tx.status !== 'COMPLETED'}>
                            <Download className="h-4 w-4 mr-1" /> Receipt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Structure & Downloads */}
        <TabsContent value="structure">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Downloadable Fee Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <h4 className="font-semibold">2026 Academic Year Fee Structure</h4>
                    <p className="text-xs text-muted-foreground">Official school fee matrix for all terms</p>
                  </div>
                </div>
                <Button variant="outline"><Download className="h-4 w-4 mr-2" /> PDF</Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div>
                    <h4 className="font-semibold">Term 3 Student Statement Invoice</h4>
                    <p className="text-xs text-muted-foreground">Itemized bill for {feeSummary.studentName}</p>
                  </div>
                </div>
                <Button variant="outline"><Download className="h-4 w-4 mr-2" /> PDF</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- M-PESA Real-time Payment Status Modal --- */}
      <Dialog open={isStkPromptOpen} onOpenChange={setIsStkPromptOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>M-PESA STK Push Prompt</DialogTitle>
            <DialogDescription>
              Processing payment request for <strong>KES {customAmount}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            {stkStatus === 'SENDING' && (
              <>
                <Clock className="h-12 w-12 text-blue-500 animate-spin" />
                <p className="text-sm font-medium">Sending prompt to mobile device...</p>
              </>
            )}

            {stkStatus === 'WAITING' && (
              <>
                <PhoneCall className="h-12 w-12 text-amber-500 animate-bounce" />
                <p className="text-sm font-medium">STK Push Sent! Check your phone and enter your PIN.</p>
              </>
            )}

            {stkStatus === 'SUCCESS' && (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-sm font-semibold text-green-600">Payment Completed Successfully!</p>
                <p className="text-xs text-muted-foreground">Receipt REC-99483 generated.</p>
              </>
            )}
          </div>

          {stkStatus === 'SUCCESS' && (
            <Button onClick={() => setIsStkPromptOpen(false)} className="w-full">
              Done
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}