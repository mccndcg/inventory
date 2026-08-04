export const localOnlyMode =
  import.meta.env.MODE !== "test" && import.meta.env.VITE_LOCAL_ONLY === "true";
