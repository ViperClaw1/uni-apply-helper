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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@uni-apply/database");
const prisma_service_1 = require("../prisma/prisma.service");
const mail_service_1 = require("./mail.service");
const password_util_1 = require("./password.util");
const token_util_1 = require("./token.util");
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
let AuthService = class AuthService {
    prisma;
    mailService;
    constructor(prisma, mailService) {
        this.prisma = prisma;
        this.mailService = mailService;
    }
    async signup(input, verifyBaseUrl) {
        const email = input.email?.trim().toLowerCase();
        const password = input.password ?? '';
        if (!email) {
            throw new common_1.BadRequestException('Email is required.');
        }
        if (!password_util_1.PASSWORD_POLICY_REGEX.test(password)) {
            throw new common_1.BadRequestException(password_util_1.PASSWORD_POLICY_MESSAGE);
        }
        if (password !== input.confirmPassword) {
            throw new common_1.BadRequestException('Passwords do not match.');
        }
        if (input.role !== 'student' && input.role !== 'agency') {
            throw new common_1.BadRequestException('role must be "student" or "agency".');
        }
        const agencyData = this.validateAgencyInput(input.role, input.agency);
        const passwordHash = (0, password_util_1.hashPassword)(password);
        const verificationToken = (0, token_util_1.generateToken)();
        const verificationTokenHash = (0, token_util_1.hashToken)(verificationToken);
        const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
        try {
            await this.prisma.account.create({
                data: {
                    email,
                    passwordHash,
                    role: input.role,
                    verificationTokenHash,
                    verificationTokenExpiresAt,
                    ...(agencyData ? { agencyProfile: { create: agencyData } } : {}),
                },
            });
        }
        catch (error) {
            if (error instanceof database_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Email already registered.');
            }
            throw error;
        }
        const verifyUrl = `${verifyBaseUrl}?token=${verificationToken}`;
        await this.mailService.sendVerificationEmail(email, verifyUrl);
        return { email };
    }
    async login(input) {
        const email = input.email?.trim().toLowerCase();
        const password = input.password ?? '';
        const account = email
            ? await this.prisma.account.findUnique({ where: { email } })
            : null;
        const isValidPassword = (0, password_util_1.verifyPassword)(password, account?.passwordHash ?? password_util_1.DUMMY_PASSWORD_HASH);
        if (!account || !isValidPassword) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        if (!account.emailVerifiedAt) {
            throw new common_1.ForbiddenException('Please verify your email before logging in.');
        }
        const token = await this.createSession(account.id);
        return { token, account: this.toPublicAccount(account) };
    }
    async verifyEmail(token) {
        if (!token) {
            throw new common_1.BadRequestException('token is required.');
        }
        const tokenHash = (0, token_util_1.hashToken)(token);
        const pending = await this.prisma.account.findFirst({
            where: {
                verificationTokenHash: tokenHash,
                verificationTokenExpiresAt: { gt: new Date() },
            },
            select: { id: true },
        });
        if (!pending) {
            throw new common_1.BadRequestException('Invalid or expired verification link.');
        }
        const result = await this.prisma.account.updateMany({
            where: { id: pending.id, verificationTokenHash: tokenHash },
            data: {
                emailVerifiedAt: new Date(),
                verificationTokenHash: null,
                verificationTokenExpiresAt: null,
            },
        });
        if (result.count !== 1) {
            throw new common_1.BadRequestException('Invalid or expired verification link.');
        }
        const account = await this.prisma.account.findUniqueOrThrow({
            where: { id: pending.id },
        });
        const sessionToken = await this.createSession(account.id);
        return { token: sessionToken, account: this.toPublicAccount(account) };
    }
    async logout(sessionToken) {
        if (!sessionToken) {
            return;
        }
        await this.prisma.session.deleteMany({
            where: { tokenHash: (0, token_util_1.hashToken)(sessionToken) },
        });
    }
    async getAccountBySessionToken(sessionToken) {
        if (!sessionToken) {
            return null;
        }
        const session = await this.prisma.session.findUnique({
            where: { tokenHash: (0, token_util_1.hashToken)(sessionToken) },
            include: { account: { include: { agencyProfile: true } } },
        });
        if (!session || session.expiresAt < new Date()) {
            return null;
        }
        return this.toPublicAccount(session.account, session.account.agencyProfile);
    }
    async createSession(accountId) {
        const token = (0, token_util_1.generateToken)();
        await this.prisma.session.create({
            data: {
                accountId,
                tokenHash: (0, token_util_1.hashToken)(token),
                expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            },
        });
        return token;
    }
    validateAgencyInput(role, agency) {
        if (role !== 'agency') {
            return null;
        }
        const legalName = agency?.legalName?.trim();
        const country = agency?.country?.trim();
        const taxId = agency?.taxId?.trim();
        if (!legalName || !country || !taxId) {
            throw new common_1.BadRequestException('legalName, country and taxId are required for agency signup.');
        }
        return { legalName, country, taxId };
    }
    toPublicAccount(account, agencyProfile) {
        return {
            id: account.id,
            email: account.email,
            role: account.role,
            emailVerifiedAt: account.emailVerifiedAt,
            agencyProfile: agencyProfile ?? undefined,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map