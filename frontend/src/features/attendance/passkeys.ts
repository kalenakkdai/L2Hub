/** Browser WebAuthn conversion helpers. No biometric data is accessible here. */

function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  )
  const binary = window.atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer
}

function toBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

type JsonCredentialDescriptor = Omit<PublicKeyCredentialDescriptor, 'id'> & {
  id: string
}

type RegistrationOptionsJson = Omit<
  PublicKeyCredentialCreationOptions,
  'challenge' | 'user' | 'excludeCredentials'
> & {
  challenge: string
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string }
  excludeCredentials?: JsonCredentialDescriptor[]
}

type AuthenticationOptionsJson = Omit<
  PublicKeyCredentialRequestOptions,
  'challenge' | 'allowCredentials'
> & {
  challenge: string
  allowCredentials?: JsonCredentialDescriptor[]
}

function descriptorFromJson(
  descriptor: JsonCredentialDescriptor,
): PublicKeyCredentialDescriptor {
  return { ...descriptor, id: fromBase64Url(descriptor.id) }
}

function credentialBase(credential: PublicKeyCredential) {
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

export function passkeysSupported(): boolean {
  return Boolean(
    window.isSecureContext &&
      navigator.credentials &&
      window.PublicKeyCredential,
  )
}

export async function createPasskey(
  rawOptions: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const options = rawOptions as unknown as RegistrationOptionsJson
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: fromBase64Url(options.challenge),
      user: { ...options.user, id: fromBase64Url(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map(descriptorFromJson),
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('Passkey registration was cancelled.')
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    ...credentialBase(credential),
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  }
}

export async function getPasskeyAssertion(
  rawOptions: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const options = rawOptions as unknown as AuthenticationOptionsJson
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: fromBase64Url(options.challenge),
      allowCredentials: options.allowCredentials?.map(descriptorFromJson),
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('Passkey check-in was cancelled.')
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    ...credentialBase(credential),
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    },
  }
}
