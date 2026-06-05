import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useApi, useAuth } from '../contexts/AuthContext'

const hexToHsl = (hex: string) => {
  let normalized = hex.trim().replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('')
  }
  if (normalized.length !== 6) {
    return null
  }
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }
  const hue = Math.round(h * 360)
  const saturation = Math.round(s * 100)
  const lightness = Math.round(l * 100)
  return `${hue} ${saturation}% ${lightness}%`
}

const applyPrimaryColor = (color: string | null) => {
  if (!color) {
    return
  }
  const root = document.documentElement
  const hsl = color.includes(' ') ? color : hexToHsl(color)
  if (hsl) {
    root.style.setProperty('--primary', hsl)
    root.style.setProperty('--ring', hsl)
  }
}

const DEFAULT_BRANDING = {
  logo: '',
  primaryColor: '#2563eb',
  accentColor: ''
}

const DEFAULT_SCHOOL_DETAILS = {
  name: '',
  principal: '',
  curriculum: '',
  level: ''
}

const DEFAULT_GRADE_LEVELS = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12'
]

interface SchoolItem {
  id: string | number;
  name?: string;
}

export function Settings() {
  const api = useApi()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const [brandingForm, setBrandingForm] = useState(DEFAULT_BRANDING)
  const [gradeLevels, setGradeLevels] = useState<string[]>(DEFAULT_GRADE_LEVELS)
  const [newGradeLevel, setNewGradeLevel] = useState('')
  const [schoolDetails, setSchoolDetails] = useState(DEFAULT_SCHOOL_DETAILS)
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState(() => {
    if (isSuperAdmin) {
      return ''
    }
    return user?.schoolId ?? ''
  })
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(!isSuperAdmin)
  const [savingSchoolDetails, setSavingSchoolDetails] = useState(false)
  const [savingBranding, setSavingBranding] = useState(false)
  const [savingGrades, setSavingGrades] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedSchoolId(user?.schoolId ?? '')
    }
  }, [isSuperAdmin, user?.schoolId])

  const loadSchools = useCallback(async () => {
    if (!isSuperAdmin) {
      return
    }
    setLoadingSchools(true)
    setSuccessMessage(null)
    try {
      const response = await api('/api/schools')
      const data = await response.json().catch(() => [])
      if (!response.ok) {
        const message = data?.error ?? 'Failed to load schools'
        throw new Error(message)
      }
      const options = Array.isArray(data)
        ? data.map((item: SchoolItem) => ({
            id: String(item.id),
            name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : `School ${item.id}`
          }))
        : []
      setSchools(options)
      setSelectedSchoolId((current) => {
        if (current && options.some((option) => option.id === current)) {
          return current
        }
        return options[0]?.id ?? ''
      })
    } catch (loadError) {
      setSettingsError(loadError instanceof Error ? loadError.message : 'Failed to load schools')
      setSchools([])
      setSelectedSchoolId('')
    } finally {
      setLoadingSchools(false)
    }
  }, [api, isSuperAdmin])

  const loadSettings = useCallback(
    async (targetSchoolId?: string) => {
      if (!user) {
        return
      }
      if (isSuperAdmin && (!targetSchoolId || targetSchoolId.trim().length === 0)) {
        setBrandingForm(DEFAULT_BRANDING)
        setGradeLevels(DEFAULT_GRADE_LEVELS)
        setSchoolDetails(DEFAULT_SCHOOL_DETAILS)
        applyPrimaryColor(DEFAULT_BRANDING.primaryColor)
        setLoadingSettings(false)
        return
      }
      setLoadingSettings(true)
      setSettingsError(null)
      setSuccessMessage(null)
      try {
        const query = isSuperAdmin && targetSchoolId ? `?schoolId=${encodeURIComponent(targetSchoolId)}` : ''
        const response = await api(`/api/school/settings${query}`)
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message = data?.error ?? 'Failed to load school settings'
          throw new Error(message)
        }
        const logo = typeof data.logo === 'string' ? data.logo : ''
        const primaryColor = typeof data.primaryColor === 'string' && data.primaryColor.trim().length > 0
          ? data.primaryColor.trim()
          : DEFAULT_BRANDING.primaryColor
        const accentColor = typeof data.accentColor === 'string' ? data.accentColor : ''
        const levels = Array.isArray(data.gradeLevels) && data.gradeLevels.length > 0
          ? data.gradeLevels
          : DEFAULT_GRADE_LEVELS
        const name = typeof data.name === 'string' ? data.name : ''
        const principal = typeof data.principal === 'string' ? data.principal : ''
        const curriculum = typeof data.curriculum === 'string' ? data.curriculum : ''
        const level = typeof data.level === 'string' ? data.level : ''
        setBrandingForm({ logo, primaryColor, accentColor })
        setGradeLevels(levels)
        setSchoolDetails({ name, principal, curriculum, level })
        applyPrimaryColor(primaryColor)
      } catch (loadError) {
        setSettingsError(loadError instanceof Error ? loadError.message : 'Failed to load school settings')
        setBrandingForm(DEFAULT_BRANDING)
        setGradeLevels(DEFAULT_GRADE_LEVELS)
        setSchoolDetails(DEFAULT_SCHOOL_DETAILS)
        applyPrimaryColor(DEFAULT_BRANDING.primaryColor)
      } finally {
        setLoadingSettings(false)
      }
    },
    [api, isSuperAdmin, user]
  )

  useEffect(() => {
    if (isSuperAdmin) {
      loadSchools()
    }
  }, [isSuperAdmin, loadSchools])

  useEffect(() => {
    if (isSuperAdmin) {
      if (selectedSchoolId) {
        loadSettings(selectedSchoolId)
      } else {
        setLoadingSettings(false)
      }
      return
    }
    loadSettings()
  }, [isSuperAdmin, loadSettings, selectedSchoolId])

  const handleSchoolDetailsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target
      setSchoolDetails((current) => ({ ...current, [name]: value }))
    },
    []
  )

  const handleBrandingChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setBrandingForm((current) => ({ ...current, [name]: value }))
    if (name === 'primaryColor') {
      applyPrimaryColor(value)
    }
  }, [])

  const handleLogoUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (isSuperAdmin && !selectedSchoolId) {
      setSettingsError('Select a school before uploading a logo.')
      return
    }

    setUploadingLogo(true)
    setSettingsError(null)
    setSuccessMessage(null)

    try {
      const formData = new FormData()
      formData.append('logo', file)

      const query = isSuperAdmin ? `?schoolId=${encodeURIComponent(selectedSchoolId)}` : ''
      const response = await fetch(`/api/upload/logo${query}`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = data?.error ?? 'Failed to upload logo'
        throw new Error(message)
      }

      // Update the branding form with the new logo URL
      setBrandingForm((current) => ({
        ...current,
        logo: data.data?.url || ''
      }))

      setSuccessMessage('Logo uploaded successfully.')
    } catch (uploadError) {
      setSettingsError(uploadError instanceof Error ? uploadError.message : 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }, [isSuperAdmin, selectedSchoolId])

  const handleAddGradeLevel = useCallback(() => {
    if (isSuperAdmin && !selectedSchoolId) {
      return
    }
    const value = newGradeLevel.trim()
    if (value.length === 0) {
      return
    }
    setGradeLevels((current) => {
      const exists = current.some((level) => level.toLowerCase() === value.toLowerCase())
      if (exists) {
        return current
      }
      return [...current, value]
    })
    setNewGradeLevel('')
  }, [isSuperAdmin, newGradeLevel, selectedSchoolId])

  const handleRemoveGradeLevel = useCallback(
    (level: string) => {
      if (isSuperAdmin && !selectedSchoolId) {
        return
      }
      setGradeLevels((current) => current.filter((item) => item !== level))
    },
    [isSuperAdmin, selectedSchoolId]
  )

  const handleGradeLevelsSave = useCallback(async () => {
    if (!user) {
      return
    }
    if (isSuperAdmin && !selectedSchoolId) {
      setSettingsError('Select a school before saving settings.')
      return
    }
    const normalizedLevels = gradeLevels
      .map((level) => level.trim())
      .filter((level) => level.length > 0)
    if (normalizedLevels.length === 0) {
      setSettingsError('Provide at least one grade level.')
      return
    }
    setSavingGrades(true)
    setSettingsError(null)
    setSuccessMessage(null)
    try {
      const payload: Record<string, unknown> = { gradeLevels: normalizedLevels }
      const query = isSuperAdmin ? `?schoolId=${encodeURIComponent(selectedSchoolId)}` : ''
      const response = await api(`/api/school/settings${query}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = data?.error ?? 'Failed to update grade levels'
        throw new Error(message)
      }
      if (Array.isArray(data.gradeLevels)) {
        setGradeLevels(data.gradeLevels)
      }
      setSuccessMessage('Grade levels updated successfully.')
    } catch (saveError) {
      setSettingsError(saveError instanceof Error ? saveError.message : 'Failed to update grade levels')
    } finally {
      setSavingGrades(false)
    }
  }, [api, gradeLevels, isSuperAdmin, selectedSchoolId, user])

  const handleBrandingSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!user) {
        return
      }
      if (isSuperAdmin && !selectedSchoolId) {
        setSettingsError('Select a school before saving settings.')
        return
      }
      setSavingBranding(true)
      setSettingsError(null)
      setSuccessMessage(null)
      try {
        const payload: Record<string, unknown> = {
          primaryColor: brandingForm.primaryColor,
          accentColor: brandingForm.accentColor
        }
        const query = isSuperAdmin ? `?schoolId=${encodeURIComponent(selectedSchoolId)}` : ''
        const response = await api(`/api/school/settings${query}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message = data?.error ?? 'Failed to update branding'
          throw new Error(message)
        }
        setBrandingForm((current) => ({
          logo: typeof data.logo === 'string' ? data.logo : current.logo,
          primaryColor: typeof data.primaryColor === 'string' ? data.primaryColor : current.primaryColor,
          accentColor: typeof data.accentColor === 'string' ? data.accentColor : current.accentColor
        }))
        applyPrimaryColor(typeof data.primaryColor === 'string' ? data.primaryColor : brandingForm.primaryColor)
        setSuccessMessage('Branding updated successfully.')
      } catch (saveError) {
        setSettingsError(saveError instanceof Error ? saveError.message : 'Failed to update branding')
      } finally {
        setSavingBranding(false)
      }
    },
    [api, brandingForm.accentColor, brandingForm.primaryColor, isSuperAdmin, selectedSchoolId, user]
  )

  const handleSchoolDetailsSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!user) {
        return
      }
      if (isSuperAdmin && !selectedSchoolId) {
        setSettingsError('Select a school before saving settings.')
        return
      }
      setSavingSchoolDetails(true)
      setSettingsError(null)
      setSuccessMessage(null)
      try {
        const payload: Record<string, unknown> = {
          name: schoolDetails.name.trim(),
          principal: schoolDetails.principal.trim(),
          curriculum: schoolDetails.curriculum.trim(),
          level: schoolDetails.level.trim()
        }
        const query = isSuperAdmin ? `?schoolId=${encodeURIComponent(selectedSchoolId)}` : ''
        const response = await api(`/api/school/settings${query}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message = data?.error ?? 'Failed to update school details'
          throw new Error(message)
        }
        setSchoolDetails({
          name: typeof data.name === 'string' ? data.name : schoolDetails.name.trim(),
          principal: typeof data.principal === 'string' ? data.principal : schoolDetails.principal.trim(),
          curriculum: typeof data.curriculum === 'string' ? data.curriculum : schoolDetails.curriculum.trim(),
          level: typeof data.level === 'string' ? data.level : schoolDetails.level.trim()
        })
        setSuccessMessage('School details updated successfully.')
      } catch (saveError) {
        setSettingsError(saveError instanceof Error ? saveError.message : 'Failed to update school details')
      } finally {
        setSavingSchoolDetails(false)
      }
    },
    [api, isSuperAdmin, schoolDetails.curriculum, schoolDetails.level, schoolDetails.name, schoolDetails.principal, selectedSchoolId, user]
  )

  const handleSchoolSelection = useCallback((value: string) => {
    setSelectedSchoolId(value)
  }, [])

  const brandingDisabled = savingBranding || uploadingLogo || (isSuperAdmin && !selectedSchoolId)
  const gradeDisabled = savingGrades || (isSuperAdmin && !selectedSchoolId)
  const schoolDetailsDisabled = savingSchoolDetails || (isSuperAdmin && !selectedSchoolId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your school identity, branding, and enrollment options</p>
      </div>

      {isSuperAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>School Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-school">School</Label>
              <Select value={selectedSchoolId || undefined} onValueChange={handleSchoolSelection} disabled={loadingSchools}>
                <SelectTrigger id="settings-school">
                  <SelectValue placeholder={loadingSchools ? 'Loading schools…' : 'Select a school'} />
                </SelectTrigger>
                <SelectContent>
                  {schools.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No schools available
                    </SelectItem>
                  ) : null}
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={loadSchools} disabled={loadingSchools}>
                {loadingSchools ? 'Refreshing…' : 'Refresh Schools'}
              </Button>
              {!selectedSchoolId && !loadingSchools ? (
                <p className="text-sm text-muted-foreground">Select a school to manage its settings.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loadingSettings ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Loading school settings...
        </div>
      ) : null}

      {settingsError ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{settingsError}</div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSchoolDetailsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">School Name</Label>
                <Input
                  id="school-name"
                  name="name"
                  value={schoolDetails.name}
                  onChange={handleSchoolDetailsChange}
                  placeholder="Enter school name"
                  disabled={schoolDetailsDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-principal">Principal</Label>
                <Input
                  id="school-principal"
                  name="principal"
                  value={schoolDetails.principal}
                  onChange={handleSchoolDetailsChange}
                  placeholder="e.g., Dr. Maya Patel"
                  disabled={schoolDetailsDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-level">School Level</Label>
                <Input
                  id="school-level"
                  name="level"
                  value={schoolDetails.level}
                  onChange={handleSchoolDetailsChange}
                  placeholder="e.g., K-12"
                  disabled={schoolDetailsDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-curriculum">Curriculum</Label>
                <Textarea
                  id="school-curriculum"
                  name="curriculum"
                  value={schoolDetails.curriculum}
                  onChange={handleSchoolDetailsChange}
                  placeholder="e.g., Cambridge International, STEM-focused"
                  disabled={schoolDetailsDisabled}
                />
              </div>

              <Button type="submit" disabled={schoolDetailsDisabled}>
                {savingSchoolDetails ? 'Saving...' : 'Save School Details'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>School Branding</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBrandingSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-logo">School Logo</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="brand-logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={brandingDisabled || uploadingLogo}
                    className="flex-1"
                  />
                  {uploadingLogo && <span className="text-sm text-muted-foreground">Uploading...</span>}
                </div>
                {brandingForm.logo ? (
                  <div className="rounded-md border border-border p-3">
                    <img src={brandingForm.logo} alt="School logo preview" className="h-12 w-auto object-contain" />
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-primary-color">Primary Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="brand-primary-color"
                    name="primaryColor"
                    type="color"
                    value={brandingForm.primaryColor.startsWith('#') ? brandingForm.primaryColor : DEFAULT_BRANDING.primaryColor}
                    onChange={handleBrandingChange}
                    disabled={brandingDisabled}
                    className="h-10 w-16 p-1"
                  />
                  <Input
                    name="primaryColor"
                    value={brandingForm.primaryColor}
                    onChange={handleBrandingChange}
                    placeholder="#2563eb"
                    disabled={brandingDisabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-accent-color">Accent Color (optional)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="brand-accent-color"
                    name="accentColor"
                    type="color"
                    value={brandingForm.accentColor && brandingForm.accentColor.startsWith('#') ? brandingForm.accentColor : '#1e293b'}
                    onChange={handleBrandingChange}
                    disabled={brandingDisabled}
                    className="h-10 w-16 p-1"
                  />
                  <Input
                    name="accentColor"
                    value={brandingForm.accentColor}
                    onChange={handleBrandingChange}
                    placeholder="#1e293b"
                    disabled={brandingDisabled}
                  />
                </div>
              </div>

              <Button type="submit" disabled={brandingDisabled}>
                {savingBranding ? 'Saving...' : 'Save Branding'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grade Levels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-grade">Add Grade Level</Label>
              <Input
                id="new-grade"
                value={newGradeLevel}
                onChange={(event) => setNewGradeLevel(event.target.value)}
                placeholder="e.g., Grade 13"
                disabled={gradeDisabled}
              />
            </div>
            <Button
              type="button"
              onClick={handleAddGradeLevel}
              disabled={gradeDisabled || newGradeLevel.trim().length === 0}
            >
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {gradeLevels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No grade levels configured.</p>
            ) : (
              <ul className="space-y-2">
                {gradeLevels.map((level) => (
                  <li
                    key={level}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{level}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveGradeLevel(level)}
                      disabled={gradeDisabled}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            These levels appear when enrolling students and when configuring courses.
          </p>

          <Button type="button" onClick={handleGradeLevelsSave} disabled={gradeDisabled}>
            {savingGrades ? 'Saving...' : 'Save Grade Levels'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
