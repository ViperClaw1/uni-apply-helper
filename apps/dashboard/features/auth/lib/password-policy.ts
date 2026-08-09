export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function isPasswordValid(password: string): boolean {
  return PASSWORD_POLICY_REGEX.test(password);
}
