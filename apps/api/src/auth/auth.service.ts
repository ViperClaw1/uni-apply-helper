import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountRole, Prisma } from '@uni-apply/database';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import {
  DUMMY_PASSWORD_HASH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
  hashPassword,
  verifyPassword,
} from './password.util';
import { generateToken, hashToken } from './token.util';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

type AgencyInput = {
  legalName?: string;
  country?: string;
  taxId?: string;
};

type SignupInput = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: AccountRole;
  agency?: AgencyInput;
};

type LoginInput = {
  email?: string;
  password?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async signup(input: SignupInput, verifyBaseUrl: string) {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    if (!PASSWORD_POLICY_REGEX.test(password)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }

    if (password !== input.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    if (input.role !== 'student' && input.role !== 'agency') {
      throw new BadRequestException('role must be "student" or "agency".');
    }

    const agencyData = this.validateAgencyInput(input.role, input.agency);

    const passwordHash = hashPassword(password);
    const verificationToken = generateToken();
    const verificationTokenHash = hashToken(verificationToken);
    const verificationTokenExpiresAt = new Date(
      Date.now() + VERIFICATION_TTL_MS,
    );

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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered.');
      }
      throw error;
    }

    const verifyUrl = `${verifyBaseUrl}?token=${verificationToken}`;

    try {
      await this.mailService.sendVerificationEmail(email, verifyUrl);
    } catch (error) {
      // The account already exists at this point — a delivery failure
      // shouldn't surface as a signup failure (misleading, and retrying
      // would just hit "email already registered"). It's an operational
      // problem to fix (provider config, domain verification), not the
      // caller's problem.
      this.logger.error(`Failed to send verification email to ${email}`, error);
    }

    return { email };
  }

  async login(input: LoginInput) {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    const account = email
      ? await this.prisma.account.findUnique({ where: { email } })
      : null;

    const isValidPassword = verifyPassword(
      password,
      account?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!account || !isValidPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!account.emailVerifiedAt) {
      throw new ForbiddenException(
        'Please verify your email before logging in.',
      );
    }

    const token = await this.createSession(account.id);
    return { token, account: this.toPublicAccount(account) };
  }

  async verifyEmail(token: string | undefined) {
    if (!token) {
      throw new BadRequestException('token is required.');
    }

    const tokenHash = hashToken(token);
    const pending = await this.prisma.account.findFirst({
      where: {
        verificationTokenHash: tokenHash,
        verificationTokenExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!pending) {
      throw new BadRequestException('Invalid or expired verification link.');
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
      throw new BadRequestException('Invalid or expired verification link.');
    }

    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: pending.id },
    });
    const sessionToken = await this.createSession(account.id);
    return { token: sessionToken, account: this.toPublicAccount(account) };
  }

  async logout(sessionToken: string | undefined) {
    if (!sessionToken) {
      return;
    }

    await this.prisma.session.deleteMany({
      where: { tokenHash: hashToken(sessionToken) },
    });
  }

  async getAccountBySessionToken(sessionToken: string | undefined) {
    if (!sessionToken) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
      include: { account: { include: { agencyProfile: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return this.toPublicAccount(session.account, session.account.agencyProfile);
  }

  private async createSession(accountId: string) {
    const token = generateToken();
    await this.prisma.session.create({
      data: {
        accountId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }

  private validateAgencyInput(
    role: AccountRole,
    agency: AgencyInput | undefined,
  ) {
    if (role !== 'agency') {
      return null;
    }

    const legalName = agency?.legalName?.trim();
    const country = agency?.country?.trim();
    const taxId = agency?.taxId?.trim();

    if (!legalName || !country || !taxId) {
      throw new BadRequestException(
        'legalName, country and taxId are required for agency signup.',
      );
    }

    return { legalName, country, taxId };
  }

  private toPublicAccount(
    account: {
      id: string;
      email: string;
      role: AccountRole;
      emailVerifiedAt: Date | null;
    },
    agencyProfile?: {
      legalName: string;
      country: string;
      taxId: string;
    } | null,
  ) {
    return {
      id: account.id,
      email: account.email,
      role: account.role,
      emailVerifiedAt: account.emailVerifiedAt,
      agencyProfile: agencyProfile ?? undefined,
    };
  }
}
