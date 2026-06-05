import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useApi } from '../contexts/AuthContext'
import { Mail, Phone, MapPin, CalendarDays, Users, UserCheck } from 'lucide-react'

type SchoolData = {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  principal: string | null
  curriculum: string | null
  level: string | null
  created_at: string
  students: number
  staff: number
}

export function SchoolProfile() {
  const { id } = useParams()
  const apiFetch = useApi()
  const [school, setSchool] = useState<SchoolData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSchool = async () => {
      if (!id) {
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const response = await apiFetch(`/api/schools/${id}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch school data')
        }
        const data: SchoolData = await response.json()
        setSchool(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSchool()
  }, [apiFetch, id])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600' />
      </div>
    )
  }

  if (error) {
    return <p className='text-sm font-medium text-red-500'>{error}</p>
  }

  if (!school) {
    return <p className='text-sm text-muted-foreground'>School not found.</p>
  }

  const createdDate = school.created_at ? new Date(school.created_at).toLocaleDateString() : 'N/A'

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold text-gray-900'>{school.name}</h1>
        <p className='text-gray-600'>School ID: {school.id}</p>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Key metrics</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex items-center space-x-2 text-gray-900'>
              <Users className='h-4 w-4' />
              <span>{school.students} Students</span>
            </div>
            <div className='flex items-center space-x-2 text-gray-900'>
              <UserCheck className='h-4 w-4' />
              <span>{school.staff} Staff Members</span>
            </div>
            <div className='flex items-center space-x-2 text-gray-600'>
              <CalendarDays className='h-4 w-4' />
              <span>Joined {createdDate}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Principal</CardTitle>
            <CardDescription>Main administrator</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='text-2xl font-semibold text-gray-900'>{school.principal || 'N/A'}</div>
            <p className='text-sm text-gray-600'>Curriculum: {school.curriculum || 'N/A'}</p>
            <p className='text-sm text-gray-600'>Level: {school.level || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>School contact details</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex items-center space-x-2 text-gray-600'>
              <Mail className='h-4 w-4' />
              <span className='text-sm'>{school.email || 'No email provided'}</span>
            </div>
            <div className='flex items-center space-x-2 text-gray-600'>
              <Phone className='h-4 w-4' />
              <span className='text-sm'>{school.phone || 'No phone provided'}</span>
            </div>
            <div className='flex items-center space-x-2 text-gray-600'>
              <MapPin className='h-4 w-4' />
              <span className='text-sm'>{school.address || 'No address provided'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
