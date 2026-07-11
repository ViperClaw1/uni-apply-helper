"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chromium = void 0;
const playwright_extra_1 = require("playwright-extra");
Object.defineProperty(exports, "chromium", { enumerable: true, get: function () { return playwright_extra_1.chromium; } });
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
//# sourceMappingURL=stealth.config.js.map