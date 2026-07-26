"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapsToPaths = mapsToPaths;
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
/** Normalize mapsTo to an ordered list of profile paths. */
function mapsToPaths(mapsTo) {
    if (!mapsTo) {
        return [];
    }
    return Array.isArray(mapsTo) ? mapsTo.filter(Boolean) : [mapsTo];
}
function getFieldValue(profile, field, motivationLetterContent) {
    if (field.type === 'essay' && !field.mapsTo) {
        return motivationLetterContent;
    }
    const paths = mapsToPaths(field.mapsTo);
    if (paths.length === 0) {
        return undefined;
    }
    for (const path of paths) {
        const value = getByPath(profile, path);
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return undefined;
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
