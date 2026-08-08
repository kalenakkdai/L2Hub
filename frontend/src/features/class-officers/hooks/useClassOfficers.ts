import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClassOfficersContext } from '../context/ClassOfficersProvider'
import type { UpdateFundraiserInput, UpdateHomecomingInput } from '../types'

const SNAPSHOT_KEY = ['class-officers', 'snapshot'] as const

export function useClassOfficersSnapshot() {
  const { dataProvider } = useClassOfficersContext()
  return useQuery({
    queryKey: SNAPSHOT_KEY,
    queryFn: () => dataProvider.getSnapshot(),
  })
}

export function useClassOfficersCommands() {
  const { dataProvider } = useClassOfficersContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: SNAPSHOT_KEY })
  }

  const updateFundraiser = useMutation({
    mutationFn: (input: UpdateFundraiserInput) => dataProvider.updateFundraiser(input),
    onSuccess: invalidate,
  })

  const updateHomecoming = useMutation({
    mutationFn: (input: UpdateHomecomingInput) => dataProvider.updateHomecoming(input),
    onSuccess: invalidate,
  })

  return { updateFundraiser, updateHomecoming }
}
