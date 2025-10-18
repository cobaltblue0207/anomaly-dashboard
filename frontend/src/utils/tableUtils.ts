import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadNotes, saveNote } from "../services/data";

export function useNotesMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ user_id, pattern, variant_id, note, current_session_user }: {
      user_id: string;
      pattern: string;
      variant_id: string;
      note: string;
      current_session_user: string;
    }) => saveNote(user_id, pattern, variant_id, note, current_session_user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useNotesQuery(user_id: string, pattern: string, variant_ids: string[], enabled: boolean = true) {
  return useQuery({
    queryKey: ["notes", user_id, pattern, variant_ids],
    queryFn: () => loadNotes(user_id, pattern, variant_ids),
    enabled: enabled && !!user_id && !!pattern && variant_ids.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function getDefaultColumnOrder(): string[] {
  return [
    "no",
    "MASTER_TASK_ID",
    "LINE",
    "AREA",
    "PROD_EQP_ID",
    "PARAM_SUBITEM",
    "PPID",
    "RECIPEID",
    "CH_STEP",
    "MODEL_RESULT_INFO",
    "30D",
    "60D",
    "COMMENTS",
    "NOTES"
  ];
}
