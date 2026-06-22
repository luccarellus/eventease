const CREDENTIAL_CODE_LENGTH = 6;
const CREDENTIAL_CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateCredentialCode(prefix = 'EVT-') {
  const randomValues = new Uint8Array(CREDENTIAL_CODE_LENGTH);
  crypto.getRandomValues(randomValues);

  let code = '';
  for (let index = 0; index < CREDENTIAL_CODE_LENGTH; index += 1) {
    code += CREDENTIAL_CODE_CHARACTERS[randomValues[index] % CREDENTIAL_CODE_CHARACTERS.length];
  }

  return `${prefix}${code}`;
}
