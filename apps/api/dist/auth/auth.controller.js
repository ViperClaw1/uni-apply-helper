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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const cookie_util_1 = require("./cookie.util");
const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
let AuthController = class AuthController {
    authService;
    configService;
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
    }
    async signup(body, res) {
        const dashboardOrigin = (this.configService.get('DASHBOARD_ORIGIN') ??
            'http://localhost:3001')
            .split(',')[0]
            .replace(/\/$/, '');
        const result = await this.authService.signup(body, `${dashboardOrigin}/verify-email`);
        if (result.token) {
            this.setSessionCookie(res, result.token);
            return { account: result.account };
        }
        return { email: result.email };
    }
    async login(body, res) {
        const { token, account } = await this.authService.login(body);
        this.setSessionCookie(res, token);
        return { account };
    }
    async verifyEmail(body, res) {
        const { token, account } = await this.authService.verifyEmail(body.token);
        this.setSessionCookie(res, token);
        return { account };
    }
    async logout(req, res) {
        const sessionToken = (0, cookie_util_1.parseCookie)(req.headers.cookie, cookie_util_1.SESSION_COOKIE_NAME);
        await this.authService.logout(sessionToken);
        res.clearCookie(cookie_util_1.SESSION_COOKIE_NAME, { path: '/' });
        return { ok: true };
    }
    async me(req) {
        const sessionToken = (0, cookie_util_1.parseCookie)(req.headers.cookie, cookie_util_1.SESSION_COOKIE_NAME);
        const account = await this.authService.getAccountBySessionToken(sessionToken);
        if (!account) {
            throw new common_1.UnauthorizedException('Not signed in.');
        }
        return { account };
    }
    setSessionCookie(res, token) {
        res.cookie(cookie_util_1.SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_COOKIE_MAX_AGE_MS,
        });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('signup'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signup", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService, typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], AuthController);
//# sourceMappingURL=auth.controller.js.map