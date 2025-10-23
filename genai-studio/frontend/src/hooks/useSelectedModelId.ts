import { useModel } from "@/context/ModelContext";

export function useSelectedModelId(required = true) {
  const { selected } = useModel();
  const id = selected?.id || "";
  if (required && !id) {
    // You can replace alert with your toast
    alert("Select a model in the top bar.");
  }
  return id;
}
