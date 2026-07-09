"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldMapper = void 0;
const common_1 = require("@nestjs/common");
const get_js_1 = __importDefault(require("lodash/get.js"));
let FieldMapper = class FieldMapper {
    getValue(profile, field, motivationLetterContent) {
        if (field.type === 'essay' && !field.mapsTo) {
            return motivationLetterContent;
        }
        if (!field.mapsTo) {
            return undefined;
        }
        return (0, get_js_1.default)(profile, field.mapsTo);
    }
};
exports.FieldMapper = FieldMapper;
exports.FieldMapper = FieldMapper = __decorate([
    (0, common_1.Injectable)()
], FieldMapper);
//# sourceMappingURL=field.mapper.js.map