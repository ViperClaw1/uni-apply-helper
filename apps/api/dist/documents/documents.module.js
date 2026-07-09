"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsModule = void 0;
const common_1 = require("@nestjs/common");
const document_parse_worker_js_1 = require("./document-parse.worker.js");
const documents_controller_js_1 = require("./documents.controller.js");
const documents_service_js_1 = require("./documents.service.js");
const parser_service_js_1 = require("./parser.service.js");
let DocumentsModule = class DocumentsModule {
};
exports.DocumentsModule = DocumentsModule;
exports.DocumentsModule = DocumentsModule = __decorate([
    (0, common_1.Module)({
        controllers: [documents_controller_js_1.DocumentsController],
        providers: [documents_service_js_1.DocumentsService, parser_service_js_1.ParserService, document_parse_worker_js_1.DocumentParseWorker],
        exports: [documents_service_js_1.DocumentsService, parser_service_js_1.ParserService],
    })
], DocumentsModule);
//# sourceMappingURL=documents.module.js.map