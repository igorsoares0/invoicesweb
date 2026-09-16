/** Who integration tests are "signed in" as. The auth context module is mocked to read from here. */
export const authState: { userId: string | null } = { userId: null };

export function signInAs(userId: string | null) {
  authState.userId = userId;
}
