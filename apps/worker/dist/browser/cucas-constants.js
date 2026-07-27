"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORM_URL = exports.PROGRAM_LIST_URL = exports.MY_APPLICATION_URL = exports.MEMBER_URL = exports.LOGIN_URL = void 0;
exports.isCucasFormUrl = isCucasFormUrl;
exports.isLnpuFormUrl = isLnpuFormUrl;
exports.originFromFormUrl = originFromFormUrl;
exports.LOGIN_URL = 'http://lnpu.chiwest.cn/en/student/login';
exports.MEMBER_URL = 'http://lnpu.chiwest.cn/en/student/index';
exports.MY_APPLICATION_URL = 'http://lnpu.chiwest.cn/en/student/index/all';
exports.PROGRAM_LIST_URL = 'http://lnpu.chiwest.cn/en/student/apply/index';
exports.FORM_URL = 'http://lnpu.chiwest.cn/en/student/apply_forms/index';
function isCucasFormUrl(formUrl) {
    return /chiwest\.cn|cucas\.cn|apply\.sdu\.edu\.cn/i.test(formUrl);
}
function isLnpuFormUrl(formUrl) {
    return /lnpu\.chiwest\.cn/i.test(formUrl);
}
function originFromFormUrl(formUrl) {
    return new URL(formUrl).origin;
}
//# sourceMappingURL=cucas-constants.js.map