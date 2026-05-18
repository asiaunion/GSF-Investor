export function isDevPreviewEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_PREVIEW_AUTH === "true"
  );
}

export const DEV_PREVIEW_PROVIDER_ID = "dev-preview";
