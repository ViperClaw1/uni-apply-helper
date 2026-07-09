"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateSchemaStep = void 0;
const common_1 = require("@nestjs/common");
let ValidateSchemaStep = class ValidateSchemaStep {
    name = 'validate_schema';
    async execute(context) {
        const missingSelectors = [];
        for (const field of context.university.fields) {
            const count = await context.page.locator(field.selector).count();
            if (count === 0) {
                missingSelectors.push(field.selector);
            }
        }
        if (missingSelectors.length > 0) {
            throw new Error(`Missing selectors: ${missingSelectors.join(', ')}`);
        }
    }
};
exports.ValidateSchemaStep = ValidateSchemaStep;
exports.ValidateSchemaStep = ValidateSchemaStep = __decorate([
    (0, common_1.Injectable)()
], ValidateSchemaStep);
//# sourceMappingURL=validate-schema.step.js.map