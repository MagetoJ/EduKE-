import { useCallback, useContext } from "react"

import { AuthContext } from "./auth-context"

export function useApi() {
  const { token, logout, refreshSession } = useAuth()

  const authenticatedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const executeRequest = async (overrideToken?: string) => {
        const headers = new Headers(options.headers || {})
        const authToken = overrideToken ?? token

        if (authToken) {
          headers.set("Authorization", `Bearer ${authToken}`)
        }

        if (
          !headers.has("Content-Type") &&
          options.body &&
          !(options.body instanceof FormData)
        ) {
          headers.set("Content-Type", "application/json")
        }

        return fetch(url, {
          ...options,
          headers,
          credentials: "include",
        })
      }

      let response = await executeRequest()

      if (response.status === 401) {
        const newToken = await refreshSession()

        if (!newToken) {
          logout()
          throw new Error("Your session has expired. Please log in again.")
        }

        response = await executeRequest(newToken)

        if (response.status === 401) {
          logout()
          throw new Error("Your session has expired. Please log in again.")
        }
      }

      if (!response.ok) {
        try {
          const errorData = await response.json()

          throw new Error(
            errorData.error ||
              errorData.detail ||
              `Request failed with status ${response.status}`
          )
        } catch (err) {
          if (err instanceof Error) {
            throw err
          }

          throw new Error(
            `Server execution encountered an update status: ${response.status}`
          )
        }
      }

      return response
    },
    [logout, refreshSession, token]
  )

  return authenticatedFetch
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
