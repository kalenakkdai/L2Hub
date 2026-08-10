import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClassOfficersContext } from '../context/ClassOfficersProvider'
import type { ClassCohort, UpdateFundraiserInput, UpdateHomecomingInput } from '../types'

export function useClassOfficersSnapshot() {
  const { dataProvider, cohort } = useClassOfficersContext()
  return useQuery({
    queryKey: ['class-officers', 'snapshot', cohort],
    queryFn: () => dataProvider.getSnapshot(cohort),
    enabled: Boolean(cohort),
  })
}

export function useClassOfficersCommands() {
  const { dataProvider, cohort } = useClassOfficersContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['class-officers', 'snapshot', cohort],
    })
  }

  const updateFundraiser = useMutation({
    mutationFn: (input: UpdateFundraiserInput) =>
      dataProvider.updateFundraiser(cohort as ClassCohort, input),
    onSuccess: invalidate,
  })

  const updateHomecoming = useMutation({
    mutationFn: (input: UpdateHomecomingInput) =>
      dataProvider.updateHomecoming(cohort as ClassCohort, input),
    onSuccess: invalidate,
  })

  return { updateFundraiser, updateHomecoming }
}
