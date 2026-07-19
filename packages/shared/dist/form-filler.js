"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFieldValue = getFieldValue;
exports.fieldsForStep = fieldsForStep;
exports.toBoolean = toBoolean;
function getByPath(obj, path) {
    return path.split('.').reduce((acc, key) => {
        if (acc == null) {
            return undefined;
        }
        if (Array.isArray(acc)) {
            const index = Number(key);
            return Number.isInteger(index) ? acc[index] : undefined;
        }
        if (typeof acc === 'object' && key in acc) {
            return acc[key];
        }
        return undefined;
    }, obj);
}
function getFieldValue(profile, field, motivationLetterContent) {
    if (field.type === 'essay' && !field.mapsTo) {
        return motivationLetterContent;
    }
    if (!field.mapsTo) {
        return undefined;
    }
    return getByPath(profile, field.mapsTo);
}
function fieldsForStep(schema, step) {
    return schema.fields.filter((field) => (field.wizardStep ?? 1) === step);
}
function toBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    return ['true', 'yes', 'да', '1'].includes(String(value).toLowerCase());
}
