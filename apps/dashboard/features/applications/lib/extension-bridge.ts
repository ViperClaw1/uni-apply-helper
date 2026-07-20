const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

type OpenFormParams = {
  studentId: string;
  applicationId: string;
  formUrl: string;
};

export async function openUniversityForm({
  studentId,
  applicationId,
  formUrl,
}: OpenFormParams) {
  if (EXTENSION_ID && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    try {
      await chrome.runtime.sendMessage(EXTENSION_ID, {
        type: "SET_ACTIVE_CONTEXT",
        studentId,
        applicationId,
      });
    } catch {
      // Extension not installed or unavailable — still open the form.
    }
  }

  window.open(formUrl, "_blank", "noopener,noreferrer");
}

declare const chrome:
  | {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
        ) => Promise<unknown>;
      };
    }
  | undefined;
