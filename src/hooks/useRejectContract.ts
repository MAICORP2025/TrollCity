import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rejectContract } from '../lib/tromail';

export const useRejectContract = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: rejectContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['tromailMessages'] }); // Invalidate Tromail messages
    },
  });
};