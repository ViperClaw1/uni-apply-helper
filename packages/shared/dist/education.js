"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.primaryEducation = primaryEducation;
exports.schoolEducation = schoolEducation;
/** Highest / most relevant education for uni form autofill (prefer higher). */
function primaryEducation(profile) {
    const list = profile.education ?? [];
    return (list.find((entry) => entry.level === 'higher') ??
        list.find((entry) => entry.level === 'school') ??
        list[0]);
}
function schoolEducation(profile) {
    const list = profile.education ?? [];
    return list.find((entry) => entry.level === 'school') ?? list[0];
}
