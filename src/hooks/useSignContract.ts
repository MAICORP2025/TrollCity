import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signContract } from '../lib/tromail';

export const useSignContract = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: signContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['tromailMessages'] }); // Invalidate Tromail messages
    },
  });
};