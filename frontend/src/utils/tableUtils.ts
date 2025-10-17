import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadNotes, saveNote } from "../services/data";

export function useNotesMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: saveNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useNotesQuery(variantId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["notes", variantId],
    queryFn: () => loadNotes(variantId),
    enabled: enabled && !!variantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function getDefaultColumnOrder(isV2Schema: boolean): string[] {
  if (isV2Schema) {
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
  } else {
    return [
      "no",
      "sensor",
      "machine",
      "tag",
      "variant_id",
      "model_result",
      "plot_data"
    ];
  }
}
