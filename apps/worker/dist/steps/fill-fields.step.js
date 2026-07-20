"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FillFieldsStep = void 0;
const common_1 = require("@nestjs/common");
const form_filler_js_1 = require("../filler/form.filler.js");
let FillFieldsStep = class FillFieldsStep {
    formFiller;
    name = 'fill_fields';
    constructor(formFiller) {
        this.formFiller = formFiller;
    }
    async execute(context) {
        await this.formFiller.fillFields(context.page, context.profile, context.university.fields, context.motivationLetterContent, context.university);
    }
};
exports.FillFieldsStep = FillFieldsStep;
exports.FillFieldsStep = FillFieldsStep = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [form_filler_js_1.FormFiller])
], FillFieldsStep);
//# sourceMappingURL=fill-fields.step.js.map