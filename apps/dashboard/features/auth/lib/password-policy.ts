export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include at least one letter and one digit.";

export function isPasswordValid(password: string): boolean {
  return PASSWORD_POLICY_REGEX.test(password);
}
