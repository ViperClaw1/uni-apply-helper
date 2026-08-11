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
var GeminiClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
exports.parseJsonResponse = parseJsonResponse;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
const GEMINI_AGENT_MODEL_FALLBACKS = [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
];
const QUOTA_MAX_RETRIES_PER_MODEL = 2;
const THINKING_LEVELS = {
    minimal: genai_1.ThinkingLevel.MINIMAL,
    low: genai_1.ThinkingLevel.LOW,
    medium: genai_1.ThinkingLevel.MEDIUM,
    high: genai_1.ThinkingLevel.HIGH,
};
let GeminiClient = GeminiClient_1 = class GeminiClient {
    configService;
    logger = new common_1.Logger(GeminiClient_1.name);
    gemini;
    model;
    thinkingLevel;
    resolvedModel;
    constructor(configService) {
        this.configService = configService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (apiKey) {
            this.gemini = new genai_1.GoogleGenAI({ apiKey });
        }
        this.model =
            this.configService.get('GEMINI_AGENT_MODEL') ||
                this.configService.get('GEMINI_DOCUMENT_MODEL') ||
                'gemini-3.5-flash';
        const configuredThinking = this.configService
            .get('GEMINI_AGENT_THINKING_LEVEL')
            ?.trim()
            .toLowerCase() ?? 'minimal';
        this.thinkingLevel =
            THINKING_LEVELS[configuredThinking] ??
                genai_1.ThinkingLevel.MINIMAL;
    }
    isAvailable() {
        return Boolean(this.gemini);
    }
    async generateJson(options) {
        if (!this.gemini) {
            throw new Error('GEMINI_API_KEY is not configured.');
        }
        const parts = [{ text: options.prompt }];
        if (options.screenshotBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: options.screenshotBase64,
                },
            });
        }
        const response = await this.generateContentWithFallback({
            parts,
            temperature: options.temperature ?? 0.1,
        });
        const text = response.text?.trim();
        if (!text) {
            throw new Error('Gemini returned an empty response.');
        }
        return parseJsonResponse(text);
    }
    async generateContentWithFallback(options) {
        let lastError;
        for (const model of this.getModelCandidates()) {
            for (let attempt = 1; attempt <= QUOTA_MAX_RETRIES_PER_MODEL; attempt += 1) {
                try {
                    const response = await this.gemini.models.generateContent({
                        model,
                        contents: [{ role: 'user', parts: options.parts }],
                        config: {
                            temperature: options.temperature,
                            responseMimeType: 'application/json',
                            thinkingConfig: {
                                thinkingLevel: this.thinkingLevel,
                            },
                        },
                    });
                    const usage = response.usageMetadata;
                    this.logger.debug(`Gemini usage model=${model} thinking=${this.thinkingLevel} ` +
                        `prompt=${usage?.promptTokenCount ?? 0} ` +
                        `thoughts=${usage?.thoughtsTokenCount ?? 0} ` +
                        `output=${usage?.candidatesTokenCount ?? 0} ` +
                        `total=${usage?.totalTokenCount ?? 0}`);
                    if (model !== this.model) {
                        this.logger.warn(`Gemini using "${model}" (configured GEMINI_*_MODEL="${this.model}" is legacy/unavailable). ` +
                            `Set GEMINI_AGENT_MODEL=${model} to silence this.`);
                    }
                    this.resolvedModel = model;
                    return response;
                }
                catch (error) {
                    lastError = error;
                    if (this.isGeminiModelNotFoundError(error)) {
                        this.logger.warn(`Gemini model "${model}" not found, trying next fallback.`);
                        this.resolvedModel = undefined;
                        break;
                    }
                    if (this.isGeminiQuotaError(error)) {
                        const delayMs = this.getRetryDelayMs(error);
                        this.logger.warn(`Gemini quota on "${model}" (attempt ${attempt}/${QUOTA_MAX_RETRIES_PER_MODEL}), ` +
                            `retry in ${Math.ceil(delayMs / 1000)}s then try next model if needed.`);
                        this.resolvedModel = undefined;
                        if (attempt < QUOTA_MAX_RETRIES_PER_MODEL && delayMs > 0) {
                            await this.delay(Math.min(delayMs, 60_000));
                            continue;
                        }
                        break;
                    }
                    throw error;
                }
            }
        }
        throw lastError;
    }
    getModelCandidates() {
        const preferred = this.resolvedModel;
        const configured = this.model;
        const fallbacks = GEMINI_AGENT_MODEL_FALLBACKS.filter((model) => model !== configured && model !== preferred);
        const isLegacyModel = /gemini-2\.[05]|gemini-1\.5/.test(configured);
        const ordered = isLegacyModel
            ? [...fallbacks, configured]
            : [configured, ...fallbacks];
        if (preferred && !ordered.includes(preferred)) {
            return [preferred, ...ordered];
        }
        if (preferred) {
            return [preferred, ...ordered.filter((m) => m !== preferred)];
        }
        return ordered;
    }
    isGeminiModelNotFoundError(error) {
        if (typeof error !== 'object' || error === null) {
            return false;
        }
        const err = error;
        const status = err.status ?? err.statusCode;
        if (status === 404) {
            return true;
        }
        const message = err.message ?? (error instanceof Error ? error.message : String(error));
        return (/NOT_FOUND/i.test(message) ||
            /no longer available/i.test(message) ||
            /is not found for API version/i.test(message));
    }
    isGeminiQuotaError(error) {
        if (typeof error !== 'object' || error === null) {
            return false;
        }
        const err = error;
        const status = err.status ?? err.statusCode;
        if (status === 429) {
            return true;
        }
        const message = err.message ?? (error instanceof Error ? error.message : String(error));
        return (/RESOURCE_EXHAUSTED/i.test(message) ||
            /exceeded your current quota/i.test(message) ||
            /rate.?limit/i.test(message) ||
            /Quota exceeded/i.test(message));
    }
    getRetryDelayMs(error) {
        const message = error instanceof Error ? error.message : String(error ?? '');
        const retryInfo = message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
        if (retryInfo?.[1]) {
            const seconds = Number(retryInfo[1]);
            if (Number.isFinite(seconds) && seconds > 0) {
                return Math.ceil(seconds * 1000) + 500;
            }
        }
        const pleaseRetry = message.match(/Please retry in ([\d.]+)s/i);
        if (pleaseRetry?.[1]) {
            const seconds = Number(pleaseRetry[1]);
            if (Number.isFinite(seconds) && seconds > 0) {
                return Math.ceil(seconds * 1000) + 500;
            }
        }
        return 35_000;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.GeminiClient = GeminiClient;
exports.GeminiClient = GeminiClient = GeminiClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiClient);
function parseJsonResponse(raw) {
    const candidates = collectJsonCandidates(raw);
    let lastError;
    for (const candidate of candidates) {
        for (const variant of [
            candidate,
            closeTruncatedJson(candidate),
            repairGeminiJson(candidate),
        ]) {
            try {
                return JSON.parse(variant);
            }
            catch (error) {
                lastError = error;
            }
        }
    }
    const preview = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
    throw new Error(`Failed to parse Gemini JSON: ${lastError instanceof Error ? lastError.message : 'unknown error'}` +
        (preview ? ` Raw preview: ${preview}` : ''));
}
function collectJsonCandidates(raw) {
    const trimmed = raw.trim();
    const out = [];
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced)
        out.push(fenced);
    out.push(trimmed);
    const object = extractBalancedJson(trimmed, '{', '}');
    if (object)
        out.push(object);
    return [...new Set(out.filter(Boolean))];
}
function repairGeminiJson(raw) {
    let s = raw.replace(/^\uFEFF/, '');
    s = replaceOutsideStrings(s, (chunk) => chunk
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/:\s*(\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+)(?=\s*[,}\]])/g, ': "$1"')
        .replace(/:\s*(\d{4}-\d{2}-\d{2})(?=\s*[,}\]])/g, ': "$1"'));
    s = quoteBareValuesOutsideStrings(s);
    return closeTruncatedJson(s);
}
function replaceOutsideStrings(raw, transform) {
    let out = '';
    let buf = '';
    let inString = false;
    let escaped = false;
    const flush = () => {
        if (buf) {
            out += transform(buf);
            buf = '';
        }
    };
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (inString) {
            out += ch;
            if (escaped) {
                escaped = false;
            }
            else if (ch === '\\') {
                escaped = true;
            }
            else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            flush();
            inString = true;
            out += ch;
            continue;
        }
        buf += ch;
    }
    flush();
    return out;
}
function quoteBareValuesOutsideStrings(raw) {
    return replaceOutsideStrings(raw, (chunk) => chunk.replace(/:\s*(?!["{\[\d]|true\b|false\b|null\b)([^,\n}\]]+(?:,[^,\n}\]]+)*)/g, (match, value) => {
        const trimmed = value.trim();
        if (!trimmed || /^["{\[\d]|^(true|false|null)$/i.test(trimmed)) {
            return match;
        }
        if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
            return match;
        }
        if (/^has-text\(|^text=|^nth=/i.test(trimmed)) {
            return match;
        }
        const escaped = trimmed
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `: "${escaped}"`;
    }));
}
function closeTruncatedJson(raw) {
    let inString = false;
    let escaped = false;
    const stack = [];
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{' || ch === '[') {
            stack.push(ch);
            continue;
        }
        if (ch === '}' || ch === ']') {
            stack.pop();
        }
    }
    let out = raw;
    if (inString) {
        out += '"';
    }
    out = out.replace(/,\s*$/, '');
    while (stack.length) {
        const open = stack.pop();
        out += open === '{' ? '}' : ']';
    }
    return out;
}
function extractBalancedJson(raw, open, close) {
    const start = raw.indexOf(open);
    if (start < 0)
        return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < raw.length; i += 1) {
        const ch = raw[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if (ch === '\\') {
                escaped = true;
            }
            else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === open)
            depth += 1;
        if (ch === close) {
            depth -= 1;
            if (depth === 0)
                return raw.slice(start, i + 1);
        }
    }
    return null;
}
//# sourceMappingURL=gemini.client.js.map