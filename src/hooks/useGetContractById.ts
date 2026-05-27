import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getContractById } from '../lib/tromail';

export const useGetContractById = (contractId) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => getContractById(contractId),
    enabled: !!contractId,
  });
};