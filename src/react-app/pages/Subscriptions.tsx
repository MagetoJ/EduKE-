import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Label } from '../components/ui/label'
import { SubscriptionStatusChart } from '../components/charts/SubscriptionStatusChart'
import { useApi, useAuth } from '../contexts/AuthContext'

type SubscriptionPlan = {
  id: string
  name: string
  slug: string
  description?: string | null
  studentLimit: number | null
  staffLimit: number | null
  isTrial: boolean
}

type SchoolSubscription = {
  planName: string | null
  planSlug: string | null
  status: string
  trialEndsAt: string | null
  studentLimit: number | null
  staffLimit: number | null
}

type SchoolRecord = {
  id: string
  name: string
  address?: string | null
  principal?: string | null
  students: number
  staff: number
  revenue: string
  subscription: SchoolSubscription | null
}

type DraftSubscription = {
  planSlug: string
  status: string
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' }
]

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-transparent',
  trialing: 'bg-amber-100 text-amber-700 border-transparent',
  paused: 'bg-blue-100 text-blue-700 border-transparent',
  cancelled: 'bg-red-100 text-red-700 border-transparent'
}

interface ApiPlan {
  id: string | number
  name?: string
  slug?: string
  description?: string | null
  studentLimit?: number | null
  student_limit?: number | null
  staffLimit?: number | null
  staff_limit?: number | null
  isTrial?: boolean
  is_trial?: boolean
}

interface ApiSchool {
  id: string | number
  name?: string
  address?: string | null
  principal?: string | null
  students?: number | string
  staff?: number | string
  revenue?: string | number
  subscription?: {
    planName?: string | null
    planSlug?: string | null
    status?: string | null
    trialEndsAt?: string | null
    studentLimit?: number | null
    staffLimit?: number | null
  } | null
}

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString()
}

const parsePlan = (plan: ApiPlan): SubscriptionPlan => ({
  id: String(plan.id),
  name: plan.name ?? 'Unnamed Plan',
  slug: plan.slug ?? '',
  description: plan.description ?? null,
  studentLimit:
    typeof plan.studentLimit === 'number'
      ? plan.studentLimit
      : typeof plan.student_limit === 'number'
        ? plan.student_limit
        : null,
  staffLimit:
    typeof plan.staffLimit === 'number'
      ? plan.staffLimit
      : typeof plan.staff_limit === 'number'
        ? plan.staff_limit
        : null,
  isTrial: Boolean(plan.isTrial ?? plan.is_trial)
})

const parseSchool = (school: ApiSchool): SchoolRecord => ({
  id: String(school.id),
  name: school.name ?? 'Unnamed School',
  address: school.address ?? null,
  principal: school.principal ?? null,
  students: Number(school.students ?? 0),
  staff: Number(school.staff ?? 0),
  revenue:
    typeof school.revenue === 'string'
      ? school.revenue
      : `$${Number(school.revenue || 0).toLocaleString()}`,
  subscription: school.subscription
    ? {
        planName: school.subscription.planName ?? school.subscription.planSlug ?? null,
        planSlug: school.subscription.planSlug ?? null,
        status: school.subscription.status ?? 'active',
        trialEndsAt: school.subscription.trialEndsAt ?? null,
        studentLimit: school.subscription.studentLimit ?? null,
        staffLimit: school.subscription.staffLimit ?? null
      }
    : null
})

export default function Subscriptions() {
  const { user } = useAuth()
  const api = useApi()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftSubscription>>({})
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const planMap = useMemo(() => {
    const map = new Map<string, SubscriptionPlan>()
    plans.forEach((plan) => {
      map.set(plan.slug, plan)
    })
    return map
  }, [plans])

  const loadData = useCallback(async () => {
    if (!user || user.role !== 'super_admin') {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [planResponse, schoolResponse] = await Promise.all([
        api('/api/subscription/plans'),
        api('/api/schools')
      ])
      const planJson = await planResponse.json().catch(() => ({}))
      if (!planResponse.ok) {
        throw new Error(planJson.error || 'Failed to load subscription plans')
      }
      const schoolJson = await schoolResponse.json().catch(() => ({}))
      if (!schoolResponse.ok) {
        throw new Error(schoolJson.error || 'Failed to load schools')
      }
      const parsedPlans: SubscriptionPlan[] = Array.isArray(planJson.plans)
        ? planJson.plans.map(parsePlan)
        : []
      const parsedSchools: SchoolRecord[] = Array.isArray(schoolJson)
        ? schoolJson.map(parseSchool)
        : []
      const defaultPlanSlug = parsedPlans[0]?.slug ?? ''
      const initialDrafts = parsedSchools.reduce<Record<string, DraftSubscription>>((acc, school) => {
        const currentSlug = school.subscription?.planSlug ?? defaultPlanSlug
        acc[school.id] = {
          planSlug: currentSlug,
          status: school.subscription?.status ?? 'active'
        }
        return acc
      }, {})
      setPlans(parsedPlans)
      setSchools(parsedSchools)
      setDrafts(initialDrafts)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load subscription data')
      setPlans([])
      setSchools([])
      setDrafts({})
    } finally {
      setLoading(false)
    }
  }, [api, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePlanChange = useCallback((schoolId: string, planSlug: string) => {
    setDrafts((current) => ({
      ...current,
      [schoolId]: {
        planSlug,
        status: current[schoolId]?.status ?? 'active'
      }
    }))
  }, [])

  const handleStatusChange = useCallback((schoolId: string, status: string) => {
    setDrafts((current) => ({
      ...current,
      [schoolId]: {
        planSlug: current[schoolId]?.planSlug ?? '',
        status
      }
    }))
  }, [])

  const handleReset = useCallback((schoolId: string) => {
    setDrafts((current) => {
      const school = schools.find((item) => item.id === schoolId)
      if (!school) {
        return current
      }
      const planFallback = plans[0]?.slug ?? ''
      const originalPlanSlug = school.subscription?.planSlug ?? planFallback
      return {
        ...current,
        [schoolId]: {
          planSlug: originalPlanSlug,
          status: school.subscription?.status ?? 'active'
        }
      }
    })
  }, [plans, schools])

  const handleUpdate = useCallback(async (school: SchoolRecord) => {
    const draft = drafts[school.id]
    if (!draft || !draft.planSlug) {
      return
    }
    setSavingId(school.id)
    setError(null)
    try {
      const response = await api(`/api/schools/${school.id}/subscription`, {
        method: 'PUT',
        body: JSON.stringify({
          planSlug: draft.planSlug,
          status: draft.status
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subscription')
      }
      const resolvedPlanSlug = data.planSlug ?? data.plan_slug ?? draft.planSlug
      const resolvedStatus = data.status ?? draft.status
      const updated = {
        planName: data.planName ?? data.plan_name ?? school.subscription?.planName ?? null,
        planSlug: typeof resolvedPlanSlug === 'string' ? resolvedPlanSlug : String(resolvedPlanSlug ?? ''),
        status: typeof resolvedStatus === 'string' ? resolvedStatus : draft.status,
        trialEndsAt: data.trialEndsAt ?? data.trial_ends_at ?? school.subscription?.trialEndsAt ?? null,
        studentLimit: data.studentLimit ?? data.student_limit ?? school.subscription?.studentLimit ?? null,
        staffLimit: data.staffLimit ?? data.staff_limit ?? school.subscription?.staffLimit ?? null
      }
      setSchools((current) =>
        current.map((item) =>
          item.id === school.id
            ? {
                ...item,
                subscription: updated
              }
            : item
        )
      )
      setDrafts((current) => ({
        ...current,
        [school.id]: {
          planSlug: updated.planSlug ?? draft.planSlug,
          status: updated.status
        }
      }))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update subscription')
    } finally {
      setSavingId(null)
    }
  }, [api, drafts])

  if (!user || user.role !== 'super_admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access restricted</CardTitle>
          <CardDescription>Only super administrators can manage subscriptions.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
          <p className="text-sm text-muted-foreground">Monitor and configure plans across all schools</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <SubscriptionStatusChart />

      <div className="grid gap-6">
        {schools.map((school) => {
          const planFallback = plans[0]?.slug ?? ''
          const originalPlanSlug = school.subscription?.planSlug ?? planFallback
          const originalStatus = school.subscription?.status ?? 'active'
          const draft = drafts[school.id] ?? {
            planSlug: originalPlanSlug,
            status: originalStatus
          }
          const plan = planMap.get(draft.planSlug)
          const studentLimit = school.subscription?.studentLimit ?? plan?.studentLimit ?? null
          const staffLimit = school.subscription?.staffLimit ?? plan?.staffLimit ?? null
          const formattedTrial = formatDateLabel(school.subscription?.trialEndsAt)
          const statusClass = STATUS_CLASSES[draft.status] ?? STATUS_CLASSES.active
          const isDirty = draft.planSlug !== originalPlanSlug || draft.status !== originalStatus
          const isSaving = savingId === school.id

          return (
            <Card key={school.id} className="border border-border/60">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{school.name}</CardTitle>
                  <CardDescription>
                    {school.address ? school.address : 'No address on file'}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={statusClass}>
                  {STATUS_OPTIONS.find((option) => option.value === draft.status)?.label ?? draft.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Students</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {school.students.toLocaleString()}
                      {studentLimit !== null ? ` / ${studentLimit.toLocaleString()}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Staff</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {school.staff.toLocaleString()}
                      {staffLimit !== null ? ` / ${staffLimit.toLocaleString()}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Revenue</p>
                    <p className="text-lg font-semibold text-gray-900">{school.revenue}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Trial ends</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formattedTrial ?? (plan?.isTrial ? 'Trial active' : 'N/A')}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select
                      value={draft.planSlug}
                      onValueChange={(value) => handlePlanChange(school.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((planOption) => (
                          <SelectItem key={planOption.slug} value={planOption.slug}>
                            {planOption.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {plan?.description ? (
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={draft.status}
                      onValueChange={(value) => handleStatusChange(school.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => handleReset(school.id)}
                      disabled={!isDirty || isSaving}
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={() => handleUpdate(school)}
                      disabled={!isDirty || isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Apply'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {!loading && schools.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No schools found</CardTitle>
              <CardDescription>Registered schools will appear here once available.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
