export const LOGIN_URL = 'http://lnpu.chiwest.cn/en/student/login';
export const MEMBER_URL = 'http://lnpu.chiwest.cn/en/student/index';
export const MY_APPLICATION_URL = 'http://lnpu.chiwest.cn/en/student/index/all';
export const PROGRAM_LIST_URL = 'http://lnpu.chiwest.cn/en/student/apply/index';
export const FORM_URL = 'http://lnpu.chiwest.cn/en/student/apply_forms/index';

export function isCucasFormUrl(formUrl: string): boolean {
  return /chiwest\.cn|cucas\.cn|apply\.sdu\.edu\.cn/i.test(formUrl);
}

export function isLnpuFormUrl(formUrl: string): boolean {
  return /lnpu\.chiwest\.cn/i.test(formUrl);
}

export function originFromFormUrl(formUrl: string): string {
  return new URL(formUrl).origin;
}
