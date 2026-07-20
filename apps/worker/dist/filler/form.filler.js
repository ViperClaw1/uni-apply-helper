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
exports.FormFiller = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const agent_config_js_1 = require("../agent/agent.config.js");
const form_agent_js_1 = require("../agent/form.agent.js");
const semantic_field_mapper_js_1 = require("../agent/dom/semantic-field.mapper.js");
const field_locator_js_1 = require("./field.locator.js");
const field_mapper_js_1 = require("./field.mapper.js");
const file_attacher_js_1 = require("./file.attacher.js");
const wizard_field_groups_js_1 = require("./wizard-field-groups.js");
const wizard_navigator_js_1 = require("./wizard.navigator.js");
let FormFiller = class FormFiller {
    configService;
    fieldMapper;
    fileAttacher;
    wizardNavigator;
    wizardFieldGroups;
    semanticFieldMapper;
    formAgent;
    constructor(configService, fieldMapper, fileAttacher, wizardNavigator, wizardFieldGroups, semanticFieldMapper, formAgent) {
        this.configService = configService;
        this.fieldMapper = fieldMapper;
        this.fileAttacher = fileAttacher;
        this.wizardNavigator = wizardNavigator;
        this.wizardFieldGroups = wizardFieldGroups;
        this.semanticFieldMapper = semanticFieldMapper;
        this.formAgent = formAgent;
    }
    async fillFields(page, profile, fields, motivationLetterContent, university) {
        const fillMode = university
            ? (0, agent_config_js_1.resolveFillMode)(this.configService, university)
            : 'schema';
        await this.fillFieldBatch(page, profile, fields, motivationLetterContent, fillMode);
    }
    async attachFiles(page, profile, fields) {
        await this.fileAttacher.attachFiles(page, profile, fields);
    }
    async submit(page) {
        const submit = page
            .locator([
            "button[type='submit']",
            "input[type='submit']",
            'button:has-text("Submit")',
            'button:has-text("Отправить")',
        ].join(', '))
            .first();
        await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined),
            submit.click(),
        ]);
    }
    async processWizard(page, profile, university, motivationLetterContent) {
        const fillMode = (0, agent_config_js_1.resolveFillMode)(this.configService, university);
        if (fillMode === 'agent') {
            const result = await this.formAgent.runWizard(page, profile, university, motivationLetterContent);
            if (!result.completed) {
                throw new Error(result.finalAction?.reason ??
                    'Agent failed to complete the wizard form.');
            }
            return;
        }
        const wizard = university.wizard;
        if (!wizard) {
            throw new Error(`University "${university.id}" has no wizard config`);
        }
        await this.wizardNavigator.forEachStep(page, wizard, async (step) => {
            const fields = this.wizardFieldGroups.fieldsForStep(university, step);
            await this.fillFieldBatch(page, profile, fields.filter((field) => field.type !== 'file'), motivationLetterContent, fillMode);
            const fileFields = fields.filter((field) => field.type === 'file');
            if (fileFields.length > 0) {
                await this.fileAttacher.attachFiles(page, profile, fileFields);
            }
        });
        await this.wizardNavigator.clickSubmit(page, wizard.submitButtonSelector);
    }
    async fillFieldBatch(page, profile, fields, motivationLetterContent, fillMode) {
        for (const field of fields) {
            const value = this.fieldMapper.getValue(profile, field, motivationLetterContent);
            if (value === undefined || value === null || value === '') {
                if (field.required) {
                    throw new Error(`Missing required profile value: ${field.mapsTo}`);
                }
                continue;
            }
            let locator = await (0, field_locator_js_1.resolveFieldLocator)(page, field);
            if (!locator && fillMode === 'hybrid') {
                locator = await this.semanticFieldMapper.resolveLocator(page, field, profile, motivationLetterContent);
            }
            if (!locator) {
                if (field.required) {
                    throw new Error(`Field not found: ${field.selector}${field.labelHint ? ` / "${field.labelHint}"` : ''}`);
                }
                continue;
            }
            await this.fillField(page, field, locator, value);
        }
    }
    async fillField(page, field, locator, value) {
        const normalizedValue = String(value);
        switch (field.type) {
            case 'select':
                await locator.selectOption({ label: normalizedValue }).catch(async () => {
                    await locator.selectOption(normalizedValue);
                });
                break;
            case 'radio':
                if (field.selector) {
                    const radio = page
                        .locator(`${field.selector}[value="${normalizedValue}"]`)
                        .first();
                    if ((await radio.count()) > 0) {
                        await radio.check();
                        break;
                    }
                }
                await page
                    .getByRole('radio', { name: normalizedValue, exact: false })
                    .first()
                    .check()
                    .catch(() => locator.check());
                break;
            case 'checkbox':
                if (this.toBoolean(value)) {
                    await locator.check();
                }
                break;
            case 'textarea':
            case 'essay':
            case 'number':
            case 'text':
                await locator.fill(normalizedValue);
                break;
            case 'file':
                break;
        }
    }
    toBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        return ['true', 'yes', 'да', '1'].includes(String(value).toLowerCase());
    }
};
exports.FormFiller = FormFiller;
exports.FormFiller = FormFiller = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        field_mapper_js_1.FieldMapper,
        file_attacher_js_1.FileAttacher,
        wizard_navigator_js_1.WizardNavigator,
        wizard_field_groups_js_1.WizardFieldGroups,
        semantic_field_mapper_js_1.SemanticFieldMapper,
        form_agent_js_1.FormAgent])
], FormFiller);
//# sourceMappingURL=form.filler.js.map