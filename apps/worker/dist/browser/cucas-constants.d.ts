export declare const LOGIN_URL = "http://lnpu.chiwest.cn/en/student/login";
export declare const MEMBER_URL = "http://lnpu.chiwest.cn/en/student/index";
export declare const MY_APPLICATION_URL = "http://lnpu.chiwest.cn/en/student/index/all";
export declare const PROGRAM_LIST_URL = "http://lnpu.chiwest.cn/en/student/apply/index";
export declare const FORM_URL = "http://lnpu.chiwest.cn/en/student/apply_forms/index";
export declare function isCucasFormUrl(formUrl: string): boolean;
export declare function isLnpuFormUrl(formUrl: string): boolean;
export declare function originFromFormUrl(formUrl: string): string;
