import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export type PaginatedResponse<T> = {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

type FetcherOptions = {
  table: string
  select?: string
  page: number
  pageSize: number
  orderColumn?: string
  orderAscending?: boolean
  filter?: { column: string; value: string }[]
}

async function paginatedFetcher<T>(options: FetcherOptions): Promise<PaginatedResponse<T>> {
  const { table, select = '*', page, pageSize, orderColumn = 'created_at', orderAscending = false, filter } = options

  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase.from(table).select(select, { count: 'exact' }).range(from, to).order(orderColumn, { ascending: orderAscending })

  if (filter) {
    filter.forEach(({ column, value }) => {
      if (value) {
        query = query.ilike(column, `%${value}%`)
      }
    })
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(error.message)
  }

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return {
    data: (data || []) as T[],
    count: totalCount,
    page,
    pageSize,
    totalPages,
  }
}

export function usePaginatedTable<T>(options: Omit<FetcherOptions, 'page' | 'pageSize'> & { pageSize?: number }) {
  const { pageSize = 20, ...fetcherOptions } = options
  // `page` used to be a hardcoded `0` with no setter, so the hook could only
  // ever return the first page and callers had no way to advance it.
  const [page, setPage] = useState(0)

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<T>>(
    [`paginated-table`, fetcherOptions.table, fetcherOptions.select, page, pageSize, fetcherOptions.orderColumn, fetcherOptions.orderAscending, JSON.stringify(fetcherOptions.filter)],
    () => paginatedFetcher<T>({ ...fetcherOptions, page, pageSize }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    },
  )

  const totalPages = data?.totalPages ?? 1

  return {
    data: data?.data ?? [],
    count: data?.count ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    totalPages,
    isLoading,
    error: error as Error | null,
    mutate,
    goToPage: (nextPage: number) => setPage(Math.min(Math.max(nextPage, 0), Math.max(totalPages - 1, 0))),
    nextPage: () => setPage((current) => Math.min(current + 1, Math.max(totalPages - 1, 0))),
    previousPage: () => setPage((current) => Math.max(current - 1, 0)),
  }
}
