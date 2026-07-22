import { useState, useRef, ChangeEvent } from 'react'
import { Upload, Loader2, AlertCircle, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useApi } from '../contexts/AuthContext'

export type BulkOnboardEntityType = 'students' | 'teachers' | 'staff'

type RowError = { row_number: number; name: string; reason: string }

type ImportResult = {
  status: string
  processed: number
  created: number
  failed: number
  errors: RowError[]
}

const ENTITY_LABELS: Record<BulkOnboardEntityType, string> = {
  students: 'Students',
  teachers: 'Teachers',
  staff: 'Staff',
}

interface BulkOnboardDialogProps {
  /** Which entity types this user is allowed to import. Pass a single-item
   * array to lock the type entirely (e.g. class teachers only get ['students'],
   * enforced again server-side regardless). */
  entityTypes: BulkOnboardEntityType[]
  /** Called after a successful import so the parent list can refresh. */
  onComplete?: () => void
  /** Optional: override the trigger button's label. */
  triggerLabel?: string
}

export function BulkOnboardDialog({ entityTypes, onComplete, triggerLabel }: BulkOnboardDialogProps) {
  const api = useApi()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [entityType, setEntityType] = useState<BulkOnboardEntityType>(entityTypes[0])
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setFile(null)
    setError(null)
    setResult(null)
    setEntityType(entityTypes[0])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) reset()
    setIsOpen(open)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setError(null)
    setResult(null)
    if (selected && !/\.(csv|xlsx|xls)$/i.test(selected.name)) {
      setError('Please choose a .csv or .xlsx file.')
      setFile(null)
      return
    }
    setFile(selected)
  }

  const handleSubmit = async () => {
    if (!file) {
      setError('Choose a file first.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api(`/api/bulk-onboard/${entityType}`, {
        method: 'POST',
        body: formData,
      })
      const data: ImportResult = await response.json()
      setResult(data)
      if (data.created > 0) onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please check the file and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          {triggerLabel || 'Bulk Import'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import {entityTypes.length > 1 ? '' : ENTITY_LABELS[entityType]}</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Column headers don't need to match exactly —
            "Name", "Student Name", "Full Name", "Learner Name" etc. are all detected
            automatically, same for class/grade, stream, admission number, and email.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {entityTypes.length > 1 && (
            <div className="space-y-2">
              <Label>Import as</Label>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as BulkOnboardEntityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {entityTypes.map((t) => (
                    <SelectItem key={t} value={t}>{ENTITY_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bulk-import-file">File</Label>
            <div className="flex items-center gap-3">
              <input
                id="bulk-import-file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1 text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-slate-100 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
            {file && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <FileSpreadsheet className="w-3.5 h-3.5" /> {file.name}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> {result.created} created
                </span>
                {result.failed > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 font-medium">
                    <XCircle className="w-4 h-4" /> {result.failed} failed
                  </span>
                )}
                <span className="text-slate-500">{result.processed} rows processed</span>
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md divide-y">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-3 py-2 text-xs">
                      <span className="font-medium text-slate-700">Row {e.row_number} ({e.name}):</span>{' '}
                      <span className="text-red-600">{e.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={reset}>Import another file</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !file}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
