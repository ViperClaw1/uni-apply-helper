const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

type OpenFormParams = {
  studentId: string;
  applicationId: string;
  formUrl: string;
};

export function openUniversityForm({
  studentId,
  applicationId,
  formUrl,
}: OpenFormParams) {
  window.open(formUrl, "_blank", "noopener,noreferrer");

  if (EXTENSION_ID && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    chrome.runtime
      .sendMessage(EXTENSION_ID, {
        type: "SET_ACTIVE_CONTEXT",
        studentId,
        applicationId,
      })
      .catch(() => undefined);
  }
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
