import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadOrganizationDocument } from '../lib/tromail';

export const useUploadOrganizationDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      user_id: string;
      uploaded_by: string | null;
      document_type: string;
      document_title: string;
      file_url: string;
      storage_path: string;
      source: string;
      related_contract_id: string | null;
      visibility: string;
      metadata?: Record<string, any>;
    }) => uploadOrganizationDocument(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDocuments'] });
    },
  });
};